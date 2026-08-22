// ============================================================
//  A scrolling view of a book [GENERATED ENTIRELY BY AI]
// ============================================================

import { loadPage, numLines, type BookData, type LookupEntry,
         type VerseRef } from "./data";
import { pageTypes, TikkunPage, type PageType } from "./page";
import { Transliteration } from "./transliteration";

/**
 * Load the font every type of page is set in, as named by the `--*-font`
 * custom properties on the `book` element (see `main.css`). Until a page's
 * font has loaded its text is laid out in a fallback font, and so cannot be
 * usefully measured - this must resolve before any page is laid out.
 */
async function loadPageFonts(book: HTMLElement): Promise<void> {
  const style = getComputedStyle(book);
  // The size in a font shorthand is required but irrelevant here, since which
  // faces get loaded depends only on the family, the style, and the weight
  await Promise.all(pageTypes.map((type) =>
    document.fonts.load(`1em ${style.getPropertyValue(`--${type}-font`)}`)));
  await document.fonts.load(`1em ${style.getPropertyValue(`--divine-name-font`)}`);
}

/**
 * A line to keep the scroll locked to while the pages around it change size.
 *
 * We remember which line it is rather than which element, because the element
 * does not survive a change of page type - the rows of a hidden page type are
 * not laid out at all, so their position on screen cannot be measured.
 */
type Anchor = {
  page: TikkunPage,
  lineIndex: number,
  /** Where the line's center was, relative to the center of the viewport */
  offsetFromCenter: number,
};

/**
 * How much content to keep loaded above and below the visible area, as a
 * multiple of the height of the visible area
 */
const loadMargin = 0.5;

/**
 * How long after the last `resize` event we consider a burst of resizes to be
 * over, in milliseconds
 */
const resizeIdleMs = 200;

/**
 * One page of the book as it appears in the scroll: either a `TikkunPage`
 * which has been built and laid out, or - until we have got to it - a blank
 * placeholder about as tall as that page will turn out to be (see
 * `.placeholder-tikkun-page` in `main.css`).
 *
 * A placeholder costs nothing while laying out a page costs most of a frame,
 * so every page is in the scroll as a placeholder from the start, and the text
 * goes into the ones the reader has got to as they go (see `fill`).
 */
class Slot {
  readonly pageIndex: number;
  private placeholder: HTMLElement;
  private tikkunPage: TikkunPage | null = null;

  /**
   * @param numLines how many lines the page this slot stands in for has, which
   * is what `main.css` sizes the placeholder from - a page with fewer lines
   * than the rest of its book needs correspondingly less room
   */
  constructor(pageIndex: number, numLines: number) {
    this.pageIndex = pageIndex;
    this.placeholder = document.createElement('div');
    this.placeholder.classList.add('placeholder-tikkun-page');
    this.placeholder.style.setProperty('--numLines', String(numLines));
  }

  /** The page in this slot, or `null` if it is still a placeholder */
  get page(): TikkunPage | null { return this.tikkunPage; }

  /** Whatever is currently standing in this slot */
  get element(): HTMLElement {
    return this.tikkunPage?.element ?? this.placeholder;
  }

  /**
   * Put `page` in the scroll in place of this slot's placeholder. It still has
   * to be laid out afterwards - until then it has no size worth speaking of.
   */
  fill(page: TikkunPage) {
    this.placeholder.replaceWith(page.element);
    this.tikkunPage = page;
  }

  /**
   * Put the placeholder back in place of this slot's page, fixed at exactly
   * the room the page turned out to need - a page's real height is rarely the
   * one `main.css` guesses, and this way giving a page up and coming back over
   * it later both move nothing.
   */
  empty() {
    const page = this.tikkunPage;
    if (page === null) { return; }
    // A scaled-down page takes its full unscaled height in the layout and
    // gives the difference back out of its bottom margin (see `updateScale`),
    // so the room it occupies is the two together
    const margin = parseFloat(getComputedStyle(page.element).marginBottom);
    this.placeholder.style.height =
      `${page.element.offsetHeight + margin}px`;
    page.element.replaceWith(this.placeholder);
    this.tikkunPage = null;
  }

  /**
   * Forget a height measured by `empty`, which is only good for the layout it
   * was measured in
   */
  forgetHeight() {
    this.placeholder.style.removeProperty('height');
  }
}

/**
 * A scrolling view of a whole book, which renders only the pages near the
 * visible area and loads more as the user scrolls in either direction. This
 * takes the place of `tikkun.io`'s `infinite-scroller.ts`, but differs from it
 * in a few ways worth noting:
 *
 * - Rendered pages are given up once they get far enough away, instead of
 *   accumulating forever - we can afford to keep them even less than
 *   `tikkun.io` can, since each of our pages carries up to four typeset copies
 *   of its text.
 * - The scroll is never extended, because it is never short: a placeholder for
 *   every page goes in at the start, at one empty `div` each. Nothing the
 *   reader can do outruns the loading, since `render` only ever puts text into
 *   room which is already there.
 * - Loading is driven by a single re-entrant `fill` loop which runs until the
 *   margins on both sides are satisfied, rather than by one fetch per `scroll`
 *   event - which never gets started if the initial content is shorter than
 *   the window, and falls behind if the user scrolls quickly.
 * - Everything which changes the height of the content is wrapped in an
 *   explicit scroll correction, and native scroll anchoring is turned off (see
 *   `overflow-anchor` in `main.css`) so the two cannot fight each other. A
 *   slot which has held a page remembers how tall it was, so a correction is
 *   only ever needed for a page the reader has not seen before.
 */
export class TikkunBook {
  /** The scrolling container which holds every rendered `TikkunPage` */
  readonly element: HTMLElement;
  readonly data: BookData;
  private readonly translit: Transliteration;

  /** Every page of the book, in order: `slots[i]` holds page `i + 1` */
  private slots: Slot[] = [];
  private left: PageType = 'ketiv';
  private right: PageType = 'en';

  /** What to tell whenever `currentVerse` or which pages are shown changes */
  private readonly listeners: (() => void)[] = [];

  /** The `fill` currently in progress, if any */
  private filling: Promise<void> | null = null;

  /**
   * The line to keep in place, for as long as whatever is moving the content
   * around is still going on - see `withAnchor` and `onResize`
   */
  private anchor: Anchor | null = null;
  private resizeFrame: number | null = null;
  private resizeIdleTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(element: HTMLElement, data: BookData,
                      translit: Transliteration) {
    this.element = element;
    this.data = data;
    this.translit = translit;

    this.element.classList.add('tikkun-book');

    // Lay the whole book out as placeholders at once - an empty `div` per
    // page, a couple of hundred at most - so that the scroll is the right
    // length from the first frame and never has to grow
    const placeholders = document.createDocumentFragment();
    for (let pageIndex = 1; pageIndex <= data.pageCount; pageIndex++) {
      const slot = new Slot(pageIndex, numLines(data, pageIndex));
      this.slots.push(slot);
      placeholders.append(slot.element);
    }
    this.element.append(placeholders);

    this.element.addEventListener('scroll', () => {
      void this.fill();
      this.changed();
    }, { passive: true });
    window.addEventListener('resize', () => this.onResize());
  }

  /**
   * Create a `TikkunBook` in `element` and scroll it to the given line
   */
  static async open(element: HTMLElement, data: BookData,
                    translit: Transliteration,
                    at: LookupEntry): Promise<TikkunBook> {
    const tikkunBook = new TikkunBook(element, data, translit);
    // Every page is laid out by measuring its own text, so nothing can be
    // rendered until the fonts that text will be set in are available
    await loadPageFonts(element);
    await tikkunBook.goTo(at);
    return tikkunBook;
  }

  /**
   * Discard everything currently rendered and scroll to the given line, which
   * is centered vertically in the visible area
   */
  async goTo({ page, line = 0 }: { page: number, line?: number }) {
    this.anchor = null;
    // Nothing we have rendered is anywhere near where we are going
    for (const slot of this.renderedSlots) { this.unrender(slot); }

    const slot = this.slots[page - 1];
    if (slot === undefined) { return; }
    // The placeholder for the page we want is already in the scroll, so we can
    // simply jump to it, and only then find out how tall the page really is
    this.element.scrollTop = this.topOf(slot);
    const tikkunPage = await this.render(slot);

    this.anchor = { page: tikkunPage, lineIndex: line, offsetFromCenter: 0 };
    try {
      this.restoreAnchor();
      // Hold the target line in place while the pages around it go in, since
      // they are rarely quite as tall as the placeholders they replace
      await this.fill();
      this.restoreAnchor();
    }
    finally { this.anchor = null; }
    // Now fill in whatever that last correction uncovered
    await this.fill();
    this.changed();
  }

  /** The slots which currently hold a rendered page, in order */
  private get renderedSlots(): Slot[] {
    return this.slots.filter((slot) => slot.page !== null);
  }

  /** Every page in the scroll which has actually been built */
  private get rendered(): TikkunPage[] {
    return this.renderedSlots.map((slot) => slot.page!);
  }

  /**
   * Change which page types are shown, on every rendered page at once. The
   * different page types have different heights, so we keep the line at the
   * center of the screen fixed.
   */
  updatePages(left: PageType, right: PageType) {
    if (left === right) { return; }
    this.left = left;
    this.right = right;
    this.withAnchor(() => {
      for (const page of this.rendered) { page.updatePages(left, right); }
      // Every page we have measured was measured showing the old pair
      this.forgetMeasuredHeights();
    });
    this.changed();
  }

  updateLeftPage(left: PageType) { this.updatePages(left, this.right); }
  updateRightPage(right: PageType) { this.updatePages(this.left, right); }

  /** Which page type is currently shown on each side */
  get leftPage(): PageType { return this.left; }
  get rightPage(): PageType { return this.right; }

  /**
   * The verse being read at the moment: the first verse of the line nearest
   * the center of the visible area, or `null` if nothing is rendered there
   */
  get currentVerse(): VerseRef | null {
    const nearest = this.lineNearest(this.viewportCenter);
    if (nearest === null) { return null; }
    const { verses } = nearest.page.data.lines[nearest.lineIndex];
    return verses[0] ?? null;
  }

  /**
   * Ask to be told whenever `currentVerse` or which pages are shown changes -
   * which is as often as every scroll event, so a listener which does anything
   * expensive should wait for a frame of its own
   */
  onChange(listener: () => void) { this.listeners.push(listener); }

  private changed() { for (const listener of this.listeners) { listener(); } }


  // ============================================================
  //  Loading pages in
  //
  //  Where a slot is is measured in scroll coordinates, with
  //  `offsetTop`: unlike a bounding box, those do not shift when
  //  we correct the scroll, and they are unaffected by the
  //  transform a page is scaled by. (The anchoring code below
  //  cannot work this way, since a line's offset parent is its
  //  own page rather than the scroll.)
  // ============================================================

  /** Where the top of `slot` sits in the scroll */
  private topOf(slot: Slot): number { return slot.element.offsetTop; }

  /**
   * Where the room `slot` takes up in the scroll ends, which is exactly where
   * the next slot begins - a page's own height leaves out the gap below it,
   * and is the height it would have had if it had not been scaled down
   */
  private bottomOf(slot: Slot): number {
    const next = this.slots[slot.pageIndex];
    return next === undefined ? this.element.scrollHeight : this.topOf(next);
  }

  /**
   * Lay out pages until every placeholder within `loadMargin` screenfuls of
   * the visible area has been replaced by its text. Only one of these ever
   * runs at a time; a call made while one is in flight joins it, and since the
   * loop re-checks the scroll position after every page, whatever prompted
   * that call is handled before it returns.
   */
  private fill(): Promise<void> {
    if (this.filling !== null) { return this.filling; }
    this.filling = this.fillUntilFull().finally(() => { this.filling = null; });
    return this.filling;
  }

  private async fillUntilFull(): Promise<void> {
    for (;;) {
      // Whatever else we do, give up anything we have scrolled well past
      this.unrenderDistantPages();

      const slot = this.nextToRender();
      if (slot === null) { break; }
      await this.render(slot);
      // Laying out a page is expensive, so hand the browser back a frame
      // between every two of them, rather than locking up the scroll for as
      // long as it takes to catch up with the reader
      await nextFrame();
    }
  }

  /**
   * The placeholder nearest the visible area which is still within
   * `loadMargin` of it, this being the one whose text the reader is most
   * likely to want next - or `null` if there is no such placeholder left
   */
  private nextToRender(): Slot | null {
    const { top, bottom, center } = this.loadRegion();

    let nearest: Slot | null = null;
    let nearestDistance = Infinity;
    for (let i = this.firstSlotEndingBelow(top); i < this.slots.length; i++) {
      const slot = this.slots[i];
      const slotTop = this.topOf(slot);
      if (slotTop >= bottom) { break; }
      if (slot.page !== null) { continue; }
      const distance =
        Math.max(slotTop - center, center - this.bottomOf(slot), 0);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = slot;
      }
    }
    return nearest;
  }

  /**
   * The stretch of the scroll we want laid out: the visible area with
   * `loadMargin` of it added on either side
   */
  private loadRegion(): { top: number, bottom: number, center: number } {
    const { scrollTop, clientHeight } = this.element;
    const margin = loadMargin * clientHeight;
    return {
      top: scrollTop - margin,
      bottom: scrollTop + clientHeight + margin,
      center: scrollTop + clientHeight / 2,
    };
  }

  /**
   * The index of the first slot which ends below `y`, found by bisection - the
   * slots are in document order, and so in order of position, but there are
   * far too many of them to measure one by one
   */
  private firstSlotEndingBelow(y: number): number {
    let low = 0;
    let high = this.slots.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.bottomOf(this.slots[middle]) <= y) { low = middle + 1; }
      else { high = middle; }
    }
    return low;
  }

  /**
   * Load, build, and lay out the page a placeholder is standing in for,
   * keeping the content already on screen exactly where it was. Everything
   * after the `await` is synchronous, so the page is measured, typeset, and
   * paid for with a scroll correction all within one frame - the reader never
   * sees the intermediate, unstretched layout.
   */
  private async render(slot: Slot): Promise<TikkunPage> {
    const pageData = await loadPage(this.data.book, slot.pageIndex);
    // `goTo` and `fill` can both be waiting on the same page at once
    if (slot.page !== null) { return slot.page; }
    const page = new TikkunPage(pageData, this.translit);

    // A page we have not seen before is rarely exactly as tall as the
    // placeholder standing in for it - it is usually shorter, having been
    // scaled down to fit - so its text has to be paid for with a correction
    this.changeHeightOf(slot, () => {
      slot.fill(page);
      page.updatePages(this.left, this.right);
    });
    this.changed();
    return page;
  }

  /**
   * Take the text back out of a page, leaving its placeholder - fixed at the
   * height the page turned out to be - standing in the same room
   */
  private unrender(slot: Slot) {
    this.changeHeightOf(slot, () => slot.empty());
  }

  /**
   * Run `change`, which is expected to alter the height of `slot`, without
   * moving anything the reader can see
   */
  private changeHeightOf(slot: Slot, change: () => void) {
    const below = this.slots[slot.pageIndex];
    // A slot which starts at or below the top of the visible area only pushes
    // around what comes after it, which is either off screen or on its way
    // there anyway; one above it would push everything on screen down
    if (below === undefined || this.topOf(slot) >= this.element.scrollTop) {
      change();
      return;
    }
    const before = this.topOf(below);
    change();
    // Everything from `below` on has moved by exactly the change in height, so
    // taking that back out of the scroll puts it all back where it was
    this.element.scrollTop += this.topOf(below) - before;
  }

  /**
   * Give back every page which has fallen outside the stretch we want laid
   * out - except the one we are anchored to, which has to stay where it is.
   * Nothing inside that stretch is ever given up, since `fill` would only lay
   * it out again, and the stretch is only a couple of screenfuls tall, so this
   * is what keeps the number of rendered pages down.
   */
  private unrenderDistantPages() {
    for (const slot of this.renderedSlots) {
      if (this.anchor?.page === slot.page) { continue; }
      // Recomputed each time round, since giving a page up above the visible
      // area moves the whole scroll out from under the previous answer
      const { top, bottom } = this.loadRegion();
      if (this.bottomOf(slot) > top && this.topOf(slot) < bottom) { continue; }
      this.unrender(slot);
    }
  }

  /**
   * Forget every height measured by `Slot.empty`, which the change now being
   * made to the layout would leave wrong
   */
  private forgetMeasuredHeights() {
    for (const slot of this.slots) { slot.forgetHeight(); }
  }


  // ==========================================================
  //  Resizing, while keeping our place fixed
  //
  //  Here we are holding on to a line rather than a page, so
  //  everything is measured in client coordinates - a line's
  //  offset parent is its own page, not the scroll.
  // ==========================================================

  /**
   * A page is laid out by measuring its own text, in units which owe nothing
   * to the size of the window (see `main.css`), so a resize cannot change the
   * shape of a page - only how far it is scaled down to fit, which is cheap
   * enough to redo on every frame of a drag. What a resize does change is where the reader is, since every page around
   * them changes height as it is rescaled. So we hold on to the line which was
   * at the center of the screen when the drag began and put that same line
   * back after every frame - picking a new one each time would let the reader
   * drift over the course of the drag.
   */
  private onResize() {
    if (this.resizeIdleTimer === null) { this.captureAnchor(); }
    else { clearTimeout(this.resizeIdleTimer); }
    // Once the events stop the drag is over, and we can let go of the line it
    // was centered on - an anchor we never let go of would pin its page in the
    // scroll forever
    this.resizeIdleTimer = setTimeout(() => {
      this.resizeIdleTimer = null;
      this.anchor = null;
    }, resizeIdleMs);

    if (this.resizeFrame !== null) { return; }
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      this.relayout();
    });
  }

  /**
   * Rescale every rendered page to the room it now has, keeping the anchored
   * line in place. Unlike `withAnchor`, this keeps the anchor captured at the
   * start of the resize, rather than picking a new one each time.
   */
  private relayout() {
    for (const page of this.rendered) { page.updateScale(); }
    // Every page we have measured was measured at the old size
    this.forgetMeasuredHeights();
    this.restoreAnchor();
    void this.fill();
    this.changed();
  }

  /**
   * Run `change`, which is expected to alter the height of the content, with
   * the scroll locked to the line at the center of the screen
   */
  private withAnchor(change: () => void) {
    this.captureAnchor();
    try {
      change();
      this.restoreAnchor();
    }
    finally { this.anchor = null; }
    void this.fill();
  }

  /** The y coordinate of the center of the visible area, on screen */
  private get viewportCenter(): number {
    return this.element.getBoundingClientRect().top
         + this.element.clientHeight / 2;
  }

  /**
   * Remember the line currently nearest the center of the screen
   */
  private captureAnchor() {
    const center = this.viewportCenter;
    const nearest = this.lineNearest(center);
    this.anchor = nearest === null ? null : {
      ...nearest,
      offsetFromCenter: lineCenter(nearest.page.leftLines[nearest.lineIndex])
                      - center,
    };
  }

  /**
   * Scroll so that the line remembered by `captureAnchor` is back where it was
   * relative to the center of the screen
   */
  private restoreAnchor() {
    if (this.anchor === null) { return; }
    const { page, lineIndex, offsetFromCenter } = this.anchor;
    const line: HTMLTableRowElement | undefined = page.leftLines[lineIndex];
    if (line === undefined || !line.isConnected) { return; }
    this.element.scrollTop +=
      lineCenter(line) - (this.viewportCenter + offsetFromCenter);
  }

  /**
   * The rendered line whose center is closest to the y coordinate `y`. We scan
   * the lines rather than using `elementFromPoint`, since the center of the
   * screen falls in the gap between the two visible pages, and since the pages
   * may be scaled by a transform (which `getBoundingClientRect` accounts for,
   * so all of these coordinates remain comparable).
   */
  private lineNearest(y: number):
      { page: TikkunPage, lineIndex: number } | null {
    let nearest: { page: TikkunPage, lineIndex: number } | null = null;
    let nearestDistance = Infinity;
    for (const page of this.rendered) {
      page.leftLines.forEach((line, lineIndex) => {
        const distance = Math.abs(lineCenter(line) - y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = { page, lineIndex };
        }
      });
    }
    return nearest;
  }
}

function lineCenter(line: HTMLElement): number {
  const box = line.getBoundingClientRect();
  return box.top + box.height / 2;
}

/** Resolve on the next animation frame */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
