// ===============================================
//  The bottom nav bar [GENERATED ENTIRELY BY AI]
// ===============================================

import { bookTitles } from "./data";
import { TikkunBook } from "./book";
import { dir, pageTypes, type PageType } from "./page";
import { Transliteration } from "./transliteration";
import { Text as HavarotjsText } from 'havarotjs';

/**
 * The sample of kri each button of that page type is labelled with - which
 * carries an accent so that the transliteration of it does too
 */
const KRI_SAMPLE = 'קְרִ֫י';

/**
 * The label on each type of page's button, which is a sample of that page:
 * either a fixed string, or - for the transliteration - one which depends on
 * the transliteration options in force
 */
const labels:
    Record<PageType, string | ((translit: Transliteration) => string)> = {
  ketiv: 'כתיב',
  kri: KRI_SAMPLE,
  tl: (translit) => transliterate(KRI_SAMPLE, translit),
  en: 'Translation',
};

/**
 * What each button is called, for a screen reader and on hover - the labels
 * themselves being samples of the text rather than names of it
 */
const names: Record<PageType, string> = {
  ketiv: 'Ketiv', kri: 'Kri', tl: 'Transliteration', en: 'English',
};

/**
 * Transliterate a word of Hebrew, as `TranslitPage` does - capitalized as it
 * would be at the start of a verse
 */
function transliterate(he: string, translit: Transliteration): string {
  const words = new HavarotjsText(he, translit.syllabificationOptions).words;
  // Uppercase its first lowercase (unicode!) character
  return words.map((word) => word.apply(translit)).join(' ')
              .replace(/\p{Ll}/u, (c) => c.toUpperCase());
}

/**
 * One side's set of buttons: a choice of which page to show on that side.
 * Choosing the page already shown on the *other* side would do nothing (see
 * `TikkunBook.updatePages`), so that button is disabled.
 */
class PageChoice {
  readonly element: HTMLDivElement;
  private readonly inputs: Record<PageType, HTMLInputElement>;

  constructor(side: 'left' | 'right', translit: Transliteration,
              choose: (page: PageType) => void) {
    this.element = document.createElement('div');
    this.element.className = 'checkboxContainer';
    this.element.setAttribute('role', 'radiogroup');
    this.element.setAttribute('aria-label', `${side} page`);

    this.inputs = {} as Record<PageType, HTMLInputElement>;
    for (const type of pageTypes) {
      const id = `nav-${side}-${type}`;

      const input = document.createElement('input');
      input.type = 'radio';
      input.id = id;
      input.name = `nav-${side}`;
      input.setAttribute('aria-label', names[type]);
      input.addEventListener('change', () => choose(type));

      // The label of each button is a line of the page it chooses, set in the
      // same style as that page - so the sample is written into a `span` of
      // that page's class, which the button's own styling has no say over
      const label = document.createElement('label');
      label.htmlFor = id;
      label.title = names[type];
      const sample = document.createElement('span');
      sample.className = type;
      sample.dir = dir[type];
      const text = labels[type];
      sample.textContent = typeof text === 'string' ? text : text(translit);
      label.append(sample);

      this.element.append(input, label);
      this.inputs[type] = input;
    }
  }

  /**
   * Show `shown` as this side's choice, and disable the button for `other`,
   * the page shown on the other side
   */
  update(shown: PageType, other: PageType) {
    for (const type of pageTypes) {
      this.inputs[type].checked = type === shown;
      this.inputs[type].disabled = type === other;
    }
  }
}

/**
 * The bar along the bottom of the book: which verse is being read, with a
 * choice of which page to show on either side of it
 */
export class NavBar {
  readonly element: HTMLElement;
  private readonly book: TikkunBook;
  private readonly ref: HTMLDivElement;
  private readonly choices: Record<'left' | 'right', PageChoice>;
  private frame: number | null = null;

  constructor(element: HTMLElement, book: TikkunBook,
              translit: Transliteration) {
    this.element = element;
    this.book = book;
    this.element.classList.add('nav-bar');

    this.choices = {
      left: new PageChoice('left', translit,
                           (page) => book.updateLeftPage(page)),
      right: new PageChoice('right', translit,
                            (page) => book.updateRightPage(page)),
    };

    this.ref = document.createElement('div');
    this.ref.className = 'nav-ref';

    this.element.append(this.choices.left.element, this.ref,
                        this.choices.right.element);

    // The book tells us as often as every scroll event, and where we are can
    // only be worked out by measuring, so we do it at most once a frame
    book.onChange(() => this.updateSoon());
    this.update();
  }

  private updateSoon() {
    if (this.frame !== null) { return; }
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  }

  /**
   * Put the bar back in step with the book
   */
  private update() {
    const { leftPage, rightPage } = this.book;
    this.choices.left.update(leftPage, rightPage);
    this.choices.right.update(rightPage, leftPage);

    const verse = this.book.currentVerse;
    this.ref.textContent = verse === null ? '' :
      `${bookTitles[this.book.data.book][verse.book] ?? ''} ` +
      `${verse.chapter}:${verse.verse}`;
  }
}
