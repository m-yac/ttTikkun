import { type Fragment, type PageData } from "./data";
import { fragmentText, ketiv, kri, expandAnnotation, pageElement } from "./tikkun";
import { Text as HavarotjsText } from 'havarotjs';
import { Transliteration } from "./transliteration";

// ================
//  Helper classes
// ================

/**
 * The superclass for all the classes in this file (`Column`, `Page`, and
 * `TikkunPage`), consisting of some common abstract methods and an interface
 * that wraps an `HTMLElement`
 */
abstract class PageElement {
  /**
   * Load any prerequisites needed during the implementation of 
   * `ensureNoLineWraps` - by default does nothing
   */
  async loadPrerequisites(): Promise<void> {}

  /**
   * Modify this element's style to ensure that no child line-wraps
   */
  abstract ensureNoLineWraps(): void;

  /**
   * The `HTMLElement` representing this element
   */
  abstract get element(): HTMLElement;

  // Wrappers around some `HTMLElement` methods
  get classList(): DOMTokenList {
    return this.element.classList;
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
      const tops = [...range.getClientRects()]
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => rect.top)
        .sort((a, b) => a - b);
      // Rects on the same line need not have exactly the same top, so only
      // count a rect as starting a new line if it is more than a pixel below
      // the last
      if (!tops.every((top, i) => i === 0 || top - tops[i - 1] <= 1)) {
        return false;
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
 * The base class for every type of page
 */
export abstract class Page extends PageElement {
  readonly data: PageData;
  readonly minFontStretch: number = 100;
  abstract type: PageType;

  // Has to be optional because the abstract `onFragment` can't be called in
  // the constructor
  private optElement?: HTMLTableElement;

  abstract onFragment: (fragment: Fragment) => (string | Node)[];

  constructor(data: PageData) {
    super();
    this.data = data;
  }

  async loadPrerequisites(): Promise<void> {
    const style = getComputedStyle(this.element);
    await document.fonts.load([style.fontStyle, style.fontWeight,
                               style.fontSize, style.fontFamily].join(' '));
  }

  ensureNoLineWraps(): void {
    const d = dir[this.type];
    this.whileTemporarilyVisible(() =>
      this.querySelectorAll('.column').map((col) =>
        new Column(col, this.minFontStretch, d).ensureNoLineWraps()));
  }
  
  get element(): HTMLTableElement {
    if (this.optElement === undefined) {
      this.optElement = pageElement(this.data, this.onFragment);
      this.optElement.classList.add(this.type);
      this.optElement.dir = dir[this.type];
    }
    return this.optElement;
  }

  // We override `width` since a page may not always be visible
  get width(): number {
    return this.whileTemporarilyVisible(() => super.width);
  }

  set width(width: number) {
    this.style.width = `${width}px`;
  }

  private whileTemporarilyVisible<T>(callback: () => T): T {
    // Save the old value of the display style
    const displayBefore = this.style.display;
    // Set the display style to `table` (i.e. not `none`)
    this.style.display = 'table';
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

  onFragment = (fragment: Fragment): (string | Node)[] => {
    return [ketiv(fragmentText(fragment))];
  }
}

/**
 * The class for a page of kri
 */
export class KriPage extends Page {
  type = 'kri' as const;

  onFragment = (fragment: Fragment): (string | Node)[] => {
    return expandAnnotation(kri(fragmentText(fragment)), 'ketiv-kri');
  }
}

/**
 * The class for a page of transliteration
 */
export class TranslitPage extends Page {
  type = 'tl' as const;
  readonly translit: Transliteration;

  constructor(data: PageData, translit: Transliteration) {
    super(data);
    this.translit = translit;
  }

  onFragment = (fragment: Fragment): (string | Node)[] => {
    if (fragment.length === 0) { return []; }
    const text = kri(fragmentText(fragment));
    const opts = this.translit.syllabificationOptions;
    const words = new HavarotjsText(text, opts).words;
    const tlWords = words.map((word) => word.apply(this.translit));
    return expandAnnotation(tlWords.join(' '), 'ketiv-kri');
  }
}

/**
 * The class for a page of English translation
 */
export class EnglishPage extends Page {
  type = 'en' as const;
  minFontStretch = 62.5;

  onFragment = (fragment: Fragment): (string | Node)[] => {
    return fragment.flatMap(({en}) => en.flatMap((chunk) => {
      const node = expandAnnotation(chunk.text, 'implied-word');
      return [...node, new Text(' ')];
    }));
  }
}


// ==============
//  Tikkun pages
// ==============

/**
 * A set of of pages, two of which are shown side-by-side at a time
 */
export class TikkunPage extends PageElement {
  readonly element: HTMLElement;
  readonly pages: Record<PageType, Page>;
  private left: PageType = 'ketiv';
  private right: PageType = 'kri';

  constructor(data: PageData, translit: Transliteration) {
    super();
    this.pages = {
      ketiv: new KetivPage(data),
      kri: new KriPage(data),
      tl: new TranslitPage(data, translit),
      en: new EnglishPage(data),
    };
    this.element = document.createElement('div');
    this.classList.add('tikkun-page');
    for (const page of pageTypes) {
      this.element.append(this.pages[page].element);
    }
    window.addEventListener('resize', () => this.updatePages());
  }

  async loadPrerequisites(): Promise<void> {
    for (const page of pageTypes) {
      await this.pages[page].loadPrerequisites();
    }
  }

  ensureNoLineWraps(): void {
    const ketivWidth = this.pages['ketiv'].width;
    for (const page of pageTypes) {
      this.pages[page].width = ketivWidth;
      this.pages[page].ensureNoLineWraps();
    }
    this.updatePages([this.left, this.right]);
  }

  get leftPage() { return this.left; }
  get rightPage() { return this.right; }

  updateLeftPage(left: PageType) { this.updatePages([left, this.right]); }
  updateRightPage(right: PageType) { this.updatePages([this.left, right]); }

  updatePages(pages?: [PageType, PageType]) {
    // Only change page visibility when the two pages are actually different
    if (pages !== undefined && pages[0] !== pages[1]) {
      [this.left, this.right] = pages;
      this.classList.remove(...pageTypes.map((page) => `show-${page}`));
      this.classList.add(`show-${this.left}`, `show-${this.right}`);
      // Reverse the layout if the page that's supposed to be on the left
      // actually comes after the page that's supposed to be on the right
      this.classList.toggle('is-reversed',
        pageTypes.indexOf(this.left) > pageTypes.indexOf(this.right));
    }
    this.style.transform = '';
    // The pages which are not currently shown contribute nothing to this width
    const width = this.getContentWidth(':scope > table');
    const available = document.documentElement.clientWidth;
    if (width > available) {
      this.style.transform = `scale(${available / width})`;
    }
  }
}
