import { Text } from 'havarotjs';
import type { Word } from 'havarotjs/word';
import { DefaultTransliterationScheme } from 'havarotjs/transliteration';
import { EditHistory } from './history';

const scheme = new DefaultTransliterationScheme();

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

function syllabify(word: Word): [string[], string[]] {
  try {
    const [heParts, tlParts]: [string[], string[]] = [[], []];
    for (const syl of word.syllables) {
      heParts.push(syl.text);
      tlParts.push(scheme.trl(syl));
    }
    return [heParts, tlParts];
  } catch {}
  // If we failed above, just highlight the entire word as one syllable
  return [[word.text], [transliterate(word)]];
}

function makeWord(index: string, syllables: string[], sep: string): HTMLSpanElement {
  const wordSpan = document.createElement('span');
  wordSpan.className = 'word';
  wordSpan.dataset.index = index;

  syllables.forEach((text, i) => {
    if (i > 0 && sep !== '') {
      wordSpan.append(sep);
    }
    const sylSpan = document.createElement('span');
    sylSpan.className = 'syl';
    sylSpan.dataset.syl = String(i);
    sylSpan.textContent = text;
    wordSpan.append(sylSpan);
  });

  return wordSpan;
}

function render(caret: number | null): void {
  const words = new Text(he.textContent ?? '')
                    .replaceDivineName(scheme.divineName)
                    .words;

  he.replaceChildren();
  tl.replaceChildren();

  words.forEach((word, i) => {
    const index = String(i);
    const [heSyls, tlSyls] = syllabify(word);

    he.append(makeWord(index, heSyls, ''));
    tl.append(makeWord(index, tlSyls, scheme.syllableSeparator));

    const sep = word.whiteSpaceAfter ?? '';
    he.append(sep);
    tl.append(sep);
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
const DEFAULT_TEXT = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים';
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

he.textContent = loadFromURL();
render(null);
