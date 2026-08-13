import * as z from 'zod'; 

// ======================================
//  Schema for `src/data/pages/*/*.json`
// ======================================

/**
 * A reference that links an `EnChunk` to a Hebrew word - either:
 * - A word at a specific index within this fragment
 * - A word at a specific index in a different fragment
 * - An indicator that this `EnChunk` either continues in the next fragment or
 *   is continued from the previous fragment (depending on its position)
 */
export type WordRef 
  = { type: 'word', word: number }
  | { type: 'ref', page: number, line: number, fragment: number, word: number }
  | { type: 'continued' };
export const WordRef = z.union([
  z.int(),
  z.tuple([z.int(), z.int(), z.int(), z.int()]),
  z.tuple([])
]).transform((v: number | [number, number, number, number] | []): WordRef => {
  if (typeof v === 'number') {
    return { type: 'word', word: v };
  }
  if (v.length !== 0) {
    return { type: 'ref', page: v[0], line: v[1], fragment: v[2], word: v[3] };
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
export const EnChunk =
  z.tuple([z.string(), z.array(WordRef)], z.array(z.string()))
   .transform(([text, refs, ...footnotes]): EnChunk => ({
    text, refs, footnotes: footnotes.flat(),
   }));

/**
 * A run of Hebrew words and linked English words, along with the index of the
 * `VerseRef` in `Line.verses` that it is a part of
 */
export const Fragment = z.object({
  he: z.array(z.string()),
  en: z.array(EnChunk),
  verseIndex: z.int().nonnegative(),
});
export type Fragment = z.infer<typeof Fragment>;

/**
 * Some number of `Fragment`s, formatted as two columns, as a single column
 * with a setuma break, or as a single unbroken line
 */
export type Text
  = { format: 'columns', columns: [ [Fragment[]], [Fragment[]] ] }
  | { format: 'setuma',  columns: [ [Fragment[], Fragment[]] ] }
  | { format: 'none',    columns: [ [Fragment[]] ] };
export const Text = z.union([
  z.tuple([z.tuple([z.array(Fragment)]), z.tuple([z.array(Fragment)])]),
  z.tuple([z.tuple([z.array(Fragment), z.array(Fragment)])]),
  z.tuple([z.tuple([z.array(Fragment)])]),
]).transform((columns): Text => {
  if (columns.length === 2) {
    return { format: 'columns', columns: columns }
  }
  const [column] = columns;
  if (column.length === 2) {
    return { format: 'setuma', columns: [column] }
  }
  return { format: 'none', columns: [column] }
});

/**
 * A reference to a verse:
 * - The verse's book, chapter, and verse
 * - The index into the full verse's words that corresponds to the first word
 *   of this verse in the `Line` (i.e. `indexOfFirstWord` is `0` only when the
 *   first word of the `Line` is also the first word of the verse, and
 *   otherwise is higher)
 */
export const VerseRef = z.object({
  book: z.number().nonnegative(),
  chapter: z.number().nonnegative(),
  verse: z.number().nonnegative(),
  indexOfFirstWord: z.number().nonnegative(),
});
export type VerseRef = z.infer<typeof VerseRef>;

/**
 * A line, consisting of:
 * - Text broken into columns, setuma breaks, and fragments
 * - The list of `VerseRef`s that this line includes
 * - Whether this line ends in a petucha break
 */
export const LineData = z.object({
  text: Text,
  verses: z.array(VerseRef),
  isPetucha: z.boolean(),
});
export type LineData = z.infer<typeof LineData>;

/**
 * A page as an array of `Line`s
 */
export const PageData = z.array(LineData);
export type PageData = z.infer<typeof PageData>;


// =====================================
//  Schema for `src/data/lookup/*.json`
// =====================================

/**
 * An index into `Line.verses` for a particular line on a page
 */
export const LookupEntry = z.object({
  page: z.int().positive(),
  line: z.int().nonnegative(),
  index: z.int().nonnegative(),
});
export type LookupEntry = z.infer<typeof LookupEntry>;

/**
 * For each book, chapter, and verse, a `LookupEntry` for each line it
 * appears in
 */
export const Lookup =
  z.record(z.int().positive(), // book
  z.record(z.int().positive(), // chapter
  z.record(z.int().positive(), // verse
  z.object({ refs: z.array(LookupEntry) }))));
export type Lookup = z.infer<typeof Lookup>;


// ====================
//  Loading data files
// ====================

/**
 * The currently available books
 */
type Book = 'torah' | 'esther';

/**
 * Load a `Page` (indexed from 1) from a `Book`
 */
export async function loadPage(book: Book, page: number): Promise<PageData> {
  const module = await import(`./data/pages/${book}/${page}.json`);
  return PageData.parse(Array.from(module.default));
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
  return { torah: await loadLookup('torah'),
           esther: await loadLookup('esther') };
}

/**
 * Returns the error thrown if any of the data does not match this scheme
 */
export async function validateData(): Promise<Error | null> {
  try {
    for (let i = 1; i <= 245; i++) {
      await loadPage('torah', 1);
    }
    for (let i = 1; i <= 17; i++) {
      await loadPage('esther', 1);
    }
    await loadLookups();
  }
  catch (e) {
    if (e instanceof Error) {
      return e;
    }
    return new Error(`Thrown in validateData: ${e}`);
  }
  return null;
}
