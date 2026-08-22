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
export type EnChunk = {
  text: string,
  refs: WordRef[],
  footnotes: string[]
};
const EnChunk =
  z.tuple([z.string(), z.array(WordRef)], z.array(z.string()))
   .transform(([text, refs, ...footnotes]): EnChunk => ({
    text, refs, footnotes: footnotes.flat(),
   }));

/**
 * A run of Hebrew words and linked English words, along with the index of the
 * `VerseRef` in `Line.verses` that it is a part of
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
  | { format: 'line',    columns: [ [Fragment] ] }
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
 * A reference to a verse:
 * - The verse's book, chapter, and verse
 * - The index into the full verse's words that corresponds to the first word
 *   of this verse in the `Line` (i.e. `indexOfFirstWord` is `0` only when the
 *   first word of the `Line` is also the first word of the verse, and
 *   otherwise is higher)
 */
export type VerseRef = z.infer<typeof VerseRef>;
const VerseRef = z.object({
  book: z.number().nonnegative(),
  chapter: z.number().nonnegative(),
  verse: z.number().nonnegative(),
  indexOfFirstWord: z.number().nonnegative(),
});

/**
 * A line, consisting of:
 * - Text broken into columns, setuma breaks, and fragments
 * - The list of `VerseRef`s that this line includes
 * - Whether this line ends in a petucha break
 */
export type LineData = z.infer<typeof LineData>;
const LineData = z.object({
  text: Text,
  verses: z.array(VerseRef),
  isPetucha: z.boolean(),
});

/**
 * A page is an array of `Line`s with a particular index
 */
export type PageData = {
  index: number,
  lines: LineData[],
};


// =====================================
//  Schema for `src/data/lookup/*.json`
// =====================================

/**
 * An index into `Line.verses` for a particular line on a page
 */
export type LookupEntry = z.infer<typeof LookupEntry>;
const LookupEntry = z.object({
  page: z.int().positive(),
  line: z.int().nonnegative(),
  index: z.int().nonnegative(),
});

/**
 * For each book, chapter, and verse, a `LookupEntry` for each line it
 * appears in
 */
export type Lookup = z.infer<typeof Lookup>;
const Lookup =
  z.record(z.int().positive(), // book
  z.record(z.int().positive(), // chapter
  z.record(z.int().positive(), // verse
  z.object({ refs: z.array(LookupEntry) }))));


// ====================
//  Loading data files
// ====================

/**
 * The currently available books
 */
export type Book = 'torah' | 'esther';

/**
 * The currently available books along with each's page count and standard
 * number of lines on a page (although not every page will have exactly this
 * number)
 */
export const books: Record<Book, {
  pageCount: number, standardNumLines: number
}> = {
  'torah': { pageCount: 245, standardNumLines: 42 },
  'esther': { pageCount: 17, standardNumLines: 28 },
};

/**
 * Load a `Page` (indexed from 1) from a `Book`
 */
export async function loadPage(book: Book, index: number): Promise<PageData> {
  const module = await import(`./data/pages/${book}/${index}.json`);
  return z.array(LineData).transform((lines) => ({ lines, index }))
                          .parse(Array.from(module.default));
}

/**
 * Load a `Lookup` for a `Book`
 */
export async function loadLookup(book: Book): Promise<Lookup> {
  const module = await import(`./data/lookup/${book}.json`);
  return Lookup.parse(module.default);
}

/**
 * Load all available `Lookup`s
 */
export async function loadLookups(): Promise<Record<Book, Lookup>> {
  const lookups = {} as Record<Book, Lookup>;
  for (const book of Object.keys(books) as Book[]) {
    lookups[book] = await loadLookup(book);
  }
  return lookups;
}

/**
 * Returns the error thrown if any of the data does not match this scheme
 */
export async function validateData(): Promise<Error | null> {
  for (const book of Object.keys(books) as Book[]) {
    for (let i = 1; i <= books[book].pageCount; i++) {
      try {
        await loadPage(book, i);
      }
      catch (e) {
        if (e instanceof Error) {
          e.message = `Failed to load ${book} page ${i}:\n` + e.message;
          return e;
        }
        return new Error(`Failed to load ${book} page ${i}:\n ${e}`);
      }
    }
    try {
      await loadLookup(book);
    }
    catch (e) {
      if (e instanceof Error) {
        e.message = `Failed to load ${book} lookup:\n` + e.message;
        return e;
      }
      return new Error(`Failed to load ${book} lookup:\n ${e}`);
    }
  }
  return null;
}
