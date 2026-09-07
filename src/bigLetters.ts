import { type Book, type Fragment, type PageData } from "./data";

// Source: https://www.sofer.co.uk/large-letters
// Note that except for the ן of משפטן of Num 27:5, which Sefaria includes,
// excluded here were any which the above source lists as being in dispute or
// which otherwise only "may" or "could be" present 
const bigLetters: 
  Record<Book,
  Record<number, // page index
  Record<number, // line index
  { word: number, consonant: number }[]>>>
= {
  torah: {
    1:   { 0:  [{ word: 0, consonant: 0 }] },  // ב of בראשית of Gen 1:1
    101: { 33: [{ word: 1, consonant: 0 }] },  // נ of נצר of Ex 34:7
    102: { 5:  [{ word: 6, consonant: 2 }] },  // ר of אחר of Ex 34:14
    124: { 22: [{ word: 7, consonant: 2 }] },  // ו of גחון of Lev 11:42
    126: { 27: [{ word: 5, consonant: 3 }] },  // ג of והתגלח of Lev 13:33
    169: { 37: [{ word: 1, consonant: 0 }] },  // י of יגדל of Num 14:17
    188: { 9:  [{ word: 7, consonant: 4 }] },  // ן of משפטן of Num 27:5
    210: { 5:  [{ word: 0, consonant: 2 },     // ע of שמע of Deut 6:4
                { word: 5, consonant: 2 }] },  // ד of אחד of Deut 6:4
    239: { 12: [{ word: 4, consonant: 3 }] },  // ל of וישלכם of Deut 29:27
    242: { 14: [{ word: 0, consonant: 0 }] },  // ה of הליהוה of Deut 32:6
  },
  esther: {},
};

// =======================================================
//  [THE REMAINDER OF THIS FILE GENERATED ENTIRELY BY AI]
// =======================================================

/**
 * The words of a `Fragment`, in order
 */
function fragmentWords(fragment: Fragment): string[] {
  return fragment.flatMap((part) => part.he);
}

// The Hebrew letters, and the marks (niqqud, taamim, ...) which attach to
// them - note that this excludes the Hebrew punctuation which lives in the
// same block (maqaf, paseq, sof pasuq, and nun hafucha)
const CONSONANT = /[\u05D0-\u05EA]/;
const MARK = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/;

/**
 * The number of consonants in a string of Hebrew text
 */
function countConsonants(text: string): number {
  return [...text].filter((c) => CONSONANT.test(c)).length;
}

/**
 * Wrap in a `span.big` every consonant of `text` whose index - counting from
 * `state.consonant` - is in `targets`, where a consonant includes any marks
 * which follow it. `state.consonant` is advanced past every consonant seen.
 */
function markText(text: string, targets: Set<number>,
                                state: { consonant: number }): (string | Node)[] {
  const nodes: (string | Node)[] = [];
  let plain = '';
  for (let i = 0; i < text.length; i++) {
    if (!CONSONANT.test(text[i])) {
      plain += text[i];
      continue;
    }
    // Take this consonant together with any marks which follow it
    let end = i + 1;
    while (end < text.length && MARK.test(text[end])) { end++; }
    const letter = text.slice(i, end);
    i = end - 1;

    if (!targets.has(state.consonant++)) {
      plain += letter;
      continue;
    }
    if (plain !== '') { nodes.push(plain); plain = ''; }
    const span = document.createElement('span');
    span.classList.add('big');
    span.append(letter);
    nodes.push(span);
  }
  if (plain !== '') { nodes.push(plain); }
  return nodes;
}

/**
 * As `markText`, but over an already-built list of nodes, recursing into any
 * elements (e.g. the `span.ketiv-kri`s made by `expandAnnotation`)
 */
function markNodes(nodes: (string | Node)[], targets: Set<number>,
                                             state: { consonant: number }): (string | Node)[] {
  return nodes.flatMap((node) => {
    if (typeof node === 'string') {
      return markText(node, targets, state);
    }
    if (node instanceof Text) {
      return markText(node.data, targets, state);
    }
    const marked = markNodes([...node.childNodes], targets, state);
    (node as Element).replaceChildren(...marked);
    return [node];
  });
}

/**
 * Wrap in a `span.big` every big letter of `fragment` occurring in `nodes`,
 * the already-built rendering of `fragment` as text transformed by
 * `transform` (i.e. `ketiv` or `kri`) - `offset` being how many of the
 * line's words come before the fragment
 */
export function withBigLetters(
  data: PageData, lineIndex: number, fragment: Fragment, offset: number,
  transform: (word: string) => string, nodes: (string | Node)[]
): (string | Node)[] {
  const words = fragmentWords(fragment);

  // Convert each big letter's word and consonant indices into the index of
  // that consonant within the whole fragment, which is what `markNodes`
  // counts as it walks the fragment's text
  const targets = new Set<number>();
  const entries = (bigLetters[data.book][data.index] ?? {})[lineIndex] ?? [];
  for (const { word, consonant } of entries) {
    if (word < offset || word - offset >= words.length) { continue; }
    let index = consonant;
    for (const before of words.slice(0, word - offset)) {
      index += countConsonants(transform(before));
    }
    targets.add(index);
  }
  if (targets.size === 0) { return nodes; }

  return markNodes(nodes, targets, { consonant: 0 });
}
