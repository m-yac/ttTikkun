import { type Fragment, type PageData, type VerseRef } from "./data";
import { fragmentText, ketiv, kri, expandAnnotation, pageElement, verseRefElement, type VerseNumberType, OnFragment } from "./tikkun";
import { Text as HavarotjsText } from 'havarotjs';
import { Transliteration } from "./transliteration";
import { withBigLetters } from "./bigLetters";

// ==============================
//  Helper functions and classes
// ==============================

/**
 * Wrap every occurrence of the divine name in a `span.divine-name`
 */
export function wrapDivineName(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => {
    if (node instanceof Element) {
      node.replaceChildren(...wrapDivineName([...node.childNodes]));
      return [node];
    }
    if (!(node instanceof Text)) { return [node]; }
    return node.data.split(/(יהוה)/g).filter((part) => part !== '')
                    .map((part) => {
      if (part !== 'יהוה') { return new Text(part); }
      const span = document.createElement('span');
      span.classList.add('divine-name');
      span.append(part);
      return span;
    });
  });
}

/**
 * The superclass for all the classes in this file (`Column`, `Page`, and
 * `TikkunPage`), consisting of some common abstract methods and an interface
 * that wraps an `HTMLElement`
 */
abstract class PageElement<T extends HTMLElement = HTMLElement> {
  /**
   * Modify this element's style to ensure that no child line-wraps
   */
  abstract ensureNoLineWraps(): void;

  /**
   * The `HTMLElement` representing this element
   */
  abstract get element(): T;

  // Wrappers around some `HTMLElement` methods
  get classList(): DOMTokenList {
    return this.element.classList;
  }
  set isReversed(isReversed: boolean) {
    this.classList.toggle('is-reversed', isReversed);
  }
  get style(): CSSStyleDeclaration {
    return this.element.style;
  }
  get width(): number {
    return this.element.getBoundingClientRect().width;
  }
  querySelectorAll(selectors: string): HTMLElement[] {
    return [...this.element.querySelectorAll<HTMLElement>(selectors)];
  }

  /**
   * [THIS FUNCTION WAS GENERATED ENTIRELY BY AI]
   * The horizontal extent, in pixels, of the actual contents of the elements
   * matching `selectors`, ignoring any of their pseudo-elements. Unlike the
   * elements' own bounding boxes, this includes any content overflowing them,
   * and elements which are not currently displayed contribute nothing, since
   * their contents have no client rects.
   *
   * Note that this measures the contents as they are currently laid out, so
   * any scaling transform must be removed before calling this.
   */
  getContentWidth(selectors: string): number {
    let left = Infinity;
    let right = -Infinity;
    for (const element of this.querySelectorAll(selectors)) {
      const range = document.createRange();
      range.selectNodeContents(element);
      for (const rect of range.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0) { continue; }
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
      }
    }
    return right > left ? right - left : 0;
  }
}

/**
 * A wrapper for a `div` with class `.column`
 */
class Column extends PageElement {
  readonly element: HTMLElement;
  private readonly minFontStretch: number;
  private readonly dir: 'ltr' | 'rtl'

  constructor(element: HTMLElement, minFontStretch: number,
                                    dir: 'ltr' | 'rtl') {
    super();
    this.element = element;
    this.minFontStretch = minFontStretch;
    this.dir = dir;
  }

  set fontStretch(pct: number) {
    this.style.fontStretch = `${pct}%`;
  }

  ensureNoLineWraps() {
    if (this.isOneLine()) { return; }

    // If we wouldn't get everything on one line even with the minimum font
    // stretch, disable wrapping and use a CSS transform to scale our content
    // to fit in the required width
    this.fontStretch = this.minFontStretch;
    if (!this.isOneLine()) {
      this.style.whiteSpace = 'nowrap';
      // Get the actual width of the fragments in this column - which is surely
      // greater than `this.width`, the width the DOM wants us to occupy (and
      // the width we need to stretch our content into)
      const contentWidth = this.getContentWidth('.fragment');
      this.style.transform = `scaleX(${this.width / contentWidth})`;
      this.style.transformOrigin = this.dir === 'ltr' ? 'left' : 'right';
      return;
    }

    // Otherwise, binary search for the largest value for `style.fontStretch`
    // which keeps everything on one line, in tenths of a percentage
    let loTenths = Math.floor(this.minFontStretch * 10)
    let hiTenths = 1000;
    // While our range is more than at least one tenth wide...
    while (hiTenths - loTenths > 1) {
      const midTenths = Math.floor((loTenths + hiTenths) / 2);
      this.fontStretch = midTenths / 10;
      if (!this.isOneLine()) {
        // We must to go lower, so move our range down by half:
        // [lo, hi] -> [lo, mid]
        hiTenths = midTenths;
      }
      else {
        // We're able to go higher still, so move our range up by half:
        // [lo, hi] -> [mid, hi]
        loTenths = midTenths;
      }
    }
    this.fontStretch = loTenths / 10;
  }

  /**
   * [THIS FUNCTION WAS GENERATED ENTIRELY BY AI]
   * Whether the contents of `element` are laid out on at most one line. Only
   * the element's actual contents are measured, not any of its
   * pseudo-elements.
   */
  isOneLine(selectors='.fragment'): boolean {
    for (const element of this.querySelectorAll(selectors)) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()]
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .sort((a, b) => a.top - b.top);
      // Rects on the same line need not have the same top or height - e.g. a
      // `.divine-name` is set in another font - so instead of comparing tops,
      // count a rect as starting a new line only if it fails to overlap the
      // line so far by more than a pixel
      let bottom = -Infinity;
      for (const rect of rects) {
        if (rect.top >= bottom - 1) {
          if (bottom !== -Infinity) { return false; }
          bottom = rect.bottom;
        }
        else {
          bottom = Math.max(bottom, rect.bottom);
        }
      }
    }
    return true;
  }
}


// ================
//  Types of pages
// ================

export const pageTypes = ['ketiv', 'kri', 'tl', 'en'] as const;
export type PageType = typeof pageTypes[number];

export const dir: Record<PageType, 'ltr' | 'rtl'> = {
  ketiv: 'rtl', kri: 'rtl', tl: 'ltr', en: 'ltr'
};

/**
 * The base class for every type of page - where each page is a `div`
 * containing two `table`s: the text of the page itself, and the verse
 * references for each of its lines
 */
export abstract class Page extends PageElement<HTMLDivElement> {
  readonly data: PageData;
  readonly minFontStretch: number = 100;
  abstract readonly type: PageType;
  abstract readonly verseNumbers: VerseNumberType;

  // These have to be optional because the abstract property `type` can't be
  // accessed in the constructor
  private _element?: HTMLDivElement;
  private _pageTable?: HTMLTableElement;
  private _verseRefTable?: HTMLTableElement;

  abstract onFragment: OnFragment;

  constructor(data: PageData) {
    super();
    this.data = data;
  }

  ensureNoLineWraps(): void {
    const d = dir[this.type];
    this.whileTemporarilyVisible(() =>
      this.querySelectorAll('.column').map((col) =>
        new Column(col, this.minFontStretch, d).ensureNoLineWraps()));
  }

  get element(): HTMLDivElement {
    if (this._element === undefined) {
      this._element = document.createElement('div');
      this._element.classList.add('page', this.type);
      this._element.append(this.pageTable, this.verseRefTable);
    }
    return this._element;
  }

  get pageTable(): HTMLTableElement {
    if (this._pageTable === undefined) {
      this._pageTable = pageElement(this.data, this.onFragment);
      this._pageTable.dir = dir[this.type];
    }
    return this._pageTable;
  }

  get verseRefTable(): HTMLTableElement {
    if (this._verseRefTable === undefined) {
      this._verseRefTable = verseRefElement(this.data, this.verseNumbers);
      this._verseRefTable.classList.add('verse-ref');
    }
    return this._verseRefTable;
  }

  // We override `width` to refer to the width of just the text of this page
  // - or if `display` is `none`, what it would be if that was not the case
  get width(): number {
    return this.whileTemporarilyVisible(() =>
      this.pageTable.getBoundingClientRect().width);
  }

  set width(width: number) {
    this.pageTable.style.width = `${width}px`;
  }

  private whileTemporarilyVisible<T>(callback: () => T): T {
    // Save the old value of the display style
    const displayBefore = this.style.display;
    // Set the display style to `flex` (i.e. not `none`)
    this.style.display = 'flex';
    const ret = callback();
    // Restore whatever display style we had at the start
    this.style.display = displayBefore;
    return ret;
  }
}

/**
 * The class for a page of ketiv
 */
export class KetivPage extends Page {
  type = 'ketiv' as const;
  verseNumbers = 'none' as const;

  onFragment = (lineIndex: number, fragment: Fragment) => {
    return withBigLetters(this.data, lineIndex, fragment, ketiv,
      [ketiv(fragmentText(fragment))]
    );
  }
}

/**
 * The class for a page of kri
 */
export class KriPage extends Page {
  type = 'kri' as const;
  verseNumbers = 'hebrew' as const;

  onFragment = (lineIndex: number, fragment: Fragment) => {
    return withBigLetters(this.data, lineIndex, fragment, kri,
      expandAnnotation(kri(fragmentText(fragment)), 'ketiv-kri')
    );
  }
}

/**
 * The class for a page of transliteration
 */
export class TranslitPage extends Page {
  type = 'tl' as const;
  verseNumbers = 'hindu-arabic' as const;
  readonly translit: Transliteration;

  constructor(data: PageData, translit: Transliteration) {
    super(data);
    this.translit = translit;
  }

  onFragment = (_: number, fragment: Fragment, verses: VerseRef[]) => {
    if (fragment.length === 0) { return []; }
    const text = kri(fragmentText(fragment));
    const opts = this.translit.syllabificationOptions;
    // Drop any whitespace-only words since we will add whitespace ourselves
    const words = new HavarotjsText(text, opts).words
                      .filter((word) => word.text.trim() !== '');
    const tlWords = words.map((word, i) => {
      const tlWord = word.apply(this.translit);
      // If we're the first word and it begins its verse, or the previous word
      // ends a verse...
      if (i === 0 && verses[fragment[0].verseIndex].indexOfFirstWord === 0 ||
          i  >  0 && words[i - 1].text.includes('׃')) {
        // Uppercase its first lowercase (unicode!) character
        return tlWord.replace(/\p{Ll}/u, (c) => c.toUpperCase());
      } 
      return tlWord;
    });
    return expandAnnotation(tlWords.join(' '), 'ketiv-kri');
  }
}

/**
 * The class for a page of English translation
 */
export class EnglishPage extends Page {
  type = 'en' as const;
  verseNumbers = 'hindu-arabic' as const;
  minFontStretch = 50;

  onFragment = (_: number, fragment: Fragment): (string | Node)[] => {
    return fragment.flatMap(({en}) => en.flatMap((chunk) => {
      const nodes = wrapDivineName(expandAnnotation(chunk.text, 'implied-word'));
      // Only add a space if we don't end in a hyphen
      if (/-[}\s]*$/.test(chunk.text)) { return nodes; }
      return [...nodes, new Text(' ')];
    }));
  }
}


// ==============
//  Tikkun pages
// ==============

/**
 * A set of pages, two of which are shown side-by-side at a time
 */
export class TikkunPage extends PageElement<HTMLDivElement> {
  readonly element: HTMLDivElement;
  readonly data: PageData;
  readonly pages: Record<PageType, Page>;

  private left: PageType = 'ketiv';
  private right: PageType = 'en';
  private appended = new Set<PageType>();
  private hasNoLineWraps = new Set<PageType>();
  private ketivWidth: number | null = null;
  private unscaled: { width: number, height: number } | null = null;

  constructor(data: PageData, translit: Transliteration) {
    super();
    this.data = data;
    this.pages = {
      ketiv: new KetivPage(data),
      kri: new KriPage(data),
      tl: new TranslitPage(data, translit),
      en: new EnglishPage(data),
    };
    this.element = document.createElement('div');
    this.element.classList.add('tikkun-page');
    this.element.dataset.index = String(data.index);
  }

  private ensureAppended(page: PageType) {
    if (!this.appended.has(page)) {
      this.element.append(this.pages[page].element);
      this.appended.add(page);
    }
  }

  ensureNoLineWraps(): void {
    // This never changes, so only ever needs to be computed once
    if (this.ketivWidth === null) {
      this.ensureAppended('ketiv');
      this.ketivWidth = this.pages['ketiv'].width;
    }
    for (const page of [this.left, this.right]) {
      // The result of calling ensureNoLineWraps never changes, so only ever
      // needs to be called once per page type
      if (!this.hasNoLineWraps.has(page)) {
        this.ensureAppended(page);
        this.pages[page].width = this.ketivWidth;
        this.pages[page].ensureNoLineWraps();
        this.hasNoLineWraps.add(page);
      }
    }
  }

  get leftPage() { return this.left; }
  get rightPage() { return this.right; }

  updateLeftPage(left: PageType) { this.updatePages(left, this.right); }
  updateRightPage(right: PageType) { this.updatePages(this.left, right); }

  updatePages(left: PageType, right: PageType) {
    // Only change page visibility when the two pages are actually different
    if (left === right) { return; }

    // Reverse the layout of the page on the left so that the verse refs are
    // always on the outside
    this.pages[this.left].isReversed = false;
    this.pages[left].isReversed = true;

    this.classList.remove(`show-${this.left}`, `show-${this.right}`);
    this.classList.add(`show-${left}`, `show-${right}`);

    // Reverse the entire layout if the page that's supposed to be on the left
    // actually comes after the page that's supposed to be on the right
    this.isReversed = pageTypes.indexOf(left) > pageTypes.indexOf(right);

    [this.left, this.right] = [left, right];
    this.ensureNoLineWraps();
    this.updateScale();
  }

  updateScale() {
    // This never changes, so only ever needs to be computed once
    if (this.unscaled === null) {
      this.style.removeProperty('--page-scale');
      this.style.marginBottom = '';
      this.unscaled = {
        width: this.getContentWidth(':scope > .page'),
        height: this.element.offsetHeight
      };
    }
    const { width, height } = this.unscaled;
    const parentWidth = this.element.parentElement!.clientWidth;

    // Only update the scale if we're actually overflowing our parent
    if (width <= parentWidth) { return; }

    const scale = parentWidth / width;
    this.style.setProperty('--page-scale', String(scale));
    // [GENERATED BY AI] A transform doesn't affect layout, so the page would
    // still take up its full unscaled height in the scroll. We take the
    // difference back out of the gap below the page - we can't just set a
    // height, since that would clip the page's contents, which may overflow it
    // horizontally
    this.style.marginBottom = `calc(var(--page-gap) - ${height*(1-scale)}px)`;
  }

  get leftLines(): HTMLTableRowElement[] {
    return [...this.pages[this.left].pageTable.rows];
  }
}
