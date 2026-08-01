import type { Word } from 'havarotjs/word';
import type { TaamimName } from 'havarotjs/utils/charMap';

// The background color of a hovered element
const hoveredVerse = 'transparent';
const hoveredClause = 'hsl(45 100% 90%)';
const hoveredPhrase = 'hsl(45 100% 70%)';
const hoveredWord = 'hsl(45 100% 70%)';

// The background color of a hovered syllable
export const syllableColor = 'hsl(0 67% 45%)';

// ==================
//  Kinds of accents
// ==================

// NOTE: There are two systems of accents, one used in only in Psalms,
// Proverbs, and the poetic sections of Job, and another used in the other 21
// books. Except where specified, we are referring to the latter system.

// Most accents are marked by taamim, but some are special combinations of
// taamim and/or punctuation marks (see `specialAccents`)
type Accent = TaamimName | SpecialAccent;
type SpecialAccent = 'MAQAF' | 'SOF_PASSUQ' | 'LEGARMEH'
                   // From the system only used in Psalms, Proverbs, and Job
                   | 'MAHAPAKH_LEGARMEH' | 'AZLA_LEGARMEH'
                   | 'SHALSHELET_GEDOLAH' | 'SHALSHELET_KETANAH'
                   | 'REVIA_MUGRASH' | 'REVIA_KATAN'
                   | 'OLE_VEYORED';

// Note: An empty object for an `Accent` which is a `TaamimName`
type AccentInfo = {
  readonly taam?: TaamimName;
  readonly afterTaam?: TaamimName[];
  readonly beforePunct?: string;
  readonly beforePhrase?: Accent;
  readonly onlyPoetic?: boolean
};

// How each special accent is formed
const specialAccents: { [A in SpecialAccent]: AccentInfo } = {
  // A 'MAQAF' just needs to have a maqaf marking after it
  'MAQAF': {
    beforePunct: '־'
  },
  // A 'SOF_PASSUQ' just needs to have a sof passuq marking after it
  'SOF_PASSUQ': {
    beforePunct: '׃'
  },
  // A 'LEGARMEH' is a 'MUNAH' before a paseq marking as well as before a
  // phrase ending in a 'REVIA'
  'LEGARMEH': {
    taam: 'MUNAH', beforePunct: '׀', beforePhrase: 'REVIA'
  },
  // A 'MAHAPAKH_LEGARMEH', 'AZLA_LEGARMEH', or 'SHALSHELET_GEDOLAH' is a
  // 'MAHAPAKH', 'QADMA', or 'SHALSHELET', respectively, before a paseq
  // marking - in Psalms, Proverbs, and Job only
  'MAHAPAKH_LEGARMEH':  {
    taam: 'MAHAPAKH', beforePunct: '׀', onlyPoetic: true
  },
  'AZLA_LEGARMEH':      {
    taam: 'QADMA', beforePunct: '׀', onlyPoetic: true
  },
  'SHALSHELET_GEDOLAH': {
    taam: 'SHALSHELET', beforePunct: '׀', onlyPoetic: true
  },
  // A 'SHALSHELET' with no following paseq is a 'SHALSHELET_KETANAH' in
  // Psalms, Proverbs, and Job only
  'SHALSHELET_KETANAH': {
    taam: 'SHALSHELET', onlyPoetic: true
  },
  // A 'REVIA_MUGRASH' is a 'REVIA' following a 'GERESH_MUQDAM', or 'GERESH'
  // in Psalms, Proverbs, and Job only
  'REVIA_MUGRASH': {
    taam: 'REVIA', afterTaam: ['GERESH', 'GERESH_MUQDAM'], onlyPoetic: true
  },
  // A 'REVIA_KATAN' is a 'REVIA' before a phrase ending in an 'OLE_VEYORED'
  // in Psalms, Proverbs, and Job only
  'REVIA_KATAN': {
    taam: 'REVIA', beforePhrase: 'OLE_VEYORED', onlyPoetic: true
  },
  // An 'OLE_VEYORED' is a 'MERKHA' (called a yored here) following an 'OLE'
  // in Psalms, Proverbs, and Job
  'OLE_VEYORED': {
    taam: 'MERKHA', afterTaam: ['OLE'], onlyPoetic: true
  }
};

function accentInfo(accent: Accent | undefined): AccentInfo {
  return accent !== undefined && accent in specialAccents
           ? specialAccents[accent as SpecialAccent]
           : {};
}

// The punctuation marks used in special accents
const specialPuncts: readonly string[] = [...new Set(
  Object.values(specialAccents)
        .map(({ beforePunct }) => beforePunct)
        .filter((punct) => punct !== undefined)
)];

// Accents can be conjunctive or disjunctive, where disjunctive accents are
// either near or remote - this language is based on:
// 'The Syntax of Masoretic Accents' by James D. Price 
// https://www.jamesdprice.com/images/21_Syntax_of_Accents_rev._ed..pdf
type AccentKind = 'conjunctive' | 'near' | 'remote';
function isDisjunctive(kind: AccentKind | undefined): boolean {
  return kind === 'near' || kind === 'remote';
}

// Conjunctive accents indicate that the word they’re on is part of a phrase
// that includes the following word - there are complicated rules for which
// accents can follow a given conjunctive accent but we don't need to worry
// about them here
const conjAccents = [
  'MAQAF', 'MUNAH', 'MAHAPAKH', 'MERKHA', 'MERKHA_KEFULA', 'DARGA', 'QADMA',
  'TELISHA_QETANA', 'YERAH_BEN_YOMO',
  // From the system only used in Psalms, Proverbs, and Job
  'ZARQA', // NOTE: Unicode has a famous error here where the character called
           // zarka actually represents the accent zinorit (zarqa is
           // represented by 'ZINOR', below)
  'GERESH_MUQDAM', 'OLE', 'ATNAH_HAFUKH', 'SHALSHELET_KETANAH', 'ILUY',
] as const satisfies readonly Accent[];

// Disjunctive accents indicate that the word they’re on is the end of a
// phrase - each has a rank from I-V which is only recorded here in comments,
// for completeness

// Near disjunctive accents indicate that the phrase they end is part of a
// clause that includes the following phrase
const nearAccents = [
  // III (Kings)
  'TIPEHA', // always precedes a 'SOF_PASSUQ' or 'ETNAHTA' phrase
  // IV (Dukes)
  'ZINOR', // only called zinor in Psalms, Proverbs, and Job - otherwise it is
           // called zarqa, where it always precedes a 'SEGOL' or 'SHALSHELET'
           // phrase (note that there is another `Accent` named 'ZARQA' which
           // confusingly does not represent a zarqa, see above)
  'PASHTA', 'YETIV', // always precedes a 'ZAQEF_QATAN' or 'ZAQEF_GADOL' phrase
  'TEVIR', // always precedes a 'TIPEHA' phrase
  // V (Counts)
  'LEGARMEH', // always precedes a 'REVIA' phrase
  // Only used in Psalms, Proverbs, and Job
  'SHALSHELET_GEDOLAH', 'REVIA_MUGRASH', 'REVIA_KATAN', 'DEHI',
] as const satisfies readonly Accent[];

// Remote disjunctive accents indicate that the phrase they end is also the
// end of a clause - with the exception of 'GERESH' and 'GERSHAYIM' (which
// always precede a phrase ending with an accent of rank IV) a following
// phrase must end with an accent of a greater or equal rank, although we don't
// need to worry about that here
const remoteAccents = [
  // I/II (Emperors)
  'SOF_PASSUQ', 'ETNAHTA',
  // III (Kings)
  'SEGOL_ACCENT', 'SHALSHELET',
  'ZAQEF_QATAN', 'ZAQEF_GADOL',
  // IV (Dukes)
  'REVIA',
  // V (Counts)
  'PAZER', 'QARNEY_PARA', 'TELISHA_GEDOLA',
  'GERESH', 'GERSHAYIM',
  // Only used in Psalms, Proverbs, and Job
  'OLE_VEYORED', 'MAHAPAKH_LEGARMEH', 'AZLA_LEGARMEH'
] as const satisfies readonly Accent[];

// A map of each accent to its kind
const kinds = new Map<Accent, AccentKind>([
  ...conjAccents  .map((a): [Accent, AccentKind] => [a, 'conjunctive']),
  ...nearAccents  .map((a): [Accent, AccentKind] => [a, 'near'       ]),
  ...remoteAccents.map((a): [Accent, AccentKind] => [a, 'remote'     ]),
]);

// =========================
//  Reading a word's accent
// =========================

// Get the taamim of a word, in the order they appear, up to the reordering of
// the pairs above
function taamimOf(word: Word, poetic: boolean): readonly TaamimName[] {
  return word.syllables.flatMap((syllable) => {
    const taamim = [...syllable.taamimNames];
    if (taamim.length >= 2) {
      const l = taamim.length - 1;
      // If we have a special accent whose main taam is the second-to-last taam
      // in this syllable and which is specificed to come after the last taam,
      // then the two are probably in the wrong order in this word, so...
      if (Object.values(specialAccents).some(
            ({ taam, afterTaam, onlyPoetic }) =>
              (!onlyPoetic || poetic) &&
              taamim[l - 1] === taam &&
              (afterTaam ?? []).includes(taamim[l])
            )) {
        // ...we swap them!
        [taamim[l - 1], taamim[l]] = [taamim[l], taamim[l - 1]];
      }
    }
    return taamim;
  });
}

// Get the main (i.e. final) taam of a word, if there is one
function taamOf(word: Word, poetic: boolean): TaamimName | undefined {
  const taamim = taamimOf(word, poetic);
  return taamim.length > 0 ? taamim[taamim.length - 1] : undefined;
}

// Returns true if the word at `i` either includes or is followed immediately
// by the punctuation mark `punct`, ignoring words made up of non-Hebrew
// characters
function hasPunctAfter(words: readonly Word[], i: number,
                       punct: string): boolean {
  if (words[i].text.includes(punct)) {
    return true;
  }
  for (let j = i + 1; j < words.length; j++) {
    if (!words[j].isNotHebrew) {
      return words[j].text === punct;
    }
  }
  return false;
}

// Returns the disjunctive accent which ends the current phrase containing the
// word at `i+1`, i.e. returns the disjunctive accent which ends the next
// phrase if the word at `i` ends the current phrase
function nextDisjunctiveAfter(words: readonly Word[], i: number,
                              poetic: boolean): Accent | undefined {
  for (let j = i + 1; j < words.length; j++) {
    const accent = accentOf(words, j, poetic);
    if (isDisjunctive(kindOf(accent))) {
      return accent;
    }
  }
  return undefined;
}

// Returns the index of the word bearing a taam in `before` written before the
// final taam of the word at `i`, if there is one - either `i` itself, where
// that taam is written somewhere earlier on that word, or the index of the
// last word before it, which must bear it as its final taam
function taamBefore(words: readonly Word[], i: number,
                    before: readonly TaamimName[],
                    poetic: boolean): number | undefined {
  const taamim = taamimOf(words[i], poetic);
  if (taamim.length > 1) {
    return taamim.slice(0, -1).some((taam) => before.includes(taam))
             ? i : undefined;
  }
  for (let j = i - 1; j >= 0; j--) {
    // Never look across verse boundaries
    if (words[j].text.includes('׃')) {
      return undefined;
    }
    const taam = taamOf(words[j], poetic);
    if (taam !== undefined) {
      return before.includes(taam) ? j : undefined;
    }
  }
  return undefined;
}

// Returns true if a taam in `before` is written before the final taam of the
// word at `i`
function hasTaamBefore(words: readonly Word[], i: number,
                       before: readonly TaamimName[],
                       poetic: boolean): boolean {
  return taamBefore(words, i, before, poetic) !== undefined;
}

// Get the accent of a word, if there is one - where the accent which ends the
// phrase after the one this word is a part of, `nextDisjunctive`, can be
// provided directly if the caller already knows it - otherwise it is computed
// via `nextDisjunctiveAfter`
function accentOf(words: readonly Word[], i: number, poetic: boolean,
                  nextDisjunctive?: Accent
                 ): Accent | undefined {
  const wordTaam = taamOf(words[i], poetic);
  // Handle each special accent
  for (const accent of Object.keys(specialAccents) as SpecialAccent[]) {
    const { taam, afterTaam, beforePunct,
            beforePhrase, onlyPoetic } = specialAccents[accent];
    // Compute `nextDisjunctive` if we don't have it
    if (beforePhrase && !nextDisjunctive) {
      nextDisjunctive = nextDisjunctiveAfter(words, i, poetic)
    }
    if ((!onlyPoetic   || poetic) &&
        (!taam         || wordTaam === taam) &&
        (!afterTaam    || hasTaamBefore(words, i, afterTaam, poetic)) &&
        (!beforePunct  || hasPunctAfter(words, i, beforePunct)) &&
        (!beforePhrase || nextDisjunctive === beforePhrase)) {
      return accent;
    }
  }
  // Any other accent is written as a single taam, the word's last
  return wordTaam;
}

// The kind of an accent, or nothing where there is no accent
function kindOf(accent: Accent | undefined): AccentKind | undefined {
  return accent !== undefined ? kinds.get(accent) : undefined;
}

// ==================================================
//  Dividing words into phrases, clauses, and verses
// ==================================================

// Based on accents:
// - Words are grouped into phrases, ended by a disjunctive accent
// - Phrases are grouped into clauses, ended by a *remote* disjunctive accent
// - Clauses are grouped into verses, ended by a 'SOF_PASSUQ'
export const accentLevels = ['verse', 'clause', 'phrase'] as const;
export type Level = (typeof accentLevels)[number];

// A group of words (i.e. a phrase, clause, or verse) along with the groups of
// the level below it, if there are any
export interface Group {
  id: number;
  lvl: Level;
  // Indices of the first and last word of the group
  start: number;
  end: number;
  // The disjunctive accent which closes the group, or left out if this is the
  // final group and the text ended before reaching a disjunctive accent of
  // the correct type
  accent?: Accent;
  // The `id`s of the parent and children `Group`s
  parent?: number;
  children: readonly number[];
}

// The accent-related information about a word that we actually need when
// computing a grouping: the word's accent, whether it is a punctuation mark
// (and if so which one it is), and if it spans multiple words the index of
// the first word its accent is written across
export interface AccentedWord {
  accent?: Accent;
  mark?: string;
  startsAt?: number;
}

// After each word comes a boundary, which indicates how this word relates to
// the one following it in terms of groups
export type Boundary =
  // Both this and the next word are in the same phrase
  | { loc: 'samePhrase' }
  // Both this and the next word are part of the same accent
  | { loc: 'sameAccent' }
  // The end of a phrase and possibly its parent(s), `closes` is the `id` of
  // the outermost group being closed
  | { loc: 'end'; closes: number };

// How a text divides into phrases, clauses, and verses
export interface Grouping {
  accentedWords: readonly AccentedWord[];
  // All groups in the order in which they're closed
  groups: readonly Group[];
  // All outermost groups (i.e. verses)
  roots: readonly number[];
  // The innermost group (i.e the phrase) each word belongs to
  groupOf: readonly number[];
  // What follows each word
  boundaries: readonly Boundary[];
}

// Group a given array of words, including the accents marked as `onlyPoetic`
// only when `poetic` is set
export function groupingOf(words: readonly Word[],
                           poetic: boolean = false): Grouping {
  const accentedWords: AccentedWord[] = [];
  const groups: Group[] = [];
  const roots: number[] = [];
  const groupOf = words.map(() => -1);
  const boundaries = words.map((): Boundary => ({ loc: 'samePhrase' }));

  // 1. Collect together all the info we need for each word
  let nextDisjunctive: Accent | undefined = undefined;
  for (let i = words.length - 1; i >= 0; i--) {
    // Check whether this is a mark used in `specialPuncts`
    const mark = specialPuncts.find((punct) => words[i].text === punct);
    // Otherwise, get the accent of this word
    const accent: Accent | undefined =
        mark !== undefined ? undefined
                           : accentOf(words, i, poetic, nextDisjunctive);
    // Check whether this accent is formed with a taam written after this
    // word's own (e.g. the 'OLE' of an 'OLE_VEYORED'), in which case the
    // accent is written across every word from that one to this
    const { afterTaam } = accentInfo(accent);
    const from = afterTaam && taamBefore(words, i, afterTaam, poetic);
    accentedWords[i] = {
      accent, mark,
      startsAt: from !== undefined && from < i ? from : undefined
    };
    if (isDisjunctive(kindOf(accent))) {
      nextDisjunctive = accent;
    }
  }

  // 2. Group together accents written across more than one word
  for (let i = 0; i < words.length; i++) {
    for (let j = accentedWords[i].startsAt ?? i; j < i; j++) {
      boundaries[j] = { loc: 'sameAccent' };
    }
    if (accentedWords[i + 1]?.mark !== undefined &&
        accentedWords[i + 1].mark === accentInfo(accentedWords[i].accent)
                                        .beforePunct) {
      boundaries[i] = { loc: 'sameAccent' };
    }
  }

  // 3. Build the phrases, clauses, and verses
  let phrases: number[] = [];
  let clauses: number[] = [];
  let clauseStart = 0;
  let verseStart = 0;
  let start = 0;

  for (let i = 0; i < words.length; i++) {
    const kind = kindOf(accentedWords[i].accent);

    // We're still part of the same phrase until we hit a disjunctive accent
    // or the end of the text
    const disjunctive = isDisjunctive(kind);
    if (!disjunctive && i < words.length - 1) {
      continue;
    }
    // A punctuation mark written on its own is also included in the phrase
    let end = i;
    while (accentedWords[end + 1]?.mark !== undefined) {
      end += 1;
    }
    // Build the phrase
    const phrase: Group = {
      id: groups.length, lvl: 'phrase', start, end,
      accent: disjunctive ? accentedWords[i].accent : undefined,
      children: [],
    };
    groups.push(phrase);
    phrases.push(phrase.id);
    for (let j = start; j <= end; j++) {
      groupOf[j] = phrase.id;
    }

    // We're still part of the same clause unless our accent is a remote
    // disjunctive accent or we've hit the end of the text
    const remote = kind === 'remote';
    if (!remote && end < words.length - 1) {
      boundaries[end] = { loc: 'end', closes: phrase.id };
      start = end + 1;
      i = end;
      continue;
    }
    // Build the clause
    const clause: Group = {
      id: groups.length, lvl: 'clause', start: clauseStart, end,
      accent: remote ? accentedWords[i].accent : undefined,
      children: phrases,
    };
    groups.push(clause);
    clauses.push(clause.id);
    for (const id of phrases) {
      groups[id].parent = clause.id;
    }
    clauseStart = end + 1;
    phrases = [];

    // We're still part of the same verse unless our accent is a 'SOF_PASSUQ'
    // or we've hit the end of the text
    const sofPassuq = accentedWords[i].accent === 'SOF_PASSUQ';
    if (!sofPassuq && end < words.length - 1) {
      boundaries[end] = { loc: 'end', closes: clause.id };
      start = end + 1;
      i = end;
      continue;
    }
    // Build the verse
    const verse: Group = {
      id: groups.length, lvl: 'verse', start: verseStart, end,
      accent: sofPassuq ? accentedWords[i].accent : undefined,
      children: clauses,
    };
    groups.push(verse);
    for (const id of clauses) {
      groups[id].parent = verse.id;
    }
    roots.push(verse.id);
    boundaries[end] = { loc: 'end', closes: verse.id };
    verseStart = end + 1;
    clauses = [];

    start = end + 1;
    i = end;
  }

  return { accentedWords, groups, roots, groupOf, boundaries };
}

// The groups containing a group - including the group itself - from outer to
// inner 
export function groupsOfGroup(grouping: Grouping,
                              id: number): readonly Group[] {
  const chain: Group[] = [];
  let at: number | undefined = id;
  while (at !== undefined) {
    const group: Group = grouping.groups[at];
    chain.unshift(group);
    at = group.parent;
  }
  return chain;
}

// The groups a word belongs to, from outer to inner 
export function groupsOf(grouping: Grouping, i: number): readonly Group[] {
  const id = grouping.groupOf[i];
  return id === undefined || id < 0 ? [] : groupsOfGroup(grouping, id);
}

// The groups that the gap immediately following a word is contained within
export function groupsAroundGap(grouping: Grouping,
                                i: number): readonly Group[] {
  const boundary = grouping.boundaries[i];
  if (boundary === undefined) {
    return [];
  }
  return boundary.loc === 'end'
           ? groupsOfGroup(grouping, boundary.closes).slice(0, -1)
           : groupsOf(grouping, i);
}

// ==============
//  Highlighting
// ==============

// The background color of a hovered group of each level
const hoveredGroup: Record<Level, string> = {
  verse: hoveredVerse,
  clause: hoveredClause,
  phrase: hoveredPhrase,
};

// The location where the user is hovering, i.e. either on a word of a given
// index, or on the gap after a word of a given index
export type Hovered =
  | { on: 'word'; index: number }
  // Named by the word the gap follows
  | { on: 'gap'; after: number };

// What to highlight: the groups being hovered and their colors from outer to
// inner and the words being hovered and their colors
export interface Highlighting {
  groups: readonly { id: number; color: string }[];
  words: { indices: readonly number[]; color: string };
}

// Given a grouping and something that is being hovered, return what to
// highlight, or null if nothing should be highlighted - where accents are
// only taken into account if `accents` is true
export function highlightColors(grouping: Grouping, hovered: Hovered,
                                accents: boolean): Highlighting | null {
  const { boundaries, groupOf } = grouping;
  const at = hovered.on === 'word' ? hovered.index : hovered.after;
  if (at < 0 || at >= groupOf.length || groupOf[at] < 0) {
    return null;
  }

  // The word being read, along with every other word the accent it bears is
  // written across, which are colored as one block with it - a gap has no word
  // of its own, only the groups it is still inside
  const indices: number[] = [];
  if (hovered.on === 'word') {
    let from = at;
    while (from > 0 && boundaries[from - 1].loc === 'sameAccent') {
      from -= 1;
    }
    let to = at;
    while (boundaries[to]?.loc === 'sameAccent') {
      to += 1;
    }
    for (let j = from; j <= to; j++) {
      indices.push(j);
    }
  }

  const chain = hovered.on === 'word' ? groupsOf(grouping, at)
                                      : groupsAroundGap(grouping, at);
  return {
    groups: accents ? chain.map(({ id, lvl: level }) =>
                                  ({ id, color: hoveredGroup[level] }))
                    : [],
    words: { indices, color: hoveredWord },
  };
}
