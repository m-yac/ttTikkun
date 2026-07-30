import { Text } from 'havarotjs';
import type { Word } from 'havarotjs/word';
import { EditHistory } from './history';
import { OptionsScheme, setupOptions } from './options';

const scheme = new OptionsScheme();

const he = document.getElementById('he') as HTMLDivElement;
const tl = document.getElementById('tl') as HTMLDivElement;

const editHistory = new EditHistory({
  el: he,
  getText: () => he.textContent ?? '',
  getCaret,
  restored: (caret) => {
    render(caret);
    save();
  },
});

// =====================================
//  Managing the cursor (caret) in `he`
// =====================================

// The offset of a (node, offset) DOM position in the plain text of `he`
function offsetOf(node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(he);
  range.setEnd(node, offset);
  return range.toString().length;
}

// The current selection in `he` as a `[start, end]` pair of plain text offsets
function getSelectionRange(): [number, number] | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode ||
      !he.contains(sel.anchorNode) || !he.contains(sel.focusNode)) {
    return null;
  }
  const anchor = offsetOf(sel.anchorNode, sel.anchorOffset);
  const focus = offsetOf(sel.focusNode, sel.focusOffset);
  return anchor <= focus ? [anchor, focus] : [focus, anchor];
}

function getCaret(): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.focusNode || !he.contains(sel.focusNode)) {
    return null;
  }
  return offsetOf(sel.focusNode, sel.focusOffset);
}

function setCaret(offset: number): void {
  const walker = document.createTreeWalker(he, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (seen + len >= offset) {
      const range = document.createRange();
      range.setStart(node, offset - seen);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    seen += len;
  }
}

// ==============================
//  Ensuring word/line alignment
// ==============================

function alignLines(): void {
  const heWords = [...he.querySelectorAll<HTMLElement>(':scope > .word')];
  if (heWords.length === 0) {
    return;
  }

  const starts: number[] = [];
  let top = -Infinity;
  heWords.forEach((word, i) => {
    if (word.offsetTop > top) {
      starts.push(i);
      top = word.offsetTop;
    }
  });

  const heLines = groupIntoLines(he, starts);
  const tlLines = groupIntoLines(tl, starts);

  for (const line of tlLines) {
    squeezeToFit(line);
  }

  for (let i = 0; i < heLines.length; i++) {
    const height = Math.max(heLines[i].offsetHeight, tlLines[i].offsetHeight);
    heLines[i].style.minHeight = `${height}px`;
    tlLines[i].style.minHeight = `${height}px`;
  }
}

function groupIntoLines(heOrTl: HTMLElement, starts: number[]): HTMLDivElement[] {
  const nodes = [...heOrTl.childNodes];
  const lines: HTMLDivElement[] = [];

  let cursor = 0;
  for (let i = 0; i < starts.length; i++) {
    const next = starts[i + 1];
    const end = next === undefined ? nodes.length : nodes.findIndex((node) => {
      return node instanceof HTMLElement && node.dataset.index === String(next);
    });
    const line = document.createElement('div');
    line.className = 'line';
    line.append(...nodes.slice(cursor, end));
    lines.push(line);
    cursor = end;
  }

  heOrTl.append(...lines);
  return lines;
}

// [REMAINDER OF THIS SECTION GENERATED ENTIRELY BY AI]

// A line of `tl` is always a bit wider than the line of `he` it corresponds to,
// and letting it wrap would break the alignment of the two panels. Instead we
// tighten its letter spacing until it fits, which never takes much. If even the
// tightest spacing we allow isn't enough, we give up and let the line wrap.
const MAX_SQUEEZE_EM = 0.03;
const SQUEEZE_STEPS = 3;
// Ignore overflow this small, which is just `scrollWidth` rounding to whole px
const SQUEEZE_SLACK_PX = 1;

function squeezeToFit(line: HTMLDivElement): void {
  // Any whitespace at the end of the line is invisible when the line wraps, but
  // once it can't, a trailing space widens it and a trailing newline doubles its
  // height, so drop it. (`tl` is rebuilt from scratch on every render, so there
  // is nothing to restore.)
  let last = line.lastChild;
  while (last !== null && last.nodeType === Node.TEXT_NODE &&
         (last.textContent ?? '').trim() === '') {
    line.removeChild(last);
    last = line.lastChild;
  }

  const chars = line.textContent?.length ?? 0;
  if (chars === 0) {
    return;
  }

  line.style.whiteSpace = 'pre';
  const style = getComputedStyle(line);
  const spacing = parseFloat(style.letterSpacing) || 0;
  const minSpacing = spacing - MAX_SQUEEZE_EM * parseFloat(style.fontSize);

  let current = spacing;
  for (let i = 0; i < SQUEEZE_STEPS; i++) {
    const overflow = line.scrollWidth - line.clientWidth;
    if (overflow <= SQUEEZE_SLACK_PX) {
      return;
    }
    if (current <= minSpacing) {
      break;
    }
    // Letter spacing is added after every character, so this much less of it
    // per character makes up for the overflow
    current = Math.max(minSpacing, current - overflow / chars);
    line.style.letterSpacing = `${current}px`;
  }

  if (line.scrollWidth - line.clientWidth > SQUEEZE_SLACK_PX) {
    line.style.whiteSpace = '';
    line.style.letterSpacing = '';
  }
}

// =========================
//  Rendering `he` and `tl`
// =========================

function transliterate(word: Word): string {
  try {
    return scheme.trl(word);
  } catch {
    return word.text;
  }
}

// Which syllable of a word carries its stress, or -1 if none does.
//
// `isAccented` is set on every syllable bearing a taam, of which a word may
// have more than one: a conjunctive within a word is a secondary accent, as the
// munach of וְאָ֣הַבְתָּ֔ is, and always precedes the accent proper. (The cases
// where a taam is instead written away from the stress, as a postpositive or
// prepositive or with one of the "helper" taamim of MAPM, are already resolved
// to the one accented syllable by `havarotjs`.) So the stress is the last of
// them.
function stressOf(syllables: readonly { isAccented: boolean }[]): number {
  return syllables.map((syl) => syl.isAccented).lastIndexOf(true);
}

// The syllables of a word in Hebrew and transliterated, along with an array
// identifying which of them are non-final stressed syllables
function syllabify(word: Word): [string[], string[], boolean[]] {
  try {
    const [heParts, tlParts]: [string[], string[]] = [[], []];
    for (const syl of word.syllables) {
      heParts.push(syl.text);
      tlParts.push(scheme.trl(syl));
    }
    const stress = stressOf(word.syllables);
    const tlStressed = heParts.map((_, i) => i === stress && i < heParts.length - 1);
    return [heParts, tlParts, tlStressed];
  } catch {}
  // If we failed above, just highlight the entire word as one syllable
  return [[word.text], [transliterate(word)], [false]];
}

function makeWord(index: string, syllables: string[], sep: string = '', capitalize: boolean = false, stressed: boolean[] = []): HTMLSpanElement {
  const wordSpan = document.createElement('span');
  wordSpan.className = 'word';
  wordSpan.dataset.index = index;

  syllables.forEach((text, i) => {
    if (i === 0 && capitalize) {
      // Uppercase the first lowercase (unicode!) character
      text = text.replace(/\p{Ll}/u, (c) => c.toUpperCase());
    }
    if (i > 0 && sep !== '') {
      wordSpan.append(sep);
    }
    const sylSpan = document.createElement('span');
    sylSpan.className = 'syl';
    sylSpan.dataset.syl = String(i);
    if (scheme.boldAccents && stressed[i]) {
      const b = document.createElement('b');
      b.textContent = text;
      sylSpan.append(b);
    } else {
      sylSpan.textContent = text;
    }
    wordSpan.append(sylSpan);
  });

  return wordSpan;
}

function render(caret: number | null): void {
  const text = he.textContent ?? '';
  let words: Word[] = [];
  try {
    words = new Text(text, scheme.syllabificationOptions).words;
  } catch {}
  const hasSofPassuq = text.includes('׃');

  he.replaceChildren();
  tl.replaceChildren();

  tl.classList.toggle('boldAccents', scheme.boldAccents);

  words.forEach((word, i) => {
    const index = String(i);
    const [heSyls, tlSyls, tlStressed] = syllabify(word);

    // Only capitalize if the text contains verses, and this word is either the
    // very first word, or the first word after the end of a verse
    const startsVerse = hasSofPassuq && (i === 0 || words[i - 1].text.includes('׃'));

    he.append(makeWord(index, heSyls));
    tl.append(makeWord(index, tlSyls,
                       scheme.syllableSeparator, startsVerse, tlStressed));

    const heSep = word.whiteSpaceAfter ?? '';
    he.append(heSep);

    // Add a space after a maqaf in the transliteration
    const afterMaqaf = heSep === '' && word.text.endsWith('־');
    const tlSep = afterMaqaf ? ' ' : heSep;
    tl.append(tlSep);
  });

  alignLines();

  if (caret !== null) {
    setCaret(caret);
  }
}

// ============================
//  Word/Syllable Highlighting
// ============================

function highlight(index: string | null, syl: string | null): void {
  for (const el of document.querySelectorAll('.highlight, .sylHighlight')) {
    el.classList.remove('highlight', 'sylHighlight');
  }
  if (index === null) {
    return;
  }
  const word = `.word[data-index="${index}"]`;
  for (const el of document.querySelectorAll(word)) {
    el.classList.add('highlight');
  }
  if (syl !== null) {
    for (const el of document.querySelectorAll(`${word} > .syl[data-syl="${syl}"]`)) {
      el.classList.add('sylHighlight');
    }
  }
}

for (const heOrTl of [he, tl]) {
  heOrTl.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    const word = target.closest<HTMLElement>('.word');
    const syl = target.closest<HTMLElement>('.syl');
    highlight(word?.dataset.index ?? null, syl?.dataset.syl ?? null);
  });
  heOrTl.addEventListener('mouseleave', () => highlight(null, null));
}

// =========================================
//  Keeping the contents of `he` plain text
// =========================================

function insertText(text: string): void {
  if (text === '') {
    return;
  }
  // `insertText` is deprecated, but it is the only way to insert text into a
  // `contenteditable` such that `beforeinput`/`input` fire as they do on typing
  if (document.execCommand('insertText', false, text)) {
    return;
  }
  // If that doesn't work we have to do it manually
  const heText = he.textContent ?? '';
  const [start, end] = getSelectionRange() ?? [heText.length, heText.length];
  const before = { text: heText, caret: start };
  he.textContent = before.text.slice(0, start) + text + before.text.slice(end);
  editHistory.push(before, 'insertFromPaste');
  render(start + text.length);
  save();
}

// Normalize text arriving from the clipboard or a drag-and-drop
function asPlainText(data: DataTransfer | null): string {
  return (data?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n');
}

he.addEventListener('paste', (e) => {
  e.preventDefault();
  insertText(asPlainText(e.clipboardData));
});

he.addEventListener('drop', (e) => {
  e.preventDefault();
  he.focus();
  insertText(asPlainText(e.dataTransfer));
});

// Disallow dragging
he.addEventListener('dragstart', (e) => e.preventDefault());

// ================
//  URL parameters
// ================

const QUERY_KEY = 'q';
const DEFAULT_TEXT =
  'שְׁמַ֖ע יִשְׂרָאֵ֑ל יְהֹוָ֥ה אֱלֹהֵ֖ינוּ יְהֹוָ֥ה ׀ אֶחָֽד׃\n' +
  'וְאָ֣הַבְתָּ֔ אֵ֖ת יְהֹוָ֣ה אֱלֹהֶ֑יךָ בְּכׇל־לְבָבְךָ֥ וּבְכׇל־נַפְשְׁךָ֖ וּבְכׇל־מְאֹדֶֽךָ׃\n' +
  'וְהָי֞וּ הַדְּבָרִ֣ים הָאֵ֗לֶּה אֲשֶׁ֨ר אָנֹכִ֧י מְצַוְּךָ֛ הַיּ֖וֹם עַל־לְבָבֶֽךָ׃\n' +
  'וְשִׁנַּנְתָּ֣ם לְבָנֶ֔יךָ וְדִבַּרְתָּ֖ בָּ֑ם בְּשִׁבְתְּךָ֤ בְּבֵיתֶ֙ךָ֙ וּבְלֶכְתְּךָ֣ בַדֶּ֔רֶךְ וּֽבְשׇׁכְבְּךָ֖ וּבְקוּמֶֽךָ׃\n' +
  'וּקְשַׁרְתָּ֥ם לְא֖וֹת עַל־יָדֶ֑ךָ וְהָי֥וּ לְטֹטָפֹ֖ת בֵּ֥ין עֵינֶֽיךָ׃\n' +
  'וּכְתַבְתָּ֛ם עַל־מְזֻז֥וֹת בֵּיתֶ֖ךָ וּבִשְׁעָרֶֽיךָ׃';
const MIN_URL_CHANGE_MS = 400;

function loadFromURL(): string {
  return new URL(window.location.href).searchParams.get(QUERY_KEY) ?? DEFAULT_TEXT;
}

let saveTimer = 0;

function save(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveTimeout, MIN_URL_CHANGE_MS);
}
function saveTimeout(): void {
  clearTimeout(saveTimer);
  const text = he.textContent ?? '';
  const url = new URL(window.location.href);
  if (text === '') {
    url.searchParams.delete(QUERY_KEY);
  } else {
    url.searchParams.set(QUERY_KEY, text);
  }
  if (url.href !== window.location.href) {
    history.replaceState(null, '', url);
  }
}

// Make sure the URL is up to date before the page is left or copied from
he.addEventListener('blur', saveTimeout);
window.addEventListener('pagehide', saveTimeout);

// =====================
//  Listeners and setup
// =====================

// re-render on text input
he.addEventListener('input', () => {
  render(getCaret());
  save();
});

// re-render on resize
let lastWidth = 0;
new ResizeObserver(([entry]) => {
  const width = entry.contentRect.width;
  if (width !== lastWidth) {
    lastWidth = width;
    render(getCaret());
  }
}).observe(he);

// re-render whenever a transliteration option is changed
setupOptions(scheme.opts, () => render(getCaret()));

// re-render whenever a webfont finishes loading
document.fonts.addEventListener('loadingdone', () => render(getCaret()));

he.textContent = loadFromURL();
render(null);
