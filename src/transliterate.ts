import { Text } from 'havarotjs';
import type { Word } from 'havarotjs/word';
import { groupsOf, groupsAroundGap, highlightColors, groupingOf,
         syllableColor, type Boundary, type Group, type Hovered,
         type Grouping } from './accents';
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
    // A line only ends with a newline if the text does, so it ends a paragraph
    if (/\n\s*$/.test(heLines[i].textContent ?? '')) {
      heLines[i].classList.add('endsParagraph');
      tlLines[i].classList.add('endsParagraph');
    }
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
      return node instanceof HTMLElement && node.classList.contains('word') &&
             node.dataset.index === String(next);
    });
    if (next !== undefined) {
      splitAtBreak(nodes, end);
    }
    const line = document.createElement('div');
    line.className = 'line';
    line.append(...nodes.slice(cursor, end));
    groupIntoSpans(line);
    lines.push(line);
    cursor = end;
  }

  // Don't call `markEnd` on the last line since it has no ending newline
  lines.slice(0, -1).forEach(markEnd);
  markBreaks(lines);
  heOrTl.append(...lines);
  return lines;
}

// Split the whitespace between two lines at the newline character, the
// whitespace before staying on the line above, and the whitespace after
// staying on the line below
function splitAtBreak(nodes: Node[], end: number): void {
  const node = nodes[end - 1];
  if (node === undefined || !isBlank(node)) {
    return;
  }
  const gap = node.textContent ?? '';
  const nl = gap.lastIndexOf('\n');
  if (nl < 0 || nl === gap.length - 1) {
    return;
  }
  // A gap is a `span` carrying the position it was written at
  const indent = node.cloneNode(true);
  node.textContent = gap.slice(0, nl + 1);
  indent.textContent = gap.slice(nl + 1);
  nodes.splice(end, 0, indent);
}

// Add an `.endLine` class to a line that ends with a newline
function markEnd(line: HTMLDivElement): void {
  const last = line.lastChild;
  if (last instanceof HTMLElement && isBlank(last) &&
      (last.textContent ?? '').includes('\n')) {
    last.classList.add('endsLine');
  }
}

// Mark the `span`s on both sides of a group broken across two lines
function markBreaks(lines: readonly HTMLDivElement[]): void {
  const before = new Map<string, HTMLElement>();
  for (const line of lines) {
    for (const el of line.querySelectorAll<HTMLElement>('.group')) {
      const id = el.dataset.group ?? '';
      const start = before.get(id);
      if (start !== undefined) {
        start.classList.add('breaksAfter');
        el.classList.add('breaksBefore');
      }
      before.set(id, el);
    }
  }
}

function isBlank(node: Node): boolean {
  return (node.textContent ?? '').trim() === '';
}

// [REMAINDER OF THIS SECTION GENERATED ENTIRELY BY AI]

// Wrap the words of a line into spans for highlighting, where a gap which
// closes a group is put outside the span of that group
function groupIntoSpans(line: HTMLDivElement): void {
  const nodes = [...line.childNodes];
  // Leave whatever whitespace ends the line where it is, both because there is
  // nothing there to highlight and because `squeezeToFit` wants to drop it
  let end = nodes.length;
  while (end > 0 && isBlank(nodes[end - 1])) {
    end -= 1;
  }

  const grouped: Node[] = [];
  // The groups open around the node being placed, outermost first, along with
  // the span each of them is being written into on this line
  let open: { id: number; span: HTMLSpanElement }[] = [];

  // Put a node inside the innermost span open around it, or on the line itself
  // if there is none
  const append = (node: Node): void => {
    const span = open[open.length - 1]?.span;
    if (span === undefined) {
      grouped.push(node);
    } else {
      span.append(node);
    }
  };

  // Close whatever spans the next node doesn't belong to, keeping open those
  // it shares with the node before it, and open a span for the rest of its
  // groups
  const reopen = (chain: readonly Group[]): void => {
    let shared = 0;
    while (shared < open.length && shared < chain.length &&
           open[shared].id === chain[shared].id) {
      shared += 1;
    }
    open = open.slice(0, shared);
    for (const group of chain.slice(shared)) {
      const span = document.createElement('span');
      // The level is what the stylesheet knows a span by, and the id what the
      // highlighting paints it by
      span.className = `group ${group.lvl}`;
      span.dataset.group = String(group.id);
      append(span);
      open.push({ id: group.id, span });
    }
  };

  for (const node of nodes.slice(0, end)) {
    const el = node instanceof HTMLElement ? node : null;
    // A gap belongs to the groups still open across it; any other node belongs
    // to the groups of the word it is part of
    const gap = el?.dataset.gap;
    const index = el?.dataset.index;
    const chain = gap !== undefined ? groupsAroundGap(phrasing, Number(gap))
                : index !== undefined ? groupsOf(phrasing, Number(index))
                : [];
    reopen(chain);
    append(node);
  }

  line.replaceChildren(...grouped, ...nodes.slice(end));
}

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
  while (last !== null && isBlank(last)) {
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

// Build a span representing the gap between two words, carrying the index of
// the word before it
//
// A gap which `joins` two words - one written within a single accent, as the
// space before the paseq of a legarmeh is, or that between the two words of an
// ole-veyored - is instead part of the word before it, and carries its index:
// it takes the color of the word rather than of the phrase around it, so that
// the words it falls between are colored as the one accent they are, and is
// hovered over as that word rather than as a gap between anything.
function makeGap(text: string, after: number,
                 boundary: Boundary): HTMLSpanElement {
  const gap = document.createElement('span');
  gap.className = boundary.loc === 'sameAccent' ? 'gap joins' : 'gap';
  if (boundary.loc === 'sameAccent') {
    gap.dataset.index = String(after);
  } else {
    gap.dataset.gap = String(after);
  }
  gap.textContent = text;
  return gap;
}

// The words of the last render, in the order their `data-index` gives them,
// and how they divide into groups. Kept for `highlight`, which colors them.
let words: Word[] = [];
let phrasing: Grouping = groupingOf([]);

function render(caret: number | null): void {
  const text = he.textContent ?? '';
  words = [];
  try {
    words = new Text(text, scheme.syllabificationOptions).words;
  } catch {}
  phrasing = groupingOf(words);
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
    // Add a space after a maqaf in the transliteration
    const afterMaqaf = heSep === '' && word.text.endsWith('־');
    const tlSep = afterMaqaf ? ' ' : heSep;

    // What falls between this word and the next says both where the whitespace
    // between them goes and how it is read
    const boundary = phrasing.boundaries[i];
    if (heSep !== '') {
      he.append(makeGap(heSep, i, boundary));
    }
    if (tlSep !== '') {
      tl.append(makeGap(tlSep, i, boundary));
    }
  });

  alignLines();

  if (caret !== null) {
    setCaret(caret);
  }
}

// ==============================================
//  Word/Syllable highlighting and its listeners
// ==============================================

// The highlighting colors all live in `accents.ts`, so the one of them the
// stylesheet needs is handed to it here
document.documentElement.style.setProperty('--syl-highlight', syllableColor);

// The words given a background by the last `highlight`, so that only those have
// to be put back as they were
let colored: HTMLElement[] = [];

function wordEls(index: number | string): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>(`.word[data-index="${index}"]`);
}

function highlight(hovered: Hovered | null, syl: string | null): void {
  for (const el of document.querySelectorAll('.highlight, .sylHighlight')) {
    el.classList.remove('highlight', 'sylHighlight');
  }
  for (const el of colored) {
    el.style.background = '';
  }
  colored = [];
  if (hovered === null) {
    return;
  }
  const colors = highlightColors(phrasing, hovered, !scheme.boldAccents);
  const paint = (selector: string, color: string): void => {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      el.style.background = color;
      colored.push(el);
    }
  };
  if (colors !== null) {
    for (const { id, color } of colors.groups) {
      paint(`.group[data-group="${id}"]`, color);
    }
    for (const i of colors.words.indices) {
      paint(`.word[data-index="${i}"]`, colors.words.color);
      // A space written within an accent is colored with it, so that every
      // word it is written across is one unbroken block
      paint(`.gap.joins[data-index="${i}"]`, colors.words.color);
    }
  }
  // Only a word is read syllable by syllable; a gap has none to mark
  if (hovered.on === 'word') {
    const word = `.word[data-index="${hovered.index}"]`;
    for (const el of wordEls(hovered.index)) {
      el.classList.add('highlight');
    }
    if (syl !== null) {
      for (const el of document.querySelectorAll(`${word} > .syl[data-syl="${syl}"]`)) {
        el.classList.add('sylHighlight');
      }
    }
  }
}

function highlightEl(target: HTMLElement): void {
  const el = target.closest<HTMLElement>('[data-index], [data-gap]');
  const syl = target.closest<HTMLElement>('.syl');
  const gap = el?.dataset.gap;
  const index = el?.dataset.index;
  const hovered: Hovered | null =
      gap !== undefined ? { on: 'gap', after: Number(gap) }
    : index !== undefined ? { on: 'word', index: Number(index) }
    : null;
  highlight(hovered, syl?.dataset.syl ?? null);
}

for (const heOrTl of [he, tl]) {
  heOrTl.addEventListener('mouseover', (e) => {
    highlightEl(e.target as HTMLElement)
  });
  heOrTl.addEventListener('mouseleave', () => {
    highlight(null, null)
  });
  heOrTl.addEventListener('touchstart', (e) => {
    highlightEl(e.target as HTMLElement);
  });
}

// A tap anywhere else clears the highlighting
document.addEventListener('touchstart', (e) => {
  const target = e.target as HTMLElement;
  if (!he.contains(target) && !tl.contains(target)) {
    highlight(null, null);
  }
});

// ==========================================
//  Showing a caret over `tl` when selecting
// ==========================================

tl.addEventListener('mousedown', () => tl.classList.add('selecting'));
document.addEventListener('mouseup', () => tl.classList.remove('selecting'));

// ===================================================
//  Listeners to keep the contents of `he` plain text
// ===================================================

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

// ==================================
//  URL parameters and its listeners
// ==================================

const QUERY_KEY = 'q';
const DEFAULT_TEXT =
  'שְׁמַ֖ע יִשְׂרָאֵ֑ל יְהֹוָ֥ה אֱלֹהֵ֖ינוּ יְהֹוָ֥ה ׀ אֶחָֽד׃\n' +
  'וְאָ֣הַבְתָּ֔ אֵ֖ת יְהֹוָ֣ה אֱלֹהֶ֑יךָ בְּכׇל־לְבָבְךָ֥ וּבְכׇל־נַפְשְׁךָ֖ וּבְכׇל־מְאֹדֶֽךָ׃ ' +
  'וְהָי֞וּ הַדְּבָרִ֣ים הָאֵ֗לֶּה אֲשֶׁ֨ר אָנֹכִ֧י מְצַוְּךָ֛ הַיּ֖וֹם עַל־לְבָבֶֽךָ׃ ' +
  'וְשִׁנַּנְתָּ֣ם לְבָנֶ֔יךָ וְדִבַּרְתָּ֖ בָּ֑ם בְּשִׁבְתְּךָ֤ בְּבֵיתֶ֙ךָ֙ וּבְלֶכְתְּךָ֣ בַדֶּ֔רֶךְ וּֽבְשׇׁכְבְּךָ֖ וּבְקוּמֶֽךָ׃ ' +
  'וּקְשַׁרְתָּ֥ם לְא֖וֹת עַל־יָדֶ֑ךָ וְהָי֥וּ לְטֹטָפֹ֖ת בֵּ֥ין עֵינֶֽיךָ׃ ' +
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

// ============================
//  Printing and its listeners
// ============================

// In order to `squeezeToFit`, we need to decide a layout in advance
const PRINT_WIDTH = '7.5in'; // 8.5in - 2 * 0.5in (see @page)
const PRINT_SCALE = 12 / 13.5;
const PRINT_LETTER_SPACING = '-0.035em';
const PRINT_WORD_SPACING = '0.34em';
const PRINT_EDGE = '5%';

const bodyContainer = document.querySelector('.bodyContainer') as HTMLDivElement;
const heAndTl = document.querySelector('.heAndTl') as HTMLDivElement;

// Sneakily apply everything on the screen to get our measurements
function renderForPrint(printing: boolean): void {
  bodyContainer.style.width = printing ? PRINT_WIDTH : '';
  heAndTl.style.setProperty('--scale', printing ? String(PRINT_SCALE) : '');
  heAndTl.style.setProperty('--letter-spacing', printing ? PRINT_LETTER_SPACING : '');
  heAndTl.style.setProperty('--word-spacing', printing ? PRINT_WORD_SPACING : '');
  heAndTl.style.setProperty('--edge', printing ? String(PRINT_EDGE) : '');
  render(null);
  // Ensure that the `ResizeObserver` doesn't fire
  const style = getComputedStyle(he);
  lastWidth = he.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
}

window.addEventListener('beforeprint', () => renderForPrint(true));
window.addEventListener('afterprint', () => renderForPrint(false));

// ===================================
//  Other listeners and initial setup
// ===================================

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
