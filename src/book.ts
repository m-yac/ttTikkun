// ============================================================
//  A scrolling view of a book [GENERATED ENTIRELY BY AI]
// ============================================================

import { books, loadPage, type Book, type LookupEntry } from "./data";
import { pageTypes, TikkunPage, type PageType } from "./page";
import { Transliteration } from "./transliteration";

/**
 * Load the font every type of page is set in, as named by the `--*-font`
 * custom properties on the `book` element (see `main.css`).
 *
 * Until a page's font has loaded its text is laid out in a fallback font, and
 * so cannot be usefully measured - so this must resolve before any of the
 * `TikkunPage`s in `book` are laid out.
 */
async function loadPageFonts(book: HTMLElement): Promise<void> {
  const style = getComputedStyle(book);
  // The size in a font shorthand is required but irrelevant here, since which
  // faces get loaded depends only on the family, the style, and the weight
  await Promise.all(pageTypes.map((type) =>
    document.fonts.load(`1em ${style.getPropertyValue(`--${type}-font`)}`)));
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
 * The maximum number of pages to keep rendered at once. Every rendered page
 * costs us a full (and fairly expensive) layout whenever the window is
 * resized, so we keep only what we need: the visible page, plus enough on
 * either side to cover `loadMargin`.
 */
const maxRenderedPages = 3;

/**
 * How long after the last `resize` event we consider a burst of resizes to be
 * over, in milliseconds
 */
const resizeIdleMs = 200;

/**
 * One page of the book as it appears in the scroll: either a `TikkunPage`
 * which has been built and laid out, or - until we have got to it - a blank
 * placeholder which is about as tall as that page will turn out to be (see
 * `.placeholder-tikkun-page` in `main.css`, which is where that height comes from).
 *
 * Making a placeholder costs nothing, while building and laying out a page
 * costs most of a frame, so a page always goes into the scroll as a
 * placeholder first: that way the reader can carry on scrolling into it
 * immediately, and we put the text in behind them (see `fill`).
 */
class Slot {
  readonly pageIndex: number;
  private placeholder: HTMLElement;
  private tikkunPage: TikkunPage | null = null;

  constructor(pageIndex: number) {
    this.pageIndex = pageIndex;
    this.placeholder = document.createElement('div');
    this.placeholder.classList.add('placeholder-tikkun-page');
  }

  /** The page in this slot, or `null` if it is still a placeholder */
  get page(): TikkunPage | null { return this.tikkunPage; }

  /** Whatever is currently standing in this slot */
  get element(): HTMLElement {
    return this.tikkunPage?.element ?? this.placeholder;
  }

  /**
   * Put `page` in the scroll in place of this slot's placeholder. The page
   * still has to be laid out afterwards - it has no size worth speaking of
   * until it is.
   */
  fill(page: TikkunPage) {
    this.placeholder.replaceWith(page.element);
    this.tikkunPage = page;
  }

  remove() { this.element.remove(); }
}

/**
 * A scrolling view of a whole book, which renders only the pages near the
 * visible area and loads more as the user scrolls in either direction. This
 * takes the place of `tikkun.io`'s `infinite-scroller.ts`, but differs from it
 * in three ways worth noting:
 *
 * - Pages are dropped once they get far enough away, instead of accumulating
 *   forever. (We can afford to keep them even less than `tikkun.io` can, since
 *   each of our pages carries up to four typeset copies of its text.)
 * - Loading is driven by a single re-entrant `fill` loop which runs until the
 *   margins on both sides are satisfied, rather than by one fetch per `scroll`
 *   event - which never gets started if the initial content is shorter than
 *   the window, and falls behind if the user scrolls quickly. However fast the
 *   reader scrolls, the loop keeps extending the scroll ahead of them: room
 *   for a page is made as soon as it is asked for (`extend`), and the page
 *   itself is laid out into that room a frame at a time afterwards (`render`).
 * - Everything which changes the height of the content - inserting a page
 *   above the viewport, dropping one, filling in a placeholder, resizing,
 *   switching page types - is wrapped in an explicit scroll correction, and
 *   native scroll anchoring is turned off (see `overflow-anchor` in
 *   `main.css`) so that the two cannot fight each other.
 */
export class TikkunBook {
  /** The scrolling container which holds every rendered `TikkunPage` */
  readonly element: HTMLElement;
  readonly book: Book;
  private readonly translit: Transliteration;
  private readonly pageCount: number;

  /** The pages currently in the scroll, in order, with contiguous numbers */
  private slots: Slot[] = [];
  private left: PageType = 'ketiv';
  private right: PageType = 'en';

  /** The `fill` currently in progress, if any */
  private filling: Promise<void> | null = null;

  /**
   * The line to keep in place, for as long as whatever is moving the content
   * around is still going on - see `withAnchor` and `onResize`
   */
  private anchor: Anchor | null = null;
  private resizeFrame: number | null = null;
  private resizeIdleTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(element: HTMLElement, book: Book,
                      translit: Transliteration) {
    this.element = element;
    this.book = book;
    this.translit = translit;
    this.pageCount = books[book].pageCount;

    this.element.classList.add('tikkun-book');
    // How tall `main.css` makes a placeholder for a page we have not laid out
    // yet: the room a page of this book needs when it has the standard number
    // of lines and is not scaled down to fit
    this.element.style.setProperty('--standardNumLines',
                                   String(books[book].standardNumLines));
    this.element.addEventListener('scroll', () => { void this.fill(); },
                                  { passive: true });
    window.addEventListener('resize', () => this.onResize());
  }

  /**
   * Create a `TikkunBook` in `element` and scroll it to the given line
   */
  static async open(element: HTMLElement, book: Book,
                    translit: Transliteration,
                    at: LookupEntry): Promise<TikkunBook> {
    const tikkunBook = new TikkunBook(element, book, translit);
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
    for (const slot of this.slots) { slot.remove(); }
    this.slots = [];
    this.anchor = null;

    const slot = new Slot(page);
    this.element.append(slot.element);
    this.slots.push(slot);
    const tikkunPage = await this.render(slot);

    this.anchor = { page: tikkunPage, lineIndex: line, offsetFromCenter: 0 };
    try {
      // Fill in the pages around the target line first - only once there is
      // content above it can we actually scroll it to the center
      await this.fill();
      this.restoreAnchor();
    }
    finally { this.anchor = null; }
    // Now fill in whatever that scroll uncovered
    await this.fill();
  }

  /** Every page in the scroll which has actually been built */
  private get rendered(): TikkunPage[] {
    const pages: TikkunPage[] = [];
    for (const slot of this.slots) {
      if (slot.page !== null) { pages.push(slot.page); }
    }
    return pages;
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
    });
  }

  updateLeftPage(left: PageType) { this.updatePages(left, this.right); }
  updateRightPage(right: PageType) { this.updatePages(this.left, right); }


  // ==================
  //  Loading pages in
  // ==================

  /**
   * Make room for and then lay out pages until there is at least `loadMargin`
   * screenfuls of content above and below the visible area (or until we run
   * out of book).
   *
   * Only one of these ever runs at a time; a call made while one is in flight
   * joins it, and since the loop re-checks the scroll position after every
   * page, whatever prompted the second call is handled before it returns.
   */
  private fill(): Promise<void> {
    if (this.filling !== null) { return this.filling; }
    this.filling = this.fillUntilFull().finally(() => { this.filling = null; });
    return this.filling;
  }

  private async fillUntilFull(): Promise<void> {
    for (;;) {
      // Whatever else we do, get rid of anything we have scrolled well past
      this.dropDistantPages();
      // Make room for as many pages as the margins are short of, all at once
      // and without waiting for any of them to be built - the reader can
      // scroll on into that room while we are still filling it in
      this.extend();

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
   * Add placeholders at whichever ends of the scroll are within `loadMargin`
   * of the visible area, until neither is (or we run out of book).
   *
   * This is what keeps a fast scroll from ever running out of room: a
   * placeholder costs nothing but a `div` of about the right height, so
   * however far the reader gets ahead of us, the scroll gets that far ahead
   * of them.
   */
  private extend() {
    for (;;) {
      const { scrollTop, scrollHeight, clientHeight } = this.element;
      const above = scrollTop;
      const below = scrollHeight - scrollTop - clientHeight;
      const first = this.slots[0]?.pageIndex ?? 1;
      const last = this.slots[this.slots.length - 1]?.pageIndex ?? 0;

      if (below < loadMargin * clientHeight && last < this.pageCount) {
        const slot = new Slot(last + 1);
        this.element.append(slot.element);
        this.slots.push(slot);
      }
      else if (above < loadMargin * clientHeight && first > 1) {
        const slot = new Slot(first - 1);
        // Everything already on screen has to stay where it is, and the page
        // we are putting above it is going to push it all down
        this.keepInPlace(this.slots[0]?.element, () => {
          this.element.prepend(slot.element);
          this.slots.unshift(slot);
        });
      }
      else { return; }
    }
  }

  /**
   * The placeholder nearest the visible area, which is the one whose text the
   * reader is most likely to want next
   */
  private nextToRender(): Slot | null {
    const center = this.viewportCenter;
    let nearest: Slot | null = null;
    let nearestDistance = Infinity;
    for (const slot of this.slots) {
      if (slot.page !== null) { continue; }
      const box = slot.element.getBoundingClientRect();
      const distance = Math.max(box.top - center, center - box.bottom, 0);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = slot;
      }
    }
    return nearest;
  }

  /**
   * Load, build, and lay out the page a placeholder is standing in for,
   * keeping the content already on screen exactly where it was.
   *
   * Everything after the `await` is synchronous, so the page is measured,
   * typeset, and paid for with a scroll correction all within one frame - the
   * user never sees the intermediate, unstretched layout.
   */
  private async render(slot: Slot): Promise<TikkunPage> {
    const data = await loadPage(this.book, slot.pageIndex);
    // The slot may have been dropped while its data was being loaded
    const index = this.slots.indexOf(slot);
    const page = new TikkunPage(data, this.translit);
    if (index < 0) {
      slot.fill(page);
      page.updatePages(this.left, this.right);
      return page;
    }

    // A page is rarely exactly as tall as the placeholder standing in for it -
    // it is usually shorter, having been scaled down to fit - so if it begins
    // above the visible area we hold on to what comes after it, and its text
    // then appears without moving anything else
    const above = slot.element.getBoundingClientRect().top < this.viewportTop;
    this.keepInPlace(above ? this.slots[index + 1]?.element : undefined, () => {
      slot.fill(page);
      page.updatePages(this.left, this.right);
    });
    return page;
  }

  /**
   * Drop pages from whichever end is further from the visible area until we
   * are down to `maxRenderedPages`, never dropping the page we are anchored
   * to, and never dropping one which is still within `loadMargin` of the
   * visible area - that one would only be asked for again by `extend`
   */
  private dropDistantPages() {
    while (this.slots.length > maxRenderedPages) {
      const first = this.slots[0];
      const last = this.slots[this.slots.length - 1];
      const center = this.viewportCenter;
      const fromStart = center - first.element.getBoundingClientRect().bottom;
      const fromEnd = last.element.getBoundingClientRect().top - center;

      const dropStart = fromStart >= fromEnd;
      const slot = dropStart ? first : last;
      if (this.anchor?.page === slot.page) { break; }
      const margin = (0.5 + loadMargin) * this.element.clientHeight;
      if (Math.max(fromStart, fromEnd) < margin) { break; }

      if (dropStart) {
        // Whatever is left at the top of the scroll is on its way to becoming
        // the first page, and must not move while it does
        this.keepInPlace(this.slots[1].element, () => {
          slot.remove();
          this.slots.shift();
        });
      }
      else {
        slot.remove();
        this.slots.pop();
      }
    }
  }


  /**
   * Run `change`, which is expected to alter the height of the content above
   * the viewport, with `element` kept exactly where it was on screen
   */
  private keepInPlace(element: HTMLElement | undefined, change: () => void) {
    const before = element?.getBoundingClientRect().top;
    change();
    if (element !== undefined && before !== undefined) {
      this.element.scrollTop += element.getBoundingClientRect().top - before;
    }
  }


  // =========================================
  //  Resizing, while keeping our place fixed
  // =========================================

  /**
   * Each page's layout depends on how much room it has, so every page has to
   * be laid out again from scratch when the window is resized - which is far
   * too slow to do on every event of a drag. Instead, while the drag is going
   * on we only rescale each page to fit, which is cheap, and do the real
   * layout once the drag has settled.
   *
   * Throughout, we hold on to the line which was at the center of the screen
   * when the resize began, and put it back after every change - so the reader
   * keeps their place for the whole drag, instead of drifting as the pages
   * around them change height.
   */
  private onResize() {
    if (this.resizeIdleTimer === null) { this.captureAnchor(); }
    else { clearTimeout(this.resizeIdleTimer); }
    this.resizeIdleTimer = setTimeout(() => {
      this.resizeIdleTimer = null;
      this.relayout();
      // The drag is over, so stop holding on to the line it was centered on -
      // an anchor we never let go of would pin its page in the scroll forever
      this.anchor = null;
    }, resizeIdleMs);

    if (this.resizeFrame !== null) { return; }
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      this.relayout();
    });
  }

  /**
   * Apply `update` to every rendered page, keeping the anchored line in place.
   * Unlike `withAnchor`, this keeps the anchor captured at the start of the
   * resize, rather than picking a new one each time.
   */
  private relayout() {
    for (const page of this.rendered) { page.updateScale(); }
    this.restoreAnchor();
    void this.fill();
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

  /** The y coordinate of the top of the visible area */
  private get viewportTop(): number {
    return this.element.getBoundingClientRect().top;
  }

  /** The y coordinate of the center of the visible area */
  private get viewportCenter(): number {
    return this.viewportTop + this.element.clientHeight / 2;
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
   * The rendered line whose center is closest to the y coordinate `y`.
   *
   * We scan the lines rather than using `elementFromPoint`, since the center
   * of the screen falls in the gap between the two visible pages, and since
   * the pages may be scaled by a transform (which `getBoundingClientRect`
   * accounts for, so all of these coordinates remain comparable).
   */
  private lineNearest(y: number):
      { page: TikkunPage, lineIndex: number } | null {
    let nearest: { page: TikkunPage, lineIndex: number } | null = null;
    let nearestDistance = Infinity;
    for (const page of this.rendered) {
      const box = page.element.getBoundingClientRect();
      // Skip pages which cannot contain anything closer than what we have
      if (box.top - y > nearestDistance || y - box.bottom > nearestDistance) {
        continue;
      }
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
