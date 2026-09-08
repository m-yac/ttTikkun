// ===============================================
//  The bottom nav bar [GENERATED ENTIRELY BY AI]
// ===============================================

import { aliyahName, aliyahOrder, aliyotOf, bookTitles, divisionName,
         divisionOrder, divisionIsAlt, divisionYear, divisionPatternName,
         divisionsOf, lookupVerseRef, splitYearIndices, Aliyah, Division,
         FULL_KRIYAH, MAFTIR, type BookData, type LineVersesRef,
         type Reading, type TriennialPatternMap, type VerseRange,
         type VerseRef } from "./data";
import { holidayYears, loadCalendar, neverFalls,
         parashahYears } from "./calendar";
import { Holidays, NONE } from "./holidays";
import { TikkunBook, type Position, type Verse } from "./book";
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
 * Where the text of each type of page comes from, which the question mark
 * beside a side's buttons links to - the ketiv and the kri being two halves
 * of the same source, and the transliteration being made here out of the kri
 */
const sources: Record<PageType, string> = {
  ketiv: 'https://github.com/akivajgordon/tikkun.io#readme',
  kri: 'https://github.com/akivajgordon/tikkun.io#readme',
  tl: 'transliterate',
  en: 'https://git.door43.org/unfoldingWord/en_ult/#readme',
};

/**
 * The URL parameter each part of the aliyah reference is saved under, in the
 * order they are written into the URL (see `writeRef`) - which is the one
 * place to change to rename a parameter or to reorder them, every part of the
 * reference having to be named here for the URL to carry it at all.
 */
const refParams: Record<AliyahPart, string> = {
  reading: 'reading',
  day: 'day',
  aliyah: 'aliyah',
  division: 'var',
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
  private readonly source: HTMLAnchorElement;

  constructor(side: 'left' | 'right', translit: Transliteration,
              choose: (page: PageType) => void) {
    this.element = document.createElement('div');
    this.element.className = 'nav-pages';

    const buttons = document.createElement('div');
    buttons.className = 'checkboxContainer';
    buttons.setAttribute('role', 'radiogroup');
    buttons.setAttribute('aria-label', `${side} page`);

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

      buttons.append(input, label);
      this.inputs[type] = input;
    }

    // Where this side's text comes from, which is the one thing beside the
    // buttons rather than in among them - and so sits on the far side of
    // them, away from the middle of the bar
    this.source = document.createElement('a');
    this.source.className = 'nav-help';
    this.source.textContent = '?';
    this.source.target = '_blank';
    this.source.rel = 'noopener noreferrer';
    this.element.append(
      ...(side === 'left' ? [this.source, buttons] : [buttons, this.source]));
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
    this.source.href = sources[shown];
    const where = `${names[shown]} source`;
    this.source.title = where;
    this.source.setAttribute('aria-label', where);
  }
}

/**
 * The numeric keys of one level of a `VerseLookup`, in order
 */
function keysOf(record: Record<number, unknown> | undefined): number[] {
  return Object.keys(record ?? {}).map(Number).sort((a, b) => a - b);
}

/**
 * Fill `select` with an option per value, unless it already has exactly
 * those options - rebuilding the list on every scroll event would throw away
 * the reader's place in an open dropdown.
 *
 * `group` heads a run of options with a section naming what they have in
 * common, an empty heading being an option which stands on its own outside
 * every section. What makes a run one section is normally the heading it
 * carries, `key` being for the sections which are told apart by more than
 * they are named by - two of them headed the same way, yet not the same
 * section.
 */
function setOptions<T extends string | number>(
    select: HTMLSelectElement, values: readonly T[],
    label: (value: T) => string, group?: (value: T) => string,
    key?: (value: T) => string) {
  if (select.options.length === values.length &&
      values.every((v, i) => select.options[i].value === String(v))) {
    return;
  }
  if (group === undefined) {
    select.replaceChildren(
      ...values.map((v) => new Option(label(v), String(v))));
    return;
  }
  // The values arrive already in the order they are offered in, so a run of
  // them sharing a key is the section that run's heading names
  const keyOf = key ?? group;
  const children: (HTMLOptGroupElement | HTMLOptionElement)[] = [];
  let section: HTMLOptGroupElement | null = null;
  let sectionKey: string | null = null;
  for (const value of values) {
    const option = new Option(label(value), String(value));
    const heading = group(value);
    if (heading === '') {
      [section, sectionKey] = [null, null];
      children.push(option);
      continue;
    }
    if (section === null || sectionKey !== keyOf(value)) {
      section = document.createElement('optgroup');
      section.label = heading;
      sectionKey = keyOf(value);
      children.push(section);
    }
    section.append(option);
  }
  select.replaceChildren(...children);
}

/**
 * A piece of text between two of a line's dropdowns which is not itself a
 * choice - the ':' of 'Genesis 1:1', the brackets of 'Bereshit 1 (Year 1)'. `with` names the dropdown it belongs to rather than merely
 * standing beside, so that it goes with that dropdown when it is taken out of
 * the line - as each bracket belongs to the division it encloses, where the
 * colon belongs to neither the chapter nor the verse.
 */
type Fixed<Part extends string> =
  { text: string, className: string, with?: Part };

/**
 * One line of the reference: some dropdowns with fixed text in between, each
 * dropdown being only as wide as the option it is showing.
 *
 * A bare `select` is instead as wide as its widest option, which would leave
 * 'Genesis 1:1' set out for 'Deuteronomy 34:12'. So each dropdown is stretched
 * over a copy of the text it is showing (see `nav-ref-sizer` in `main.css`),
 * which is the only thing in its wrapper actually laid out, and which
 * `showSelected` keeps in step.
 *
 * That copy is also the only one of the two which is seen: a dropdown's own
 * text cannot be selected, so it is left invisible and out of the pointer's
 * way, and the text beneath it is selected and copied as any other text on
 * the page is. A click on the text - as against a drag which selected some of
 * it - is then what opens the dropdown, which is otherwise unreachable by
 * pointer.
 */
class RefLine<Part extends string> {
  readonly element: HTMLDivElement;
  protected readonly selects: Record<Part, HTMLSelectElement>;
  private readonly sizers: Record<Part, HTMLSpanElement>;
  /** Everything which is part of each dropdown, for `setShown` to hide */
  private readonly parts: Record<Part, HTMLElement[]>;

  constructor(parts: readonly (Part | Fixed<Part>)[],
              choose: (which: Part) => void) {
    this.element = document.createElement('div');
    this.element.className = 'nav-ref-line';
    this.selects = {} as Record<Part, HTMLSelectElement>;
    this.sizers = {} as Record<Part, HTMLSpanElement>;
    this.parts = {} as Record<Part, HTMLElement[]>;

    const partsOf = (which: Part) => this.parts[which] ??= [];

    for (const part of parts) {
      if (typeof part !== 'string') {
        const fixed = document.createElement('span');
        fixed.className = part.className;
        fixed.textContent = part.text;
        this.element.append(fixed);
        if (part.with !== undefined) { partsOf(part.with).push(fixed); }
        continue;
      }

      const select = document.createElement('select');
      select.className = `nav-ref-${part}`;
      select.setAttribute('aria-label', part);
      select.addEventListener('change', () => {
        choose(part);
        // A choice which leads nowhere - one this line cannot show - leaves
        // the dropdown holding an answer the text beside it does not
        this.showSelected();
      });
      this.selects[part] = select;

      // The text the dropdown is read from, which a screen reader is told to
      // pass over: it says exactly what the dropdown does, and the dropdown
      // is what carries the choice
      const sizer = document.createElement('span');
      sizer.className = 'nav-ref-sizer';
      sizer.setAttribute('aria-hidden', 'true');
      this.sizers[part] = sizer;

      const field = document.createElement('span');
      field.className = 'nav-ref-field';
      field.addEventListener('click', () => this.open(select));
      field.append(select, sizer);
      this.element.append(field);
      partsOf(part).push(field);
    }
  }

  /**
   * Open a dropdown, a click on the text standing in for it being the only
   * way to - unless that click was the end of a drag which selected some of
   * the text, which is a reader copying the reference rather than asking to
   * change it
   */
  private open(select: HTMLSelectElement) {
    if (window.getSelection()?.isCollapsed === false) { return; }
    select.focus();
    // A browser which will not open a dropdown for us leaves the reader the
    // keyboard, the dropdown being invisible to the pointer
    try { select.showPicker(); } catch { /* nothing else to try */ }
  }

  /**
   * Do something whenever the reader reaches for one of the dropdowns - hovers
   * over it, gives it the focus, or clicks it - which is what lets an answer
   * be worked out only once it is about to be wanted rather than on the way
   * in.
   *
   * A hover normally comes a good moment before the click it leads to, which
   * is time enough for the answer to be there by the time the dropdown opens.
   * Where it does not - a reader who clicks straight through, which on a touch
   * screen is the only way - the options are listed again underneath them.
   */
  protected onReach(which: Part, reach: () => void) {
    for (const element of this.parts[which] ?? []) {
      for (const event of ['pointerenter', 'focusin', 'click']) {
        element.addEventListener(event, reach);
      }
    }
  }

  /**
   * Show or hide one dropdown, along with whatever fixed text belongs to it -
   * for a part of the reference which has nothing to say about the reading
   * being shown
   */
  protected setShown(which: Part, shown: boolean) {
    for (const element of this.parts[which] ?? []) { element.hidden = !shown; }
  }

  /**
   * Set each dropdown's width to that of the option it is showing
   */
  protected showSelected() {
    for (const which of Object.keys(this.sizers) as Part[]) {
      this.sizers[which].textContent =
        this.selects[which].selectedOptions[0]?.textContent ?? '';
    }
  }
}

/**
 * The three parts of a verse reference, each of which gets a dropdown of its
 * own
 */
const versePartNames = ['book', 'chapter', 'verse'] as const;
type VersePart = typeof versePartNames[number];

/**
 * The first line of the reference: which verse is being read, as three
 * dropdowns - book, chapter, and verse. They follow the scroll, and choosing
 * from any of them jumps the book to the verse chosen.
 *
 * Everything they offer comes from the book's `VerseLookup`, which lists
 * exactly the chapters each book has and the verses each chapter has - so a
 * choice can never name a verse the book does not contain.
 */
class VerseChoice extends RefLine<VersePart> {
  private readonly book: TikkunBook;
  /** Told whenever a choice here is about to jump the book somewhere */
  private readonly jumping: () => void;

  constructor(book: TikkunBook, jumping: () => void) {
    super(['book', 'chapter',
           { text: ':', className: 'nav-ref-colon' }, 'verse'],
          (which) => this.choose(which));
    this.book = book;
    this.jumping = jumping;
  }

  /**
   * Show `verse` as the verse being read, listing alongside it the books of
   * this book, the chapters of that book, and the verses of that chapter
   */
  update(verse: Verse | null) {
    // Before anything has been laid out there is no verse to show, and the
    // dropdowns are better left holding their last answer than emptied
    if (verse === null) { return; }
    const { verseLookup } = this.book.data;
    const titles = bookTitles[this.book.data.book];

    setOptions(this.selects.book, keysOf(verseLookup),
               (b) => titles[b] ?? String(b));
    this.selects.book.value = String(verse.book);

    setOptions(this.selects.chapter, keysOf(verseLookup[verse.book]), String);
    this.selects.chapter.value = String(verse.chapter);

    setOptions(this.selects.verse,
               keysOf(verseLookup[verse.book]?.[verse.chapter]), String);
    this.selects.verse.value = String(verse.verse);

    this.showSelected();
  }

  /**
   * Jump to the verse now chosen. A choice higher up the reference leaves the
   * ones below it naming something which may not exist - a book has no
   * chapter 40 just because the last one did - so those fall back to the
   * first of whatever the new choice does have.
   */
  private choose(changed: VersePart) {
    const { verseLookup } = this.book.data;
    const book = Number(this.selects.book.value);
    const chapters = verseLookup[book];
    if (chapters === undefined) { return; }

    const chapter = changed === 'book' ? keysOf(chapters)[0]
                                       : Number(this.selects.chapter.value);
    const verses = chapters[chapter];
    if (verses === undefined) { return; }

    const verse = changed === 'verse' ? Number(this.selects.verse.value)
                                      : keysOf(verses)[0];
    const at = verses[verse]?.[0];
    if (at === undefined) { return; }

    // Show where we are going before we get there, since laying the page out
    // takes a moment - `update` will confirm it once the scroll has settled
    this.update({ book, chapter, verse });
    this.jumping();
    void this.book.goTo(at);
  }
}

/**
 * The four parts of an aliyah reference, each of which gets a dropdown of its
 * own - the day being one only a holiday has
 */
const aliyahPartNames = ['reading', 'day', 'aliyah', 'division'] as const;
type AliyahPart = typeof aliyahPartNames[number];

/**
 * The headings the readings which are not parashiyot are offered under in the
 * `reading` dropdown, the parashiyot being grouped by the book of the Torah
 * they are read from
 */
const HOLIDAYS = 'Holidays';
const SPECIAL_SHABBATOT = 'Additions for Special Shabbatot';

/**
 * The page hebcal describes a holiday on, where it is not the one its name
 * makes: a special shabbat of Chanukah is described among the days of
 * Chanukah, and Rosh Chodesh is described a month at a time and never as
 * itself, so a reading of it has no page of its own to be sent to (see
 * `sourceUrl`)
 */
const holidayPages: Record<string, string | null> = {
  'Shabbat Chanukah': 'chanukah',
  'Rosh Chodesh': null,
  'Shabbat Rosh Chodesh': null,
};

/** Hebcal's list of holidays, which is where a holiday with no page of its
 * own is described among the rest
 */
const HOLIDAY_LIST = 'https://www.hebcal.com/holidays/';

/**
 * A name as hebcal writes it into a URL: lowercased, without the apostrophes
 * it leaves out, and with its spaces written as dashes (this is
 * `urlFriendly` of `@hebcal/core`, which names the page of a parashah or of
 * a holiday)
 */
function urlName(name: string): string {
  return name.toLowerCase().replace(/'/g, '').replace(/ +/g, '-');
}

/**
 * What the reference is saved as in the URL: a parameter per dropdown of the
 * aliyah line, named as `refParams` names it - so that a reader who reloads
 * the page, or follows a link someone sent them, comes back to the reading
 * rather than to the top of the scroll.
 *
 * The verse line is not saved. A link is to a reading, not to a place within
 * it, so the aliyah is as far down as the URL goes.
 */
type SavedRef = Partial<Record<AliyahPart, string>>;

/** The parts the URL carries, in the order `refParams` names them */
const savedParts = Object.keys(refParams) as AliyahPart[];

/**
 * The reference the URL names, whatever it says - it being no better placed
 * than the reader to know which readings this book has (see `restore`)
 */
function readRef(): SavedRef {
  const params = new URLSearchParams(window.location.search);
  const ref: SavedRef = {};
  for (const part of savedParts) {
    const value = params.get(refParams[part]);
    if (value !== null) { ref[part] = value; }
  }
  return ref;
}

/**
 * What the URL would say for a reference: a parameter per part of it, as
 * `refParams` names them, alongside whatever else the URL already carries.
 *
 * A part with nothing to say - the day of a parashah, the occasion of a
 * holiday read only the one way - is left out rather than written empty, as
 * it is left out of the bar itself.
 */
function refSearch(ref: SavedRef): string {
  const params = new URLSearchParams(window.location.search);
  // The reference is written out afresh, in the order named above, rather
  // than each part left in whatever place the URL already had it - so that
  // the order is `refParams`' to say and not the incoming link's
  for (const part of savedParts) { params.delete(refParams[part]); }
  for (const part of savedParts) {
    const value = ref[part];
    if (value === undefined || value === NONE) { continue; }
    params.set(refParams[part], value);
  }
  return params.toString();
}

/**
 * Write a reference into the URL, either as a step of its own through the
 * history or in place of whatever the URL said before - and say whether
 * anything was written at all.
 *
 * The reference follows the scroll, so a reading passed through on the way
 * somewhere else is written in place of the one before it rather than being
 * one more step back through the history. A reading which cannot be read
 * back into is `push`ed instead, so that the reader can step back to it (see
 * `AliyahChoice.write`).
 *
 * A reference which says what the URL already does is not written again,
 * there being only so many of these a browser will take in a row.
 */
function writeRef(search: string, push: boolean): boolean {
  if (search === window.location.search.replace(/^\?/, '')) { return false; }
  const { pathname, hash } = window.location;
  const url = `${pathname}${search === '' ? '' : `?${search}`}${hash}`;
  if (push) { window.history.pushState(null, '', url); }
  else { window.history.replaceState(null, '', url); }
  return true;
}

/**
 * Which of the three kinds of reading the first dropdown offers one is: a
 * parashah, a holiday read on a day of its own, or a maftir added to a
 * Shabbat which reads its parashah as any other does
 */
type Kind = 'parashah' | 'holiday' | 'special';

/**
 * The doubled parashiyot which are shown as the two they join rather than as
 * themselves when the reader has said nothing either way - a pair being read
 * together more often than not, save for this one
 */
const SEPARATE_BY_DEFAULT = ['Chukat-Balak'];

/**
 * A doubled parashah and the two parashiyot it reads together
 */
type Pair = { doubled: string, singles: [string, string] };

/**
 * The ways one reading can be read: the days it falls on, and for each of
 * those the occasions that day can be - which for a parashah are its
 * `Division`s instead, filed under the one day `NONE` (see `readingsOf`)
 */
type Days = Partial<Record<string, Partial<Record<string, Reading>>>>;

/**
 * A reading and one of the ways of reading it: which day of it, and which
 * occasion that day is - which together are one reading of one day, and are
 * what the second line of the reference names besides the aliyah itself
 */
type Portion = { reading: string, day: string, division: string };

/**
 * A portion of a parashah, which is read on no day of its own - so its day is
 * always `NONE`, and the occasion it is filed under is one of the parashah's
 * `Division`s
 */
type ParashahPortion = Portion & { division: Division };

/**
 * Whether line `a` is `b` or comes before it in the book
 */
function atOrBefore(a: Position, b: Position): boolean {
  return a.page !== b.page ? a.page < b.page : a.line <= b.line;
}

/**
 * Whether the first ranking comes before the second, compared term by term -
 * each term mattering more than all of those after it (see `AliyahChoice`)
 */
function ranksBefore(a: number[], b: number[]): boolean {
  const at = a.findIndex((term, i) => term !== b[i]);
  return at !== -1 && a[at] < b[at];
}

/**
 * The verses one aliyah of a reading covers, as a run of one - and a run of
 * none for an aliyah the reading has not got
 */
function rangeOf(aliyot: Reading, n: Aliyah | null): VerseRange[] {
  const range = n === null ? undefined : aliyot[n];
  return range === undefined ? [] : [range];
}

/**
 * Which aliyah of a reading to show, given the one asked for: that one, where
 * the reading has it - and otherwise the last one before it, which only a
 * choice made higher up the reference can leave us asking for. Where nothing
 * was asked for at all it is the reading's first, and where the reading has
 * no aliyot there is none to show.
 */
function aliyahIn(aliyot: Reading,
                  wanted: Aliyah | undefined): Aliyah | undefined {
  const numbers = aliyotOf(aliyot);
  return wanted === undefined ? numbers[0]
    : aliyot[wanted] !== undefined ? wanted
    : numbers.filter((n) => aliyahOrder(n, wanted) < 0).pop() ?? numbers[0];
}

/**
 * The ways a reading can be read: every day it falls on, and for each of
 * those every occasion that day can be. A parashah is read on no day of its
 * own, so its divisions are all filed under the one day `NONE`.
 *
 * A day the calendar never comes round to is not one the reader can ever be
 * reading, so it is left out of every answer rather than only of the
 * dropdown - which is what keeps a reading carried over from the parashah
 * before from landing on one (see `divisionFor`). A day whose every
 * occasion goes that way is no day of ours either. A parashah needs no such
 * weeding: every division our data lists is one our calendar reads.
 */
function readingsOf(data: BookData, holidays: Holidays,
                    reading: string): Days | undefined {
  const parashah = data.aliyahLookup[reading];
  const all: Days | undefined = parashah !== undefined
    ? { [NONE]: parashah }
    : holidays.holidays[reading] ?? holidays.special[reading];
  if (all === undefined) { return undefined; }

  const read: Days = {};
  for (const day of Object.keys(all)) {
    const divisions = all[day] ?? {};
    const kept = parashah !== undefined ? divisions : Object.fromEntries(
      Object.entries(divisions).filter(([occasion]) =>
        !neverFalls(reading, day, occasion)));
    if (Object.keys(kept).length > 0) { read[day] = kept; }
  }
  return read;
}

/**
 * Which of a holiday's days and occasions to show it under, given the ones
 * asked for: no two holidays fall on quite the same set of days, so a reading
 * which has not got the day being asked for falls back to its first, and
 * likewise for the occasion within that day.
 */
function holidayPortion(days: Days, reading: string, day: string | undefined,
                        division: string | undefined): Portion {
  const on = day !== undefined && days[day] !== undefined
    ? day : Object.keys(days)[0];
  const divisions = days[on] ?? {};
  return { reading, day: on,
           division: division !== undefined && divisions[division] !== undefined
             ? division : Object.keys(divisions)[0] };
}

/**
 * Where the URL says to be: the portion it names, which aliyah of it, and
 * the line that aliyah begins on - or `null` where it names no reading this
 * book has, or none we can find a line for.
 *
 * Nothing is taken on trust: a URL is a reference from outside this book, and
 * may name a reading of another one, a division no parashah of ours is read
 * as, or nothing at all. A part it leaves out falls back the way a dropdown's
 * would - the division to the full kriyah, the day to the reading's first,
 * the aliyah to the first of whatever the portion has.
 */
function refPortion(data: BookData, holidays: Holidays):
    { portion: Portion, aliyah: Aliyah, at: LineVersesRef } | null {
  const ref = readRef();
  const { reading } = ref;
  if (reading === undefined) { return null; }
  const days = readingsOf(data, holidays, reading);
  if (days === undefined) { return null; }

  let portion: Portion;
  if (reading in data.aliyahLookup) {
    const chosen = Division.safeParse(ref.division);
    portion = { reading, day: NONE, division:
      chosen.success && divisionsOf(data.aliyahLookup, reading)
                          .includes(chosen.data)
        ? chosen.data : FULL_KRIYAH };
  }
  else {
    portion = holidayPortion(days, reading, ref.day, ref.division);
  }

  const aliyot = days[portion.day]?.[portion.division] ?? {};
  const asked = Aliyah.safeParse(ref.aliyah);
  const aliyah = aliyahIn(aliyot, asked.success ? asked.data : undefined);
  const begin = aliyah === undefined ? undefined : aliyot[aliyah]?.begin;
  const at = begin === undefined
    ? undefined : lookupVerseRef(data.verseLookup, begin)?.[0];
  return aliyah === undefined || at === undefined
    ? null : { portion, aliyah, at };
}

/**
 * The line the URL says to open this book at, or `null` where it says
 * nothing this book can answer - which is the caller's cue to open wherever
 * it would have anyway (see `main.ts`).
 *
 * The book is opened here rather than scrolled here once it is open, so that
 * a link lands on the reading it names instead of laying out a default spot
 * and then jumping away from it.
 */
export function refStart(data: BookData): LineVersesRef | null {
  return refPortion(data, new Holidays(data))?.at ?? null;
}

/**
 * The second line of the reference: which aliyah is being read, as four
 * dropdowns - 'Bereshit 1 (Year 1)', 'Yom Kippur Morning 3 (Shabbat)'. As
 * with the verse above it, they follow the scroll and choosing from any of
 * them jumps the book to the start of the aliyah chosen.
 *
 * A parashah is read on no day of its own, so the day is left out for one and
 * the brackets hold the year of the triennial cycle instead; a holiday whose
 * reading is the same on every day it can fall on has no occasion to name,
 * and one which falls on only the one day has no day, so each of those
 * dropdowns is there only where it has something to say.
 *
 * Where the reader is is taken as the line they are on rather than the verse
 * they are reading, since most aliyot begin partway through a line: the verse
 * the nav bar names for such a line is the one before the aliyah starts, and
 * going by that would report the aliyah before the one they had just asked
 * for.
 *
 * Every line is read as part of several portions - the full kriyah reads the
 * whole of a parashah, each year of the triennial cycle reads a part of it,
 * and a pair is read either as the doubled parashah or as the two it joins -
 * so the portion in force stands for as long as the reader is still within
 * it, and once they read past its end the portions which cover the line they
 * have reached are ranked and the best of them taken (see `portionAt`).
 *
 * A holiday's reading is offered alongside the parashiyot but is never
 * reached by reading: its aliyot are read on the day rather than in the order
 * of the scroll, and nothing about a line says it is one of them (see
 * `HolidayLookup`). So a holiday is shown only because the reader asked for
 * it, and only for as long as they are still within one of its aliyot - read
 * past the end of the one they are in and the parashiyot take over again.
 */
class AliyahChoice extends RefLine<AliyahPart> {
  private readonly book: TikkunBook;
  /** Every holiday reading of this book, under the names we give them */
  private readonly holidays: Holidays;
  /**
   * Where the book opens when the URL names no reading, which is what a step
   * back to a URL naming none takes the reader to (see `back`)
   */
  private readonly start: LineVersesRef;
  /**
   * Which parashah the reader is in, which they may have asked for. A holiday
   * is shown over the top of this rather than in place of it, so that reading
   * past the end of one picks the parashiyot up where they were left.
   */
  private parashah: string | null = null;
  /** Which of that parashah's divisions of aliyot is being shown */
  private division: Division = FULL_KRIYAH;
  /**
   * The holiday reading the reader asked for, while they are still within one
   * of its aliyot, and the aliyah of it they were last shown - which is what
   * keeps them in an aliyah which another of the same reading covers as well
   */
  private holiday: Portion | null = null;
  private holidayAliyah: Aliyah = '1';
  /**
   * Whether a jump is still going on. A jump scrolls through everything
   * between here and where it is going, and what it passes over says nothing
   * about what was asked for - least of all for a holiday, whose next aliyah
   * can be at the other end of the scroll.
   */
  private jumping = false;
  /**
   * Whether the maftir is the aliyah the reader last asked for. It is read as
   * part of the seventh aliyah as well, so it is never what a verse is shown
   * as being read as part of unless they have asked for it - and asking is
   * the only thing that settles it, since a jump to it scrolls through
   * several positions before it lands on the one they asked for.
   */
  private maftir = false;
  /**
   * Whether the reference is the reader's to keep track of yet, which it is
   * only once the page has opened where it is going to open: everything up
   * to that is the URL being read rather than written (see `restore`).
   */
  private started = false;
  /**
   * Whether the step of the history now showing is one of ours. The first
   * reference we write is written as a step of its own, so that a reader who
   * goes back from it comes to the page as they opened it - the URL they
   * followed, or the one they arrived at with nothing in it at all.
   */
  private ownEntry = false;
  /**
   * Whether the reference now in the URL is one to keep, the next one being
   * written as a step of its own rather than in place of it. A reading which
   * was asked for and cannot be read back into is one such (see `write`).
   */
  private keep = false;
  /**
   * What the URL would say for the reading the page opened at - which, while
   * the URL says nothing, is what it goes on saying: a reader who has not
   * gone anywhere yet has nowhere to be brought back to (see `write`).
   */
  private opened: string | null = null;
  /** The book's pairs, under each of the three names each one goes by */
  private pairs: Map<string, Pair> | null = null;
  /**
   * Whether the readings on offer are listed without the years they are next
   * read in, which they are until the calendar has arrived
   */
  private undated = true;
  /** The reading whose days and divisions we have filed under their years */
  private dated: string | null = null;
  /** Every reading on offer, in the order the dropdown offers them */
  private names: string[] | null = null;
  /** Each reading's days, with the ones never read left out */
  private readonly days = new Map<string, Days>();
  /** The link to where the reading being shown is described */
  private readonly source: HTMLAnchorElement;

  constructor(book: TikkunBook, start: LineVersesRef) {
    super(['reading', 'day',
           { text: ', ', className: 'nav-ref-comma', with: 'aliyah' },
           'aliyah',
           { text: '(', className: 'nav-ref-open', with: 'division' },
           'division',
           { text: ')', className: 'nav-ref-close', with: 'division' }],
          (which) => this.choose(which));
    this.book = book;
    this.holidays = new Holidays(book.data);
    this.start = start;

    // Where the reading being shown is described, which stands at the end of
    // the line as the sources of the pages stand beside their buttons - the
    // link itself depending on which kind of reading it is (see `show`)
    this.source = document.createElement('a');
    this.source.className = 'nav-help';
    this.source.textContent = '?';
    this.source.target = '_blank';
    this.source.rel = 'noopener noreferrer';
    this.element.append(this.source);

    // The years are shown on the day and division dropdowns and nowhere else,
    // so the calendar they come from is fetched when the reader first reaches
    // for one rather than on the way in - and the options listed again once
    // it has landed (see `loadCalendar`)
    for (const which of ['day', 'division'] as const) {
      this.onReach(which, () => loadCalendar(() => {
        this.undated = false;
        this.update(this.book.currentLine);
      }));
    }
  }

  /** Whether a reading is a parashah, a holiday, or a special shabbat */
  private kindOf(reading: string): Kind {
    if (reading in this.book.data.aliyahLookup) { return 'parashah'; }
    return reading in this.holidays.holidays ? 'holiday' : 'special';
  }

  /**
   * Every reading on offer, in the order the first dropdown offers them: the
   * parashiyot in the order they are read in, then the holidays and the
   * special shabbatot, each in the order `holidays.ts` names them
   */
  private readingNames(): string[] {
    return this.names ??= [...Object.keys(this.book.data.aliyahLookup),
                           ...Object.keys(this.holidays.holidays),
                           ...Object.keys(this.holidays.special)];
  }

  /**
   * The pair `parashah` is one of - as the doubled parashah or as one of the
   * two it joins - or `undefined` where it is not one of a pair at all.
   *
   * A doubled parashah is named for the two it reads together and is listed
   * just before them (see `AliyahLookup`), which is all it takes to find them.
   */
  private pairOf(parashah: string): Pair | undefined {
    if (this.pairs === null) {
      const pairs = new Map<string, Pair>();
      const names = Object.keys(this.book.data.aliyahLookup);
      names.forEach((doubled, i) => {
        const singles: [string, string] = [names[i + 1], names[i + 2]];
        if (doubled !== `${singles[0]}-${singles[1]}`) { return; }
        const pair = { doubled, singles };
        for (const name of [doubled, ...singles]) { pairs.set(name, pair); }
      });
      this.pairs = pairs;
    }
    return this.pairs.get(parashah);
  }

  /**
   * Whether a pair is shown as the doubled parashah rather than as the two it
   * joins when the reader has said nothing either way
   */
  private prefersDoubled(pair: Pair): boolean {
    return !SEPARATE_BY_DEFAULT.includes(pair.doubled);
  }

  /**
   * What each of the letters naming a parashah's divisions stands for (see
   * `Patterns`) - a parashah which is never read as one of a pair having
   * divisions which say nothing beyond their year, and so no letters
   */
  private patterns(parashah: string): TriennialPatternMap {
    return this.book.data.patterns[parashah] ?? {};
  }

  /**
   * The divisions a parashah is listed under, in the order the data lists
   * them - and none at all for a reading which is no parashah
   */
  private divisions(parashah: string): Division[] {
    return divisionsOf(this.book.data.aliyahLookup, parashah);
  }

  /**
   * Whether a division is the one of its year a parashah is taken to be read
   * as unless the reader says otherwise: the one read when no other year
   * splits the parashah's pair, a pair being read together more often than
   * not - or, where the parashah is one of a pair we show apart, the one read
   * when every year splits it.
   *
   * A division which says nothing about any pair splits no year, and so is
   * every year's reading of its parashah and never the wrong one to read.
   */
  private preferredDivision(parashah: string, division: Division): boolean {
    const pair = this.pairOf(parashah);
    const elsewhere = splitYearIndices(division, this.patterns(parashah)).length;
    return pair !== undefined && parashah !== pair.doubled &&
           !this.prefersDoubled(pair)
      ? elsewhere === 2 : elsewhere === 0;
  }

  /**
   * The ways a reading can be read (see `readingsOf`), worked out once per
   * reading - `update` asks for them as often as every scroll event
   */
  private readingsOf(reading: string): Days | undefined {
    const found = this.days.get(reading);
    if (found !== undefined) { return found; }
    const read = readingsOf(this.book.data, this.holidays, reading);
    if (read !== undefined) { this.days.set(reading, read); }
    return read;
  }

  /**
   * The `Reading` a portion names: the aliyot of one reading of one day, and
   * none at all for a portion no reading of ours answers to
   */
  private aliyotIn(portion: Portion): Reading {
    return this.readingsOf(portion.reading)?.[portion.day]?.[portion.division]
           ?? {};
  }

  /**
   * The order a parashah's divisions are offered in: the full kriyah first,
   * which is read in no year, and then the year each is next read in,
   * soonest first - the divisions we have no year for coming last, in the
   * order the data lists them, and the ways of dividing one reading, which
   * are read in the same years, ordered as `divisionOrder` has them.
   */
  private divisionsInOrder(parashah: string, divisions: readonly Division[],
                           years: (division: Division) => number[]):
      Division[] {
    // A division which is read in no year we know of still has to sort
    // somewhere, which is after every year there is
    const NEVER = Number.MAX_SAFE_INTEGER;
    const soonest = (division: Division) =>
      division === FULL_KRIYAH ? -1 : years(division)[0] ?? NEVER;
    const order = divisionOrder(this.patterns(parashah));
    return [...divisions].sort((a, b) => soonest(a) - soonest(b) ||
                                         order(a, b));
  }

  /**
   * The heading a run of options is offered under: the next few years in
   * which what they name is read, as '2027, 2030, …', or '...' where we have
   * none for it - before the calendar has landed, or where no year we look
   * over reads it that way
   */
  private section(years: number[]): string {
    return years.length === 0 ? '...' : `${years.join(', ')}, …`;
  }

  /**
   * One of a parashah's divisions, aliyah by aliyah, leaving out the maftir -
   * which is the end of the seventh aliyah over again rather than an aliyah
   * after it, and so says nothing about where the division reaches
   */
  private run(parashah: string, division: Division): VerseRange[] {
    const aliyot = this.aliyotIn({ reading: parashah, day: NONE, division });
    return aliyotOf(aliyot).flatMap((n) =>
      n === MAFTIR ? [] : rangeOf(aliyot, n));
  }

  /**
   * Which line a verse begins on, or `undefined` for a verse the book does
   * not contain
   */
  private lineOf(verse: VerseRef): Position | undefined {
    return lookupVerseRef(this.book.data.verseLookup, verse)?.[0];
  }

  /**
   * Whether `at` falls within an aliyah, or within a run of them
   */
  private within(run: readonly VerseRange[], at: Position): boolean {
    if (run.length === 0) { return false; }
    const firstLine = this.lineOf(run[0].begin);
    const lastLine = lookupVerseRef(this.book.data.verseLookup,
                                    run[run.length - 1].end)?.at(-1);
    return firstLine !== undefined && lastLine !== undefined &&
           atOrBefore(firstLine, at) && atOrBefore(at, lastLine);
  }

  /**
   * Which book of the Torah a parashah is in, which is the book its first
   * aliyah begins in - no parashah spans two
   */
  private bookOf(parashah: string): number | undefined {
    return this.run(parashah, FULL_KRIYAH)[0]?.begin.book;
  }

  /**
   * The parashiyot the line `at` may be read as part of, the one to show it
   * under first: the last parashah which begins at or before it - the
   * parashiyot being listed in the order they are read in and following on
   * from one another - along with the doubled parashah which reads it
   * together with its neighbour, where there is one.
   */
  private parashiyotAt(at: Position): string[] {
    let found: string | null = null;
    for (const [name, divisions] of
         Object.entries(this.book.data.aliyahLookup)) {
      const begin = divisions?.[FULL_KRIYAH]?.['1']?.begin;
      const firstLine = begin === undefined ? undefined : this.lineOf(begin);
      if (firstLine === undefined || !atOrBefore(firstLine, at)) { break; }
      found = name;
    }
    if (found === null) { return []; }
    const pair = this.pairOf(found);
    if (pair === undefined || pair.doubled === found) { return [found]; }
    return this.prefersDoubled(pair) ? [pair.doubled, found]
                                     : [found, pair.doubled];
  }

  /**
   * Whether a portion reads on from a reader who has asked for one of a pair
   * on its own. The two are read apart only in the years the pattern of
   * Separate and Together years says so, so it is that pattern - and not the
   * asking alone - which says whether the next portion is one of them again
   * or the pair read together.
   */
  private continuesSingle(portion: ParashahPortion): boolean {
    const pair = this.pairOf(portion.reading);
    return pair !== undefined && portion.reading !== pair.doubled &&
           this.parashah !== null && pair.singles.includes(this.parashah) &&
           divisionPatternName(portion.division) ===
             divisionPatternName(this.division);
  }

  /**
   * Whether reading on into `next` gives up a pair the reader asked to be
   * shown other than the way it is shown by default - as one of the two a
   * pair joins where we would otherwise show the doubled parashah, or as the
   * doubled parashah where we would otherwise show the two.
   *
   * Such a reading stands only while the reader is within it (see
   * `portionAt`): once they have read past it there is no reading back into
   * it, the ranking picking the default side of the pair up again instead.
   * Reading on from one of a pair's singles to the other is the exception,
   * the pair being kept apart across the two (see `continuesSingle`).
   */
  private leavesPairApart(next: string): boolean {
    const parashah = this.parashah;
    if (parashah === null || parashah === next) { return false; }
    const pair = this.pairOf(parashah);
    if (pair === undefined ||
        (parashah === pair.doubled) === this.prefersDoubled(pair)) {
      return false;
    }
    return !(pair.singles.includes(parashah) && pair.singles.includes(next));
  }

  /**
   * How well a portion follows on from the one in force, least first:
   * whether it reads on from a pair the reader has asked to read apart,
   * whether it is the side of a pair they are shown by default, whether it
   * divides its parashah the way the one in force does, whether it is the
   * division of its year the parashah is normally read as, and how far its
   * year is from the year being read.
   */
  private rank(portion: ParashahPortion): number[] {
    const { reading: parashah, division } = portion;
    const year = divisionYear(division);
    const pair = this.pairOf(parashah);
    return [
      this.continuesSingle(portion) ? 0 : 1,
      pair === undefined ||
        (parashah === pair.doubled) === this.prefersDoubled(pair) ? 0 : 1,
      divisionIsAlt(division) === divisionIsAlt(this.division) ? 0 : 1,
      this.preferredDivision(parashah, division) ? 0 : 1,
      Math.abs(year - divisionYear(this.division)),
      year,
    ];
  }

  /**
   * The portion the line `at` is read as part of: the one in force while the
   * reader is still within it, and otherwise the best ranked of those which
   * cover the line.
   *
   * Holding on to the portion in force is what lets a doubled parashah, or a
   * division which is not the one its year normally follows, stay up once the
   * reader has asked for it. The full kriyah is a reading of its own rather
   * than one year of a cycle, so a reader following it is only ever carried
   * from one parashah's full kriyah to the next.
   */
  private portionAt(at: Position): ParashahPortion | null {
    if (this.parashah !== null &&
        this.within(this.run(this.parashah, this.division), at)) {
      return { reading: this.parashah, day: NONE, division: this.division };
    }
    const full = this.division === FULL_KRIYAH;
    const parashiyot = this.parashiyotAt(at);
    let best: ParashahPortion | null = null;
    let bestRank: number[] = [];
    for (const parashah of parashiyot) {
      for (const division of this.divisions(parashah)) {
        if ((division === FULL_KRIYAH) !== full) { continue; }
        if (!this.within(this.run(parashah, division), at)) { continue; }
        const portion = { reading: parashah, day: NONE, division };
        const rank = this.rank(portion);
        if (best === null || ranksBefore(rank, bestRank)) {
          [best, bestRank] = [portion, rank];
        }
      }
    }
    // A line at the very edge of a parashah can fall outside every division
    // of it, since a division ends where its last verse does and a line can
    // hold that verse's end along with the next parashah's first
    if (best !== null) { return best; }
    const parashah = parashiyot[0] ?? this.parashah;
    return parashah === undefined || parashah === null
      ? null : { reading: parashah, day: NONE,
                 division: this.divisionFor(parashah) };
  }

  /**
   * Which of a parashah's divisions to show it under, given the one in force:
   * itself where the parashah has it, then the same year read in the same
   * pattern of Separate and Together years, then the division that year is
   * normally read as, then any division of that year, and failing all of
   * that the full kriyah, which every parashah has.
   */
  private divisionFor(parashah: string): Division {
    const divisions = this.divisions(parashah);
    if (divisions.includes(this.division)) { return this.division; }
    const year = divisionYear(this.division);
    const ofYear = divisions.filter((d) => d !== FULL_KRIYAH &&
                                           divisionYear(d) === year);
    const patternName = divisionPatternName(this.division);
    const found = ofYear.find((d) => divisionPatternName(d) === patternName)
                  ?? ofYear.find((d) => this.preferredDivision(parashah, d));
    return found ?? ofYear[0] ?? FULL_KRIYAH;
  }

  /**
   * Which aliyah of the portion the line `at` falls in: the last one which
   * begins at or before it. A triennial division covers only part of its
   * parashah, so a line past the end of one is shown as its last aliyah, and
   * one before the start of it as the first.
   */
  private aliyahAt(portion: Portion, at: Position): Aliyah {
    const aliyot = this.aliyotIn(portion);
    // The maftir is read as part of the seventh aliyah as well, so it is only
    // what the reader is shown while they have asked for it and are within it
    if (this.maftir && this.within(rangeOf(aliyot, MAFTIR), at)) {
      return MAFTIR;
    }

    let found: Aliyah = '1';
    for (const n of aliyotOf(aliyot)) {
      if (n === MAFTIR) { continue; }
      const begin = aliyot[n]?.begin;
      const firstLine = begin === undefined ? undefined : this.lineOf(begin);
      if (firstLine === undefined || !atOrBefore(firstLine, at)) { break; }
      found = n;
    }
    return found;
  }

  /**
   * Which aliyah of a holiday's reading the line `at` falls in, or `null`
   * where it falls in none of them - which is how far the reading reaches,
   * since a holiday's aliyot are not one run through the scroll but a set of
   * pieces of it (see `HolidayLookup`).
   *
   * A reading can cover the same line twice - the fourth aliyah of a day of
   * chol ha-moed reads the first three over again - so the aliyah in force is
   * kept while it still covers the line, and only otherwise is the first one
   * which does taken.
   */
  private holidayAliyahAt(portion: Portion, at: Position): Aliyah | null {
    const aliyot = this.aliyotIn(portion);
    if (this.within(rangeOf(aliyot, this.holidayAliyah), at)) {
      return this.holidayAliyah;
    }
    return aliyotOf(aliyot).find((n) => this.within(rangeOf(aliyot, n), at))
           ?? null;
  }

  /**
   * Where hebcal describes the reading being shown: a parashah's own page, or
   * a holiday's page at the readings of it - a holiday hebcal describes on no
   * page of its own being left to its list of holidays (see `holidayPages`)
   */
  private sourceUrl(reading: string, kind: Kind): string {
    if (kind === 'parashah') {
      return `https://www.hebcal.com/sedrot/${urlName(reading)}`;
    }
    const page = reading in holidayPages ? holidayPages[reading]
                                         : urlName(reading);
    return page === null ? HOLIDAY_LIST : `${HOLIDAY_LIST}${page}#reading`;
  }

  /**
   * Show an aliyah of a portion, listing alongside it every reading there is,
   * every day the one being shown falls on, every aliyah of the reading of
   * that day, and every occasion that day can be
   */
  private show(portion: Portion, aliyah: Aliyah) {
    const kind = this.kindOf(portion.reading);
    const days = this.readingsOf(portion.reading) ?? {};
    const divisions = days[portion.day] ?? {};

    const titles = bookTitles[this.book.data.book];
    const headings: Record<Kind, (reading: string) => string> = {
      parashah: (r) => titles[this.bookOf(r) ?? 0] ?? '',
      holiday: () => HOLIDAYS,
      special: () => SPECIAL_SHABBATOT,
    };
    setOptions(this.selects.reading, this.readingNames(), (r) => r,
               (r) => headings[this.kindOf(r)](r));
    this.selects.reading.value = portion.reading;

    this.source.href = this.sourceUrl(portion.reading, kind);
    const where = `Reading source`;
    this.source.title = where;
    this.source.setAttribute('aria-label', where);

    // A section names the years the option under it is next read in, which is
    // as much a property of the reading as of the day or the division - so a
    // list of options built for another reading has to be given up rather
    // than left as it is, which is what `setOptions` would otherwise do with
    // one naming the same days. Until the calendar lands there is no year in
    // any of them, and so nothing to tell one reading's sections from
    // another's.
    if (!this.undated && this.dated !== portion.reading) {
      this.dated = portion.reading;
      this.selects.day.replaceChildren();
      this.selects.division.replaceChildren();
    }
    // Every year of every holiday comes out of one pass over the calendar,
    // and every division of a parashah out of one pass over the cycles, since
    // in each case they are all read out of the same years as each other
    const scanned = kind === 'parashah'
      ? parashahYears(portion.reading, this.divisions(portion.reading))
      : holidayYears(this.holidays);
    const yearsOf = (...at: string[]) =>
      scanned.get(kind === 'parashah' ? at[at.length - 1]
                                      : [portion.reading, ...at].join('\n'))
      ?? [];

    const named = Object.keys(days);
    setOptions(this.selects.day, named, (d) => d,
               (d) => this.section(yearsOf(d)));
    this.selects.day.value = portion.day;
    // A reading which falls on only the one day, and has nothing to call it,
    // has nothing to say about which day it is being read on
    this.setShown('day', named.length > 1 || named[0] !== NONE);

    setOptions(this.selects.aliyah,
               aliyotOf(divisions[portion.division] ?? {}), aliyahName);
    this.selects.aliyah.value = aliyah;

    // A holiday's occasions are named for the kind of day the reading falls
    // on and are offered under those names, where a parashah's divisions are
    // codes to put into words - and are offered soonest first, there being no
    // order of their own to keep them in
    let offered: string[];
    if (kind === 'parashah') {
      const patterns = this.patterns(portion.reading);
      const inOrder = this.divisionsInOrder(portion.reading,
                                            this.divisions(portion.reading),
                                            (d) => yearsOf(d));
      setOptions(this.selects.division, inOrder,
                 (d) => divisionName(d, patterns),
                 // The full kriyah is not read as part of a cycle at all, and
                 // so stands on its own outside every section
                 (d) => d === FULL_KRIYAH
                   ? '' : this.section(yearsOf(portion.day, d)),
                 // Two options are in the same section only where they are
                 // the same reading gone about in different ways, which for a
                 // parashah is the year of the cycle and the pattern of
                 // Separate and Together years it is read in
                 (d) => `${divisionYear(d)} ${divisionPatternName(d)}`);
      offered = inOrder;
    }
    else {
      offered = Object.keys(divisions);
      setOptions(this.selects.division, offered, (d) => d,
                 (d) => this.section(yearsOf(portion.day, d)));
    }
    this.selects.division.value = portion.division;
    // A day read only the one way has nothing to say about the occasion
    this.setShown('division', offered.length > 1 || offered[0] !== NONE);

    // The verses of the aliyah being read are the ones the pages show at
    // full strength, everything around them being dimmed (see `setAliyah`)
    this.book.setAliyah(this.aliyotIn(portion)[aliyah] ?? null);

    if (kind === 'parashah') {
      this.parashah = portion.reading;
      // Every parashah portion is built with one of that parashah's own
      // divisions; this is the one place with nothing but the `Portion` to go
      // on, so it is read back rather than taken on trust
      const division = Division.safeParse(portion.division);
      if (division.success) { this.division = division.data; }
    }
    else {
      this.holiday = portion;
      this.holidayAliyah = aliyah;
    }

    this.write({ reading: portion.reading, day: portion.day,
                 aliyah, division: portion.division });
    this.showSelected();
  }

  /**
   * Write the reference into the URL, as a step of its own through the
   * history where reading back would not bring the reader to what the URL is
   * holding now - a reading they asked for and have since read past, or one
   * they chose from the dropdowns - and in place of it otherwise.
   *
   * Nothing is written until the reader has moved off the reading the page
   * opened at, so that the state they opened it in is what one step back
   * brings them to.
   */
  private write(ref: SavedRef) {
    if (!this.started) { return; }
    const search = refSearch(ref);
    // The first reading shown once the page has opened is the one it opened
    // at, whether the URL named it or the book simply fell there
    this.opened ??= search;
    // A URL which names no reading is one the reader has not moved off yet -
    // laying the page out again, or turning the device over, being no move of
    // theirs. It is left as they found it until they are somewhere else,
    // which is then a step of its own to come back from.
    if (search === this.opened && Object.keys(readRef()).length === 0) {
      return;
    }
    if (!writeRef(search, this.keep || !this.ownEntry)) { return; }
    this.keep = false;
    this.ownEntry = true;
  }

  /**
   * Keep the reference now in the URL, the next one being written as a step
   * of its own through the history - for a reading the reader is leaving
   * which reading back would not bring them to again
   */
  keepEntry() { this.keep = true; }

  /**
   * Show the aliyah the line `at` is being read as part of
   */
  update(at: Position | null) {
    // Only the Torah is read in parashiyot, so there is no such line to show
    // for a book which has none
    this.element.hidden = Object.keys(this.book.data.aliyahLookup).length === 0;
    // A book with no aliyot has none to read the rest of the text as being
    // outside of, so all of it is shown at full strength
    if (this.element.hidden) { return this.book.setAliyah(null); }
    // Before anything has been laid out there is nowhere to show, and the
    // dropdowns are better left holding their last answer than emptied
    if (at === null || this.jumping) { return; }

    // A holiday stands for as long as the reader is within it, and is given
    // up as soon as they have read past the aliyah they were in
    if (this.holiday !== null) {
      const aliyah = this.holidayAliyahAt(this.holiday, at);
      if (aliyah !== null) { return this.show(this.holiday, aliyah); }
      // A holiday is never read into, only asked for, so reading back over
      // this line will not bring it up again: it is kept as a step of the
      // history rather than written over
      this.keep = true;
      this.holiday = null;
    }

    const portion = this.portionAt(at);
    if (portion === null) { return; }
    // A portion the reader has read their way into is not one whose maftir
    // they asked for
    if (portion.reading !== this.parashah ||
        portion.division !== this.division) {
      this.maftir = false;
    }
    if (this.leavesPairApart(portion.reading)) { this.keep = true; }
    this.show(portion, this.aliyahAt(portion, at));
  }

  /**
   * Jump to the start of the aliyah now chosen. The reference reads from the
   * reading down to the occasion it is read on, and a choice overrides
   * whatever is named after it: a new reading is shown from its first aliyah,
   * and a new aliyah is shown under an occasion which has it - the maftir
   * being one that not every division of a parashah does.
   */
  private choose(changed: AliyahPart) {
    const reading = this.selects.reading.value;
    const days = this.readingsOf(reading);
    if (days === undefined) { return; }
    const kind = this.kindOf(reading);

    let portion: Portion;
    if (kind === 'parashah') {
      // A holiday is only ever shown because it was asked for, and this is a
      // parashah being asked for instead
      this.holiday = null;
      if (changed === 'division') {
        const chosen = Division.safeParse(this.selects.division.value);
        if (chosen.success) { this.division = chosen.data; }
      }
      portion = { reading, day: NONE, division: this.divisionFor(reading) };
    }
    else {
      // Only the dropdown which changed can be read for an answer: the ones
      // below it are still holding the reading before's
      portion = holidayPortion(days, reading,
        changed === 'day' ? this.selects.day.value : this.holiday?.day,
        changed === 'division' ? this.selects.division.value
                               : this.holiday?.division);
    }

    // A choice is the reader asking for a reading rather than reading their
    // way into it, so the one they are leaving is kept as a step of the
    // history for them to go back to
    this.keep = true;

    // A change of reading takes that reading's first aliyah, and anything
    // else keeps the one in force
    const asked = Aliyah.safeParse(this.selects.aliyah.value);
    this.goTo(portion, changed === 'reading' || !asked.success
                         ? undefined : asked.data);
  }

  /**
   * Jump to the start of an aliyah of a portion: the one `wanted`, where the
   * portion has it - and otherwise the last one before it, or, where nothing
   * was asked for at all, the portion's first.
   */
  private goTo(portion: Portion, wanted: Aliyah | undefined) {
    const aliyot = this.aliyotIn(portion);
    const aliyah = aliyahIn(aliyot, wanted);
    if (aliyah === undefined) { return; }
    const range = aliyot[aliyah];
    if (range === undefined) { return; }
    const to = this.lineOf(range.begin);
    if (to === undefined) { return; }

    // Show where we are going before we get there, since laying the page out
    // takes a moment - `update` will confirm it once the scroll has settled
    this.settle(portion, aliyah);
    this.jumping = true;
    void this.book.goTo(to).finally(() => {
      this.jumping = false;
      this.update(this.book.currentLine);
    });
  }

  /**
   * Show an aliyah as the one being read, without going anywhere - which is
   * the whole of a jump to where we already are
   */
  private settle(portion: Portion, aliyah: Aliyah) {
    // A holiday reads its maftir in its own right rather than as the end of
    // an aliyah before it, so it is one the reader can simply be within
    this.maftir = this.kindOf(portion.reading) === 'parashah' &&
                  aliyah === MAFTIR;
    this.show(portion, aliyah);
  }

  /**
   * Show the reading the URL names, on the way in - a URL which names no
   * reading of ours being passed over, and the book left where it opened.
   *
   * `main` asks the URL the same question before opening the book, so we are
   * very likely there already; and where a line can be read as several
   * portions, this is which of them the reader asked for, which is more than
   * the line alone can say (see `portionAt`). So the bar is put in step with
   * the URL either way, and only a book which opened somewhere else is
   * actually scrolled - a jump throwing away everything laid out.
   */
  restore() {
    this.goToRef();
    // Where the page opened is where it opened, whether the URL said so or
    // not: from here on the reference is the reader's, and is written
    this.started = true;
  }

  /**
   * Show the reading the URL names and take the book to it, where the reader
   * is not there already - and say whether it named one at all.
   *
   * The URL is holding that reading already, whether it was followed in or
   * stepped back to, so what is shown is written over it rather than beside
   * it: a link which leaves parts of the reference out names the same
   * reading as one which spells the whole of it. The step it is holding is
   * one to keep, so wherever the reader goes on to from it is written as a
   * step of its own (see `write`).
   */
  private goToRef(): boolean {
    const found = refPortion(this.book.data, this.holidays);
    if (found === null) { return false; }
    const { portion, aliyah } = found;
    // A parashah the URL names is the reader out of whatever holiday they
    // were shown rather than still within it (see `update`)
    if (this.kindOf(portion.reading) === 'parashah') { this.holiday = null; }
    const line = this.book.currentLine;
    [this.started, this.ownEntry] = [true, true];
    if (line !== null &&
        this.within(rangeOf(this.aliyotIn(portion), aliyah), line)) {
      this.settle(portion, aliyah);
    }
    else { this.goTo(portion, aliyah); }
    this.ownEntry = false;
    return true;
  }

  /**
   * Follow the reader stepping back or forward through the history: show the
   * reading the URL has come to name, or - where it names none, which is the
   * step the page opened on - take the book back to where it opened, with
   * nothing asked for on top of it.
   */
  back() {
    if (this.goToRef()) { return; }
    // Nothing asked for is the page as it opens: the reading is whatever the
    // line the book opens at is read as, and nothing is held on to over it
    [this.parashah, this.division] = [null, FULL_KRIYAH];
    [this.holiday, this.maftir] = [null, false];
    // The URL is holding this step already, so nothing is written on the way
    // back to it - and what the reader goes on to from it is written as a
    // step of its own, as the first reference of all was
    this.started = false;
    this.jumping = true;
    void this.book.goTo(this.start).finally(() => {
      [this.jumping, this.started, this.ownEntry] = [false, true, false];
      this.update(this.book.currentLine);
    });
  }
}


/**
 * The reference in the middle of the bar: which verse is being read, and
 * which aliyah of which parashah that verse is part of
 */
class RefChoice {
  readonly element: HTMLDivElement;
  private readonly verse: VerseChoice;
  private readonly aliyah: AliyahChoice;

  constructor(book: TikkunBook, start: LineVersesRef) {
    this.element = document.createElement('div');
    this.element.className = 'nav-ref';
    this.aliyah = new AliyahChoice(book, start);
    // A jump from the verse line is as much a choice as one from the aliyah
    // line, and leaves a reading behind for the reader to go back to
    this.verse = new VerseChoice(book, () => this.aliyah.keepEntry());
    this.element.append(this.verse.element, this.aliyah.element);
  }

  update(verse: Verse | null, at: Position | null) {
    this.verse.update(verse);
    this.aliyah.update(at);
  }

  restore() { this.aliyah.restore(); }

  back() { this.aliyah.back(); }
}

/**
 * The bar along the bottom of the book: which verse is being read and which
 * aliyah it is part of, with a choice of which page to show on either side of
 * it
 */
export class NavBar {
  readonly element: HTMLElement;
  private readonly book: TikkunBook;
  private readonly ref: RefChoice;
  private readonly choices: Record<'left' | 'right', PageChoice>;
  private frame: number | null = null;
  private fitted: number | null = null;

  constructor(element: HTMLElement, book: TikkunBook,
              translit: Transliteration, start: LineVersesRef) {
    this.element = element;
    this.book = book;
    this.element.classList.add('nav-bar');

    this.choices = {
      left: new PageChoice('left', translit,
                           (page) => book.updateLeftPage(page)),
      right: new PageChoice('right', translit,
                            (page) => book.updateRightPage(page)),
    };

    this.ref = new RefChoice(book, start);

    this.element.append(this.choices.left.element, this.ref.element,
                        this.choices.right.element);

    // The book tells us as often as every scroll event, and where we are can
    // only be worked out by measuring, so we do it at most once a frame
    book.onChange(() => this.updateSoon());
    this.update();
    // Where the book opened is only a default, which the URL - if it names a
    // reading of this book - overrides
    this.ref.restore();

    // A step back or forward through the history is a reading asked for as
    // much as one chosen from the dropdowns is, the steps being the readings
    // the reader asked for on the way here (see `AliyahChoice.write`)
    window.addEventListener('popstate', () => this.ref.back());

    // The bar is only as wide as the window, so it is refitted whenever that
    // changes - and once more when the fonts it is measured in have loaded,
    // the widths before then being those of whatever stood in for them
    new ResizeObserver(() => this.fit()).observe(this.element);
    void document.fonts.ready.then(() => this.fit(true));
    this.fit();
  }

  /**
   * Draw the bar at whatever fraction of its full size fits in the window -
   * or at its full size, if that already fits. Scaling its contents can
   * change the bar's height, which is a resize of its own, so a width it has
   * already been fitted to is left alone unless we are told to `remeasure`
   * because what is in it has changed.
   */
  private fit(remeasure = false) {
    const room = this.element.clientWidth;
    if (room === this.fitted && !remeasure) { return; }
    this.fitted = room;

    // What the bar needs is measured with nothing scaled down, so that the
    // fraction which fits is worked out from its full size each time rather
    // than from whatever size it happens to be drawn at
    this.element.style.setProperty('--fit', '1');
    const needed = this.fullWidth();
    if (room > 0 && needed > room) {
      this.element.style.setProperty('--fit', `${room / needed}`);
    }
  }

  /**
   * How wide the bar's contents are at their full size. This is not its
   * `scrollWidth`, which would miss what hangs off the start of a bar whose
   * contents are centered, so the widths of the contents are added up
   * instead - each of them being laid out at its own width (`flex: none`).
   */
  private fullWidth() {
    const style = getComputedStyle(this.element);
    const parts = [...this.element.children];
    const gap = parseFloat(style.columnGap) || 0;
    const gaps = Math.max(parts.length - 1, 0) * gap;
    const padding =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    return parts.reduce((width, part) =>
      width + part.getBoundingClientRect().width, gaps + padding);
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

    this.ref.update(this.book.currentVerse, this.book.currentLine);
  }
}
