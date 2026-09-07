import * as z from 'zod'; 

// ======================================
//  Schema for `src/data/pages/*/*.json`
// ======================================

/**
 * A reference that links an `EnChunk` to a Hebrew word - either:
 * - A word at a specific index within this part
 * - A word at a specific index in a different part
 * - An indicator that this `EnChunk` either continues in the next part or
 *   is continued from the previous part (depending on its position)
 */
export type WordRef 
  = { type: 'word', word: number }
  | { type: 'ref', page: number, line: number, part: number, word: number }
  | { type: 'continued' };
const WordRef = z.union([
  z.int(),
  z.tuple([z.int(), z.int(), z.int(), z.int()]),
  z.tuple([])
]).transform((v: number | [number, number, number, number] | []): WordRef => {
  if (typeof v === 'number') {
    return { type: 'word', word: v };
  }
  if (v.length !== 0) {
    return { type: 'ref', page: v[0], line: v[1], part: v[2], word: v[3] };
  }
  return { type: 'continued' };
});

/**
 * A chunk of English text that is linked to some number of Hebrew words
 */
export type EnChunk = z.infer<typeof EnChunk>;
const EnChunk =
  z.tuple([z.string(), z.array(WordRef)], z.array(z.string()))
   .transform(([text, refs, ...footnotes]) => ({
    text, refs, footnotes: footnotes.flat(),
   }));

/**
 * A run of Hebrew words and linked English words, along with the index of the
 * `VersesEntry` in `Line.verses` that it is a part of
 */
export type Part = z.infer<typeof Part>;
const Part = z.object({
  he: z.array(z.string()),
  en: z.array(EnChunk),
  verseIndex: z.int().nonnegative(),
});

/**
 * A fragment of text which is not broken up by columns, setuma breaks, or line
 * breaks - consisting of some number of `Part`s (may be zero)
 */
export type Fragment = z.infer<typeof Fragment>;
const Fragment = z.array(Part);

/**
 * Some number of `Fragment`s, formatted either as two columns, as a single
 * column with setuma break(s), or as a single unbroken line
 */
export type Text
  = { format: 'columns', columns: [ [Fragment], [Fragment] ] }
  | { format: 'setuma',  columns: [ [Fragment, Fragment, ...Fragment[]] ] }
  | { format: 'line',    columns: [ [Fragment] ] };
const Text = z.union([
  z.tuple([z.tuple([Fragment]), z.tuple([Fragment])]),
  z.tuple([z.array(Fragment).nonempty()])
]).transform((columns): Text => {
  if (columns.length === 2) {
    return { format: 'columns', columns: columns }
  }
  const [[fragment0, ...fragments1]] = columns;
  if (fragments1.length === 0) {
    return { format: 'line', columns: [[fragment0]] }    
  }
  const [fragment1, ...fragments2] = fragments1;
  return { format: 'setuma', columns: [[fragment0, fragment1, ...fragments2]] }
});

/**
 * A verse, as an aliyah's first or last
 */
export interface VerseRef {
  book: number;
  chapter: number;
  verse: number;
}

/**
 * A reference to a verse within a `Line`:
 * - The verse's book, chapter, and verse
 * - The index into the full verse's words that corresponds to the first word
 *   of this verse in the `Line` (i.e. `indexOfFirstWord` is `0` only when the
 *   first word of the `Line` is also the first word of the verse, and
 *   otherwise is higher)
 */
export interface VersesEntry extends VerseRef {
  indexOfFirstWord: number;
};
const VersesEntry = z.object({
  book: z.int().positive(),
  chapter: z.int().positive(),
  verse: z.int().positive(),
  indexOfFirstWord: z.int().nonnegative(),
});

/**
 * A line, consisting of:
 * - Text broken into columns, setuma breaks, and fragments
 * - The list of `VersesEntry`s that this line includes
 * - Whether this line ends in a petucha break
 */
export type LineData = z.infer<typeof LineData>;
const LineData = z.object({
  text: Text,
  verses: z.array(VersesEntry),
  isPetucha: z.boolean(),
});

/**
 * A page is an array of `Line`s, but we also store its book and index
 */
export type PageData = {
  book: Book,
  index: number,
  lines: LineData[],
};


// =================================================
//  Helper types and functions for aliyah divisions
// =================================================

export const FULL_KRIYAH = 'full';
export const TRIENNIAL_NO_PATTERN_NAME = 'Y';
export const TRIENNIAL_PATTERN_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export const ALT_PREFIX = 'alt';

/**
 * A year in the triennial system, i.e. either '1', '2', or '3'
 */
export type TriennialYear = z.infer<typeof TriennialYear>;
export const TriennialYear = z.literal(['1', '2', '3']);

/**
 * A possible name for a pattern in the triennial system, as per
 * `hebcal-triennial`
 */
export type TriennialPatternName = z.infer<typeof TriennialPatternName>;
export const TriennialPatternName = z.literal(TRIENNIAL_PATTERN_NAMES);

/**
 * A pattern in the triennial system, as per `hebcal-triennial`, where each
 * character indicates whether the two portions are read together ('T') or
 * separately ('S') during that year in the triennium
 */
export type TriennialPattern = z.infer<typeof TriennialPattern>;
export const TriennialPattern = z.templateLiteral([
  z.literal(['T', 'S']), z.literal(['T', 'S']), z.literal(['T', 'S']),
]);

/**
 * A map from `TriennialPatternName`s to `TriennialPattern`s for a particular
 * pair of parashiyot
 */
export type TriennialPatternMap = z.infer<typeof TriennialPatternMap>;
export const TriennialPatternMap =
  z.partialRecord(z.literal(TRIENNIAL_PATTERN_NAMES), TriennialPattern);

// Used internally below
const TRIENNIAL_DIVISION_NAMES =
  [TRIENNIAL_NO_PATTERN_NAME, `${ALT_PREFIX}.${TRIENNIAL_NO_PATTERN_NAME}`,
   ...TRIENNIAL_PATTERN_NAMES] as const;
const TRIENNIAL_DIVISION_INFO = {} as Record<TriennialDivision, {
  year: number,
  patternName: 'Y' | TriennialPatternName,
  isAlt: boolean,
}>;
for (const name of TRIENNIAL_DIVISION_NAMES) {
  for (const year of ['1', '2', '3'] as const) {
    TRIENNIAL_DIVISION_INFO[`${name}.${year}`] = {
      year: Number(year),
      patternName: name === 'alt.Y' ? 'Y' : name,
      isAlt: name === 'alt.Y',
    };
  }
}

/**
 * A division within the triennial system, as per `hebcal-triennial`:
 * - a `TriennialPatternName` if this is a parashah that can be combined *and*
 *   which actually changes depending on whether it is combined in other years
 *   in the triennium
 * - `TRIENNIAL_NO_PATTERN_NAME` otherwise, possibly with `ALT_PREFIX` followed
 *   by a period prepended to it
 */
export type TriennialDivision = z.infer<typeof TriennialDivision>;
export const TriennialDivision =
  z.templateLiteral([z.literal(TRIENNIAL_DIVISION_NAMES), ".", TriennialYear]);

/**
 * A division of a parashah: either `FULL_KRIYAH` or a `TriennialDivision`
 */
export type Division = z.infer<typeof Division>;
export const Division = z.union([z.literal(FULL_KRIYAH), TriennialDivision]);

/**
 * Returns the number of the `TriennialYear` associated with the given
 * `TriennialDivision`, or 0 if given `FULL_KRIYAH`
 */
export function divisionYear(division: Division): number {
  return division === FULL_KRIYAH ? 0 :
         TRIENNIAL_DIVISION_INFO[division].year;
}

/**
 * Returns the `TriennialPatternName` associated with the given
 * `TriennialDivision` or `TRIENNIAL_NO_PATTERN_NAME` if it doesn't have one,
 * or `''` if given `FULL_KRIYAH`
 */
export function divisionPatternName(division: Division):
  '' | 'Y' | TriennialPatternName {
  return division === FULL_KRIYAH ? '' :
         TRIENNIAL_DIVISION_INFO[division].patternName;
}

/**
 * Returns true if given a `TriennialDivision` with `ALT_PREFIX` in its
 * associated `TriennialDivision`
 */
export function divisionIsAlt(division: Division): boolean {
  return division !== FULL_KRIYAH &&
         TRIENNIAL_DIVISION_INFO[division].isAlt;
}

/**
 * Given a `TriennialDivision` with a `TriennialPatternName` and a
 * `TriennialPatternMap` containing this division's pattern, returns the
 * indices of the years in the triennium which are split (i.e. read separately,
 * "S") besides the current year in the current pattern, or returns an empty
 * array otherwise
 */
export function splitYearIndices(
  division: Division, patterns: TriennialPatternMap
): number[] {
  const year = divisionYear(division);
  const name = divisionPatternName(division);
  const pattern = name !== '' && name !== 'Y' ? patterns[name] : undefined;
  return [...pattern ?? ''].flatMap((pattern_i, i) =>
    // if `i+1` is a split year which is not `year`, include `i+1`
    pattern_i === 'S' && i+1 !== year ? [i+1] : []);
}

/**
 * A human-readable name for a `Division`, ignoring the `TriennialPatternName`
 * when it is the only year split in its triennium as per the given map
 */
export function divisionName(
  division: Division, patterns: TriennialPatternMap
): string {
  if (division === FULL_KRIYAH) { return "Full"; }
  const patternSuffix =
    splitYearIndices(division, patterns).length !== 0 ?
    ` (${divisionPatternName(division)})` : '';
  const altSuffix = divisionIsAlt(division) ? ` Alternate` : '';
  return `Year ${divisionYear(division)}${patternSuffix}${altSuffix}`;
}

/**
 * The comparator callback function to use when ordering `Division` array:
 * always put `FULL_KRIYAH` first, then sort first by `divisionYear`, then by
 * the number of splits in that year's pattern as per `splitYearIndices`, then
 * by whether `divisionIsAlt`, then finally by `divisionPatternName`
 */
export function divisionOrder(
  patterns: TriennialPatternMap
): (a: Division, b: Division) => number {
  return (a, b) => {
    if ((a === FULL_KRIYAH) !== (b === FULL_KRIYAH)) {
      return a === FULL_KRIYAH ? -1 : 1;
    }
    return divisionYear(a) - divisionYear(b) ||
           splitYearIndices(a, patterns).length -
           splitYearIndices(b, patterns).length ||
           Number(divisionIsAlt(a)) - Number(divisionIsAlt(b)) ||
           divisionPatternName(a).localeCompare(divisionPatternName(b));
  };
}


// ===================================================
//  Helper types and functions for aliyah identifiers
// ===================================================

export const MAFTIR = 'M';

// Used internally below
const ALIYOT = ['1', '2', '3', '4', '5', '6', '7', '8', MAFTIR] as const;

/**
 * An aliyot: either a number from 1 to 8 or `MAFTIR`
 */
export type Aliyah = z.infer<typeof Aliyah>;
export const Aliyah = z.literal(ALIYOT);

/**
 * A human readable name for an `Aliyah` - substituting "Maftir" for `MAFTIR`
 */
export function aliyahName(n: Aliyah): string {
  return n === MAFTIR ? 'Maftir' : n;
}

/**
 * The comparator callback function to use when ordering an `Aliyah` array:
 * always put `MAFTIR` last then sort normally
 */
export function aliyahOrder(a: Aliyah, b: Aliyah): number {
  return ALIYOT.indexOf(a) - ALIYOT.indexOf(b);
}



// =====================================
//  Schema for `src/data/books/*.json`
// =====================================

/**
 * An index into `Line.verses` for a particular line on a page
 */
export type LineVersesRef = z.infer<typeof LineVersesRef>;
const LineVersesRef = z.tuple([
  z.int().positive(),    // page
  z.int().nonnegative(), // line
  z.int().nonnegative(), // index
]).transform(([page, line, index]) => ({ page, line, index }));

/**
 * For each book, chapter, and verse, a `LineVersesRef` for each line it
 * appears in
 */
export type VerseLookup = z.infer<typeof VerseLookup>;
const VerseLookup =
  z.partialRecord(z.int().positive(), // book
    z.partialRecord(z.int().positive(), // chapter
      z.partialRecord(z.int().positive(), // verse
        z.array(LineVersesRef))));

/**
 * Look up a `VerseRef` in a `VerseLookup`
 */
export function lookupVerseRef(
  lookup: VerseLookup, { book, chapter, verse }: VerseRef
): LineVersesRef[] | undefined {
  return lookup[book]?.[chapter]?.[verse];
}

/**
 * The range of verses (inclusive) that define a reading
 */
export interface VerseRange {
  begin: VerseRef;
  end: VerseRef;
}
const VerseRange = z.tuple([
  z.int().positive(),            // book
  z.tuple([z.int().positive(),   // begin chapter
           z.int().positive()]), // begin verse
  z.tuple([z.int().positive(),   // end chapter
           z.int().positive()]), // end verse
]).transform(([book, [chapter0, verse0], [chapter1, verse1]]): VerseRange => ({
  begin: { book, chapter: chapter0, verse: verse0 },
  end:   { book, chapter: chapter1, verse: verse1 },
}));

/**
 * A reading, as a mapping from each `Aliyah` it has to its `VerseRange`
 */
export type Reading = z.infer<typeof Reading>;
const Reading = z.partialRecord(Aliyah, VerseRange);

/**
 * Given a `Reading`, returns the array containing each valid `Aliyah`
 */
export function aliyotOf(reading: Reading): Aliyah[] {
  return ALIYOT.filter((n) => reading[n] !== undefined);
}

/**
 * For each parashah, a map from the set of valid `Division`s of that parashah
 * to the `Reading` which that division of the parashah defines
 */
export type AliyahLookup = z.infer<typeof AliyahLookup>;
const AliyahLookup =
  z.partialRecord(z.string(), // parashah
    z.partialRecord(Division, // division
      Reading));

/**
 * Given an `AliyahLookup` and a parashah, returns the array containing each
 * valid `Division`
 */
export function divisionsOf(
  lookup: AliyahLookup, parashah: string
): Division[] {
  return Object.keys(lookup[parashah] ?? {}) as Division[];
}

/**
 * For each parashah which can be combined, its `TriennialPatternMap`
 */
export type Patterns = z.infer<typeof Patterns>;
const Patterns =
  z.partialRecord(z.string(), // parashah
    TriennialPatternMap);

/**
 * A map which associates a `Reading` with each `hebcal-leyning` holiday,
 * except for 'Sukkot Shabbat Chol ha-Moed', which is broken up into separate
 * entries as per `MAFTIR_CHOICES` in `aliyot.py` and `holidays.ts`
 */
export type HolidayLookup = z.infer<typeof HolidayLookup>;
const HolidayLookup =
  z.partialRecord(z.string(), // hebcal holiday
    Reading);

/**
 * Aliases listed for certain holidays in `hebcal-leyning` - for example,
 * 'Rosh Chodesh Nisan' is listed as an alias for 'Rosh Chodesh', since the
 * same general Rosh Chodesh reading is used for all months
 */
export type HolidayAliases = z.infer<typeof HolidayAliases>;
const HolidayAliases = z.partialRecord(z.string(), z.string());

/**
 * Data about a book, specifically:
 * - How many pages it has
 * - How many lines a page normally has
 * - Which pages have a different number of lines
 * - A mapping from verses to their lines on pages
 * - A mapping from aliyot of parashiyot to their readings
 * - A mapping of triennial pattern names to their patterns
 * - A mapping of `hebcal-leyning` holiday names to their readings
 * - Aliases for `hebcal-leyning` holidays
 */
export type BookData = z.infer<typeof BookData> & { book: Book };
const BookData = z.object({
  pageCount: z.int().positive(),
  standardNumLines: z.int().positive(),
  variantNumLines: z.record(z.int().positive(), z.int()),
  verseLookup: VerseLookup,
  aliyahLookup: AliyahLookup,
  patterns: Patterns,
  holidayLookup: HolidayLookup,
  holidayAliases: HolidayAliases,
});


// ====================
//  Loading data files
// ====================

/**
 * The currently available books
 */
export const bookNames = ['torah', 'esther'] as const;
export type Book = typeof bookNames[number];

/**
 * The name of each of the actual books making up a `Book`
 */
export const bookTitles: Record<Book, Record<number, string>> = {
  torah: { 1: 'Genesis', 2: 'Exodus', 3: 'Leviticus',
           4: 'Numbers', 5: 'Deuteronomy' },
  esther: { 1: 'Esther' },
};

/**
 * Load the `BookData` for a `Book`
 */
export async function loadBook(book: Book): Promise<BookData> {
  const module = await import(`./data/books/${book}.json`);
  return { ...BookData.parse(module.default), book };
}

/**
 * Load the `BookData` for all available books
 */
export async function loadBooks(): Promise<Record<Book, BookData>> {
  const books = {} as Record<Book, BookData>;
  for (const book of bookNames) {
    books[book] = await loadBook(book);
  }
  return books;
}

/**
 * Given a `BookData` object, return many lines are on the given page (indexed
 * from 1)
 */
export function numLines(data: BookData, index: number): number {
  return data.variantNumLines[index] ?? data.standardNumLines;
}

/**
 * Load the `PageData` for given page (indexed from 1) from a `Book`
 */
export async function loadPage(book: Book, index: number): Promise<PageData> {
  const module = await import(`./data/pages/${book}/${index}.json`);
  return z.array(LineData).transform((lines) => ({ book, index, lines }))
                          .parse(Array.from(module.default));
}

/**
 * Returns the error thrown if any of the data does not match this scheme
 */
export async function validateData(): Promise<Error | null> {
  for (const book of bookNames) {
    let data: BookData;
    try {
      data = await loadBook(book);
    }
    catch (e) {
      if (e instanceof Error) {
        e.message = `Failed to load ${book}:\n` + e.message;
        return e;
      }
      return new Error(`Failed to load ${book}:\n ${e}`);
    }
    for (let i = 1; i <= data.pageCount; i++) {
      try {
        const page = await loadPage(book, i);
        if (page.lines.length !== numLines(data, i)) {
          return new Error(`Failed to load ${book} page ${i}:\n ` +
                           `expected ${numLines(data, i)} lines, ` +
                           `found ${page.lines.length}`);
        }
      }
      catch (e) {
        if (e instanceof Error) {
          e.message = `Failed to load ${book} page ${i}:\n` + e.message;
          return e;
        }
        return new Error(`Failed to load ${book} page ${i}:\n ${e}`);
      }
    }
  }
  return null;
}
