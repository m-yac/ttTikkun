import { Text } from 'havarotjs';
import type { Word } from 'havarotjs/word';
import { DefaultTransliterationScheme } from 'havarotjs/transliteration';

const scheme = new DefaultTransliterationScheme();

const he = document.getElementById('he') as HTMLDivElement;
const tl = document.getElementById('tl') as HTMLDivElement;

// =====================================
//  Managing the cursor (caret) in `he`
// =====================================

function getCaret(): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.focusNode || !he.contains(sel.focusNode)) {
    return null;
  }
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(he);
  range.setEnd(sel.focusNode, sel.focusOffset);
  return range.toString().length;
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

function render(): void {
  const caret = getCaret();
  const words = new Text(he.textContent ?? '')
                    .replaceDivineName(scheme.divineName)
                    .words;

  he.replaceChildren();
  tl.replaceChildren();

  words.forEach((word, i) => {
    const index = String(i);

    const heSpan = document.createElement('span');
    heSpan.className = 'word';
    heSpan.dataset.index = index;
    heSpan.textContent = word.text;
    he.append(heSpan);

    const trlSpan = document.createElement('span');
    trlSpan.className = 'word';
    trlSpan.dataset.index = index;
    trlSpan.textContent = transliterate(word);
    tl.append(trlSpan);

    const sep = word.whiteSpaceAfter ?? '';
    he.append(sep);
    tl.append(sep);
  });

  alignLines();

  if (caret !== null) {
    setCaret(caret);
  }
}

// =====================
//  Listeners and setup
// =====================

function highlight(index: string | null): void {
  for (const el of document.querySelectorAll('.word.highlight')) {
    el.classList.remove('highlight');
  }
  if (index !== null) {
    for (const el of document.querySelectorAll(`.word[data-index="${index}"]`)) {
      el.classList.add('highlight');
    }
  }
}

for (const heOrTl of [he, tl]) {
  heOrTl.addEventListener('mouseover', (e) => {
    const word = (e.target as HTMLElement).closest<HTMLElement>('.word');
    highlight(word?.dataset.index ?? null);
  });
  heOrTl.addEventListener('mouseleave', () => highlight(null));
}

he.addEventListener('input', render);

// re-render on resize
let lastWidth = 0;
new ResizeObserver(([entry]) => {
  const width = entry.contentRect.width;
  if (width !== lastWidth) {
    lastWidth = width;
    render();
  }
}).observe(he);

he.textContent = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים';
render();
