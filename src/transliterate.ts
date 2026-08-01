import { Text } from 'havarotjs';
import type { Word } from 'havarotjs/word';
import { groupsOf, groupsAroundGap, highlightColors, groupingOf,
         syllableColor, type Boundary, type Group, type Hovered,
         type Grouping } from './accents';
import { EditableText } from './editable';
import { OptionsScheme, setupOptions } from './options';

// =========================
//  Constants and variables
// =========================

// The Hebrew text that loads when you first visit the page
const DEFAULT_TEXT =
  'שְׁמַ֖ע יִשְׂרָאֵ֑ל יְהֹוָ֥ה אֱלֹהֵ֖ינוּ יְהֹוָ֥ה ׀ אֶחָֽד׃\n' +
  'וְאָ֣הַבְתָּ֔ אֵ֖ת יְהֹוָ֣ה אֱלֹהֶ֑יךָ בְּכׇל־לְבָבְךָ֥ וּבְכׇל־נַפְשְׁךָ֖ וּבְכׇל־מְאֹדֶֽךָ׃ ' +
  'וְהָי֞וּ הַדְּבָרִ֣ים הָאֵ֗לֶּה אֲשֶׁ֨ר אָנֹכִ֧י מְצַוְּךָ֛ הַיּ֖וֹם עַל־לְבָבֶֽךָ׃ ' +
  'וְשִׁנַּנְתָּ֣ם לְבָנֶ֔יךָ וְדִבַּרְתָּ֖ בָּ֑ם בְּשִׁבְתְּךָ֤ בְּבֵיתֶ֙ךָ֙ וּבְלֶכְתְּךָ֣ בַדֶּ֔רֶךְ וּֽבְשׇׁכְבְּךָ֖ וּבְקוּמֶֽךָ׃ ' +
  'וּקְשַׁרְתָּ֥ם לְא֖וֹת עַל־יָדֶ֑ךָ וְהָי֥וּ לְטֹטָפֹ֖ת בֵּ֥ין עֵינֶֽיךָ׃ ' +
  'וּכְתַבְתָּ֛ם עַל־מְזֻז֥וֹת בֵּיתֶ֖ךָ וּבִשְׁעָרֶֽיךָ׃';

// URL parameter constants
const HE_TEXT_PARAM = 'q';
const MIN_URL_CHANGE_MS = 400;

// Printing constants
const PRINT_WIDTH = '7.5in'; // 8.5in - 2 * 0.5in (see @page)
const PRINT_SCALE = 12 / 13.5;
const PRINT_LETTER_SPACING = '-0.035em';
const PRINT_WORD_SPACING = '0.34em';
const PRINT_EDGE = '5%';

// Relevant `HTMLDivElement`s
const bodyContainer =
  document.querySelector('.bodyContainer') as HTMLDivElement;
const heAndTl = document.querySelector('.heAndTl') as HTMLDivElement;
const he = document.getElementById('he') as HTMLDivElement;
const tl = document.getElementById('tl') as HTMLDivElement;

// The transliteration options
const scheme = new OptionsScheme();

// The object that controls edits to the Hebrew text
const heText = new EditableText(he, {
  changed: (caret) => {
    render(caret);
    save();
  },
});

// Suppress re-rendering on resize once
let dontResize = false;

// Saved values across rendering passes
let lastWidth = 0;
let lastGrouping: Grouping = groupingOf([]);


// =========================
//  Rendering `he` and `tl`
// =========================

// Called whenever the content or formatting of `he` and `tl` changes (see
// below)
function render(caret: number | null): void {
  // Convert the text into words and group them
  let words: Word[] = [];
  try {
    words = new Text(heText.text, scheme.syllabificationOptions).words;
  } catch (e) {
    console.error(`Failed to syllabify Hebrew text!`)
    console.error(e);
  }
  lastGrouping = groupingOf(words);
  const { wsStart, srcWords, wsEnd } = matchWords(heText.text, words);
  const hasVerses = heText.text.includes('׃');

  // Clear the two divs
  he.replaceChildren();
  tl.replaceChildren();

  // Add any classes needed by the options
  tl.classList.toggle('boldAccents', scheme.boldAccents);

  // Add any initial whitespace
  if (wsStart !== '') {
    he.append(wsStart);
    tl.append(wsStart);
  }

  // Add the words
  for (let i = 0; i < words.length; i++) {
    const index = String(i);
    const [heSyls, tlSyls, tlStressed] =
      syllabifyAndTransliterate(words[i], srcWords[i].text);

    // Only capitalize if the text contains verses, and this word is either the
    // very first word, or the first word after the end of a verse
    const startsVerse = hasVerses && (i === 0 || words[i - 1].text.includes('׃'));

    he.append(makeWord(index, heSyls));
    tl.append(makeWord(index, tlSyls,
                       scheme.syllableSeparator, startsVerse, tlStressed));

    const heSep = srcWords[i].wsAfter;
    // Add a space after a maqaf in the transliteration
    const afterMaqaf = heSep === '' && words[i].text.endsWith('־');
    const tlSep = afterMaqaf ? ' ' : heSep;

    // What falls between this word and the next says both where the whitespace
    // between them goes and how it is read
    const boundary = lastGrouping.boundaries[i];
    if (heSep !== '') {
      he.append(makeGap(heSep, i, boundary));
    }
    if (tlSep !== '') {
      tl.append(makeGap(tlSep, i, boundary));
    }
  };

  // Add any final whitespace
  if (wsEnd !== '') {
    he.append(wsEnd);
    tl.append(wsEnd);
  }

  // Break and/or stretch `tl` to match the lines of `he`
  alignLines();

  if (caret !== null) {
    heText.setCaret(caret);
  }
}

// Re-render whenever a transliteration option is changed
setupOptions(scheme.opts, () => render(heText.caret));

// Re-render whenever a webfont finishes loading
document.fonts.addEventListener('loadingdone', () => render(heText.caret));

// Re-render on resize
new ResizeObserver(([entry]) => {
  if (dontResize) {
    dontResize = false;
    return;
  }
  const width = entry.contentRect.width;
  if (width !== lastWidth) {
    lastWidth = width;
    render(heText.caret);
  }
}).observe(he);

// When printing, sneakily re-render everything on-screen according to the size
// of our page so we know how to break/stretch `tl`, then set everything back
window.addEventListener('beforeprint', () => {
  bodyContainer.style.width = PRINT_WIDTH;
  heAndTl.style.setProperty('--scale', String(PRINT_SCALE));
  heAndTl.style.setProperty('--letter-spacing', PRINT_LETTER_SPACING);
  heAndTl.style.setProperty('--word-spacing', PRINT_WORD_SPACING);
  heAndTl.style.setProperty('--edge', String(PRINT_EDGE));
  dontResize = true;
  render(null);
});
window.addEventListener('afterprint', () => {
  bodyContainer.style.width = '';
  heAndTl.style.setProperty('--scale', '');
  heAndTl.style.setProperty('--letter-spacing', '');
  heAndTl.style.setProperty('--word-spacing', '');
  heAndTl.style.setProperty('--edge', '');
  dontResize = true;
  render(null);
});


// ===================================
//  Forming words and transliterating
// ===================================

function syllabifyAndTransliterate(word: Word,src: string) :
                                  [string[], string[], boolean[]] {

  // First, try to transliterate syllable-by-syllable
  try {
    const [heSyls, tlSyls]: [string[], string[]] = [[], []];
    for (const syl of word.syllables) {
      heSyls.push(syl.text);
      tlSyls.push(scheme.trl(syl));
    }
    // The stressed syllable is the final accented syllable
    const heStress = word.syllables.map((syl) => syl.isAccented)
                                   .lastIndexOf(true);
    // In the transliteration, we don't display stress on the
    // final syllable, since it's so common
    const tlStress = heSyls.map((_, i) => i === heStress &&
                                          i < heSyls.length - 1);
    return [matchSyls(src, heSyls), tlSyls, tlStress];
  } catch (e) {
    console.error(
      `Failed to transliterate by syllable: ${word.text}`)
    console.error(e);
  }

  // If that failed, try to transliterate the entire word as one unit
  try {
    return [[src], [scheme.trl(word)], [false]];
  } catch (e) {
    console.error(
      `Failed to transliterate: ${word.text}`)
    console.error(e);
  }

  // If that still failed, just pass along the word without transliterating
  return [[src], [word.text], [false]];
}

// Divide up a source string into syllables to match the way the given
// syllables are divided, since the two strings will usually, but in theory
// may not always, match
function matchSyls(src: string, syls: readonly string[]): string[] {
  const sylsLength = syls.reduce((n, part) => n + part.length, 0);
  if (sylsLength !== src.length) {
    return [src];
  }
  let pos = 0;
  return syls.map((part) => {
    pos += part.length;
    return src.slice(pos - part.length, pos);
  });
}

interface SrcWord { text: string; wsAfter: string }

// Divide up a source string into words to match the way the given words are
// divided - the two will likely not match up due to whitespace before,
// between, and after each word
function matchWords(src: string, words: readonly Word[]): {
  wsStart: string; srcWords: SrcWord[]; wsEnd: string
} {
  let pos = 0;
  const whitespace = (): string => {
    const start = pos;
    while (pos < src.length && /\s/.test(src[pos])) {
      pos += 1;
    }
    return src.slice(start, pos);
  };

  const lead = whitespace();
  const pieces = words.map((word) => {
    // A word of the parse is as long as the word it was made from, unless the
    // two have somehow fallen out of step, in which case take the run of
    // non-whitespace written here and continue
    let len = word.text.length;
    if (/\s/.test(src.slice(pos, pos + len))) {
      len = (/^\S*/.exec(src.slice(pos)) ?? [''])[0].length;
    }
    pos += len;
    return { text: src.slice(pos - len, pos), wsAfter: whitespace() };
  });
  return { wsStart: lead, srcWords: pieces, wsEnd: src.slice(pos) };
}

// Build the `<span>` corresponding to a word in `he` or `tl`
function makeWord(
  index: string, syllables: string[],
  sep: string = '', capitalize: boolean = false, stressed: boolean[] = []
): HTMLSpanElement {
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

// Build the span representing the gap between two words (identified by the
// index of the word before it)
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


// ====================================================================
//  Ensuring word/line alignment [THIS SECTION GENERATED MOSTLY BY AI]
// ====================================================================

function alignLines(): void {
  const heWords = [...he.querySelectorAll<HTMLElement>(':scope > .word')];
  if (heWords.length === 0) {
    showEmptyLastLine();
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

  // Before anything is measured, so that the empty line is one of the heights
  // the two panels are squared up to
  showEmptyLastLine();

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

function showEmptyLastLine(): void {
  if (!heText.text.endsWith('\n')) {
    return;
  }
  const lines = he.querySelectorAll(':scope > .line');
  (lines[lines.length - 1] ?? he).append(document.createElement('br'));
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

  // Don't call `markEnd` on the last line since it has no line below it to
  // stand in for the newline it ends with - it is left to break as it was
  // written, giving the empty line at the end of the text somewhere for the
  // caret to sit
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
    const chain = gap !== undefined ? groupsAroundGap(lastGrouping, Number(gap))
                : index !== undefined ? groupsOf(lastGrouping, Number(index))
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
  const colors = highlightColors(lastGrouping, hovered, !scheme.boldAccents);
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


// ==================================
//  URL parameters and initial setup
// ==================================

function loadFromURL(): string {
  return new URL(window.location.href).searchParams
                                      .get(HE_TEXT_PARAM) ?? DEFAULT_TEXT;
}

let saveTimer = 0;

function save(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveTimeout, MIN_URL_CHANGE_MS);
}

function saveTimeout(): void {
  clearTimeout(saveTimer);
  const url = new URL(window.location.href);
  if (heText.text === '') {
    url.searchParams.delete(HE_TEXT_PARAM);
  } else {
    url.searchParams.set(HE_TEXT_PARAM, heText.text);
  }
  if (url.href !== window.location.href) {
    history.replaceState(null, '', url);
  }
}

// Make sure the URL is up to date before the page is left or copied from
he.addEventListener('blur', saveTimeout);
window.addEventListener('pagehide', saveTimeout);

// Show a caret-cursor over `tl` only when selecting
tl.addEventListener('mousedown', () => tl.classList.add('selecting'));
document.addEventListener('mouseup', () => tl.classList.remove('selecting'));

heText.reset(loadFromURL());
render(null);
