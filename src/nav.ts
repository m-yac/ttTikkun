// ===============================================
//  The bottom nav bar [GENERATED ENTIRELY BY AI]
// ===============================================

import { bookTitles } from "./data";
import { TikkunBook, type Verse } from "./book";
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
 * The numeric keys of one level of a `Lookup`, in order
 */
function keysOf(record: Record<number, unknown> | undefined): number[] {
  return Object.keys(record ?? {}).map(Number).sort((a, b) => a - b);
}

/**
 * Fill `select` with an option per value, unless it already has exactly
 * those options - rebuilding the list on every scroll event would throw away
 * the reader's place in an open dropdown
 */
function setOptions(select: HTMLSelectElement, values: number[],
                    label: (value: number) => string) {
  if (select.options.length === values.length &&
      values.every((v, i) => select.options[i].value === String(v))) {
    return;
  }
  select.replaceChildren(
    ...values.map((v) => new Option(label(v), String(v))));
}

/**
 * The three parts of a reference, each of which gets a dropdown of its own
 */
const refParts = ['book', 'chapter', 'verse'] as const;
type RefPart = typeof refParts[number];

/**
 * The reference in the middle of the bar: which verse is being read, as three
 * dropdowns - book, chapter, and verse. They follow the scroll, and choosing
 * from any of them jumps the book to the verse chosen.
 *
 * Everything they offer comes from the book's `Lookup`, which lists exactly
 * the chapters each book has and the verses each chapter has - so a choice
 * can never name a verse the book does not contain.
 */
class RefChoice {
  readonly element: HTMLDivElement;
  private readonly book: TikkunBook;
  private readonly selects:
    Record<RefPart, HTMLSelectElement>;
  /** The hidden copy of each dropdown's text which gives it its width */
  private readonly sizers: Record<RefPart, HTMLSpanElement>;

  constructor(book: TikkunBook) {
    this.book = book;
    this.element = document.createElement('div');
    this.element.className = 'nav-ref';

    this.selects = {} as Record<RefPart, HTMLSelectElement>;
    this.sizers = {} as Record<RefPart, HTMLSpanElement>;
    const fields = {} as Record<RefPart, HTMLSpanElement>;
    for (const which of refParts) { fields[which] = this.makeField(which); }

    const colon = document.createElement('span');
    colon.className = 'nav-ref-colon';
    colon.textContent = ':';
    this.element.append(fields.book, fields.chapter, colon, fields.verse);
  }

  /**
   * One dropdown, in a wrapper which is exactly as wide as the reference it
   * is currently showing - a bare `select` is instead as wide as its widest
   * option, which would leave 'Genesis 1:1' set out for 'Deuteronomy 34:12'.
   * So the dropdown is stretched over a hidden copy of the text it is showing
   * (see `nav-ref-sizer` in `main.css`), which is the only thing in the
   * wrapper actually laid out, and which `showSelected` keeps in step.
   */
  private makeField(which: RefPart): HTMLSpanElement {
    const select = document.createElement('select');
    select.className = `nav-ref-${which}`;
    select.setAttribute('aria-label', which);
    select.addEventListener('change', () => this.choose(which));
    this.selects[which] = select;

    const sizer = document.createElement('span');
    sizer.className = 'nav-ref-sizer';
    sizer.setAttribute('aria-hidden', 'true');
    this.sizers[which] = sizer;

    const field = document.createElement('span');
    field.className = 'nav-ref-field';
    field.append(select, sizer);
    return field;
  }

  /**
   * Set each dropdown's width to that of the option it is showing
   */
  private showSelected() {
    for (const which of refParts) {
      this.sizers[which].textContent =
        this.selects[which].selectedOptions[0]?.textContent ?? '';
    }
  }

  /**
   * Show `verse` as the verse being read, listing alongside it the books of
   * this book, the chapters of that book, and the verses of that chapter
   */
  update(verse: Verse | null) {
    // Before anything has been laid out there is no verse to show, and the
    // dropdowns are better left holding their last answer than emptied
    if (verse === null) { return; }
    const { lookup } = this.book.data;
    const titles = bookTitles[this.book.data.book];

    setOptions(this.selects.book, keysOf(lookup),
               (b) => titles[b] ?? String(b));
    this.selects.book.value = String(verse.book);

    setOptions(this.selects.chapter, keysOf(lookup[verse.book]), String);
    this.selects.chapter.value = String(verse.chapter);

    setOptions(this.selects.verse, keysOf(lookup[verse.book]?.[verse.chapter]),
               String);
    this.selects.verse.value = String(verse.verse);

    this.showSelected();
  }

  /**
   * Jump to the verse now chosen. A choice higher up the reference leaves the
   * ones below it naming something which may not exist - a book has no
   * chapter 40 just because the last one did - so those fall back to the
   * first of whatever the new choice does have.
   */
  private choose(changed: RefPart) {
    const { lookup } = this.book.data;
    const book = Number(this.selects.book.value);
    const chapters = lookup[book];
    if (chapters === undefined) { return; }

    const chapter = changed === 'book' ? keysOf(chapters)[0]
                                       : Number(this.selects.chapter.value);
    const verses = chapters[chapter];
    if (verses === undefined) { return; }

    const verse = changed === 'verse' ? Number(this.selects.verse.value)
                                      : keysOf(verses)[0];
    const at = verses[verse]?.refs[0];
    if (at === undefined) { return; }

    // Show where we are going before we get there, since laying the page out
    // takes a moment - `update` will confirm it once the scroll has settled
    this.update({ book, chapter, verse });
    void this.book.goTo(at);
  }
}

/**
 * The bar along the bottom of the book: which verse is being read, with a
 * choice of which page to show on either side of it
 */
export class NavBar {
  readonly element: HTMLElement;
  private readonly book: TikkunBook;
  private readonly ref: RefChoice;
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

    this.ref = new RefChoice(book);

    this.element.append(this.choices.left.element, this.ref.element,
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

    this.ref.update(this.book.currentVerse);
  }
}
