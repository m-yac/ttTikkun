import { type Fragment, type PageData } from "./data";
import { fragmentText, ketiv, kri, expandAnnotation, pageElement } from "./tikkun";
import { Text as HavarotjsText } from 'havarotjs';
import { Transliteration } from "./transliteration";

/**
 * The base class for every type of page (ketiv, kri, etc.)
 */
export abstract class Page {
  readonly data: PageData;
  abstract cssClass: string;
  abstract dir: 'ltr' | 'rtl';

  abstract onFragment: (fragment: Fragment) => (string | Node)[];

  constructor(data: PageData) {
    this.data = data;
  }
  
  get element(): HTMLTableElement {
    const pageTable = pageElement(this.data, this.onFragment);
    pageTable.classList.add(this.cssClass);
    pageTable.dir = this.dir;
    return pageTable;
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

  onFragment = (fragment: Fragment): (string | Node)[] => {
    return fragment.flatMap(({en}) => en.flatMap((chunk) => {
      const node = expandAnnotation(chunk.text, 'implied-word');
      return [...node, new Text(' ')];
    }));
  }
}
