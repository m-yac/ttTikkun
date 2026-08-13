import { type Fragment, type PageData } from "./data";
import { fragmentText, ketiv, kri, expandAnnotation, pageElement } from "./tikkun";
import { Text as HavarotjsText } from 'havarotjs';
import { Transliteration } from "./transliteration";

/**
 * [THIS FUNCTION GENERATED ENTIRELY BY AI]
 * The number of lines the contents of `element` are laid out on. Only the
 * element's actual contents are measured, not any of its pseudo-elements.
 */
function countLines(element: Element): number {
  const range = document.createRange();
  range.selectNodeContents(element);
  const tops = [...range.getClientRects()]
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => rect.top)
    .sort((a, b) => a - b);
  // Rects on the same line need not have exactly the same top, so only count
  // a rect as starting a new line if it is more than a pixel below the last
  return tops.reduce((count, top, i) =>
    i > 0 && top - tops[i - 1] <= 1 ? count : count + 1, 0);
}

/**
 * The base class for every type of page (ketiv, kri, etc.)
 */
export abstract class Page {
  readonly data: PageData;
  readonly minFontStretch: number = 100;
  private pageTable?: HTMLTableElement;
  abstract cssClass: string;
  abstract dir: 'ltr' | 'rtl';

  abstract onFragment: (fragment: Fragment) => (string | Node)[];

  constructor(data: PageData) {
    this.data = data;
  }
  
  get element(): HTMLTableElement {
    if (this.pageTable === undefined) {
      this.pageTable = pageElement(this.data, this.onFragment);
      this.pageTable.classList.add(this.cssClass);
      this.pageTable.dir = this.dir;
    }
    return this.pageTable;
  }

  async ensureFontLoaded(): Promise<void> {
    const style = getComputedStyle(this.element);
    await document.fonts.load([style.fontStyle, style.fontWeight,
                               style.fontSize, style.fontFamily].join(' '));
  }

  private withSavedDisplay<T>(callback: () => T): T {
    // Save the old value of the display style
    const displayBefore = this.element.style.display;
    // Set the display style to `table` (i.e. not `none`)
    this.element.style.display = 'table';
    const ret = callback();
    // Restore whatever display style we had at the start
    this.element.style.display = displayBefore;
    return ret;
  }

  getWidth(): number {
    return this.withSavedDisplay(() =>
      this.element.getBoundingClientRect().width);
  }

  setWidth(width: number): void {
    this.element.style.width = `${width}px`;
  }

  ensureNoLineBreaks(): void {
    this.withSavedDisplay(() => {
      for (const fragment of this.element.querySelectorAll<HTMLElement>
                                                          ('.fragment')) {
        if (countLines(fragment) <= 1) { continue; }

        // If we wouldn't get everything on one line even with the minimum
        // font stretch, just disable wrapping and continue
        fragment.style.fontStretch = `${this.minFontStretch}%`;
        if (countLines(fragment) > 1) {
          fragment.style.whiteSpace = 'nowrap';
          continue;
        }

        // Otherwise, binary search for the largest value for
        // `style.fontStretch` which keeps everything on one line, in tenths
        // of a percentage
        let loTenths = Math.floor(this.minFontStretch * 10)
        let hiTenths = 1000;
        // While our range is more than at least one tenth wide...
        while (hiTenths - loTenths > 1) {
          const midTenths = Math.floor((loTenths + hiTenths) / 2);
          fragment.style.fontStretch = `${midTenths / 10}%`;
          if (countLines(fragment) > 1) {
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
        fragment.style.fontStretch = `${loTenths / 10}%`;
      }
    });
  }
}

/**
 * The class for a page of ketiv
 */
export class KetivPage extends Page {
  cssClass = 'ketiv';
  dir = 'rtl' as const;

  onFragment = (fragment: Fragment): (string | Node)[] => {
    return [ketiv(fragmentText(fragment))];
  }
}

/**
 * The class for a page of kri
 */
export class KriPage extends Page {
  cssClass = 'kri';
  dir = 'rtl' as const;

  onFragment = (fragment: Fragment): (string | Node)[] => {
    return expandAnnotation(kri(fragmentText(fragment)), 'ketiv-kri');
  }
}

/**
 * The class for a page of transliteration
 */
export class TranslitPage extends Page {
  cssClass = 'tl';
  dir = 'ltr' as const;
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
  cssClass = 'en';
  dir = 'ltr' as const;
  minFontStretch = 62.5;

  onFragment = (fragment: Fragment): (string | Node)[] => {
    return fragment.flatMap(({en}) => en.flatMap((chunk) => {
      const node = expandAnnotation(chunk.text, 'implied-word');
      return [...node, new Text(' ')];
    }));
  }
}
