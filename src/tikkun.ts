import { VerseRef, type Fragment, type Line, type Page } from "./data"

// ================================================
//  Adapted from `tikkun.io/src/hebrew-numeral.ts`
// ================================================

function asVersesRange(verses: VerseRef[]): string {
  const strings = verses.map((verse) => {
    const components = verse.verse === 1 ? [verse.chapter, verse.verse]
                                         : [verse.verse];
    return components.join(':');
  });

  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];
  return [strings[0], strings[strings.length - 1]].join('-');
}


// =============================================
//  Adapted from `tikkun.io/src/text-filter.ts`
// =============================================

const NUN_HAFUCHA = '׆';

/** Strips the ketiv, leaving the (vocalized) kri wrapped in `{`...`}`. */
export function ketiv(text: string): string {
  return text
    .replace('#(פ)', '')
    .replace(`(${NUN_HAFUCHA})#`, `${NUN_HAFUCHA} `)
    .replace(`#(${NUN_HAFUCHA})`, ` ${NUN_HAFUCHA}`)
    .split(' ')
    .map((maqafSeparatedWord) =>
      maqafSeparatedWord
        .split('־')
        .map((word) => {
          const parts = word.split('#');

          if (parts.length <= 1) {
            // i.e. there is no `#`, so just take the word
            return parts[0];
          }
          return parts.slice(1);
        })
        .join('־'),
    )
    .join(' ')
    .replace(/\[/g, '{')
    .replace(/\]/g, '}');
}

/** Strips the kri and all vocalization, leaving the bare text of the scroll. */
export function kri(text: string): string {
  return text
    .replace('#(פ)', '')
    .replace(`(${NUN_HAFUCHA})#`, `${NUN_HAFUCHA} `)
    .replace(`#(${NUN_HAFUCHA})`, ` ${NUN_HAFUCHA}`)
    .replace(/־/g, ' ')
    .replace(/#\[.+?\]/g, ' ')
    .replace(new RegExp(`[^א-ת\\s${NUN_HAFUCHA}]`, 'g'), '')
    .replace(/\s{2,}/g, ' ');
}


// =================================================
//  Adapted from `tikkun.io/src/components/Line.ts`
// =================================================

function ktivKriAnnotation(text: string): Node[] {
  return text.trim().split(/[{}]/g).map((part, i) => {
    // used to be delimited by `{` and `}`
    if (i % 2 === 1) {
      const span = document.createElement('span');
      span.classList.add('ktiv-kri');
      span.append(part);
      return span;
    }
    return new Text(part);
  });
}

function fragmentText(fragment: Fragment[]) {
  return fragment.map((chunk) => chunk.he.join('')).join('');
}

function lineElement(page: Page, index: number): HTMLTableRowElement {
  const line: Line = page[index];

  const td = document.createElement('td');
  td.classList.add('line'); 
  if (line.isPetucha) {
    td.classList.add('mod-petucha');
  }

  line.text.forEach((column) => {
    const isSetuma = column.length > 1;
    const div = document.createElement('div');
    div.classList.add('column');
    column.forEach((fragment) => {
      const text = fragmentText(fragment);
      const span0 = document.createElement('span');
      const span1 = document.createElement('span');
      span0.classList.add('fragment', 'mod-annotations-off');
      span1.classList.add('fragment', 'mod-annotations-on');
      if (isSetuma) {
        span0.classList.add('mod-setuma');
        span1.classList.add('mod-setuma');
      }
      span0.append(...ktivKriAnnotation(kri(text)));
      span1.append(...ktivKriAnnotation(ketiv(text)));
      div.append(span0);
      div.append(span1);
    });
    td.append(div);
  });

  const startingVerses = line.verses.filter((verse) =>
    verse.indexOfFirstWord === 0);

  const verseRef = document.createElement('span');
  verseRef.classList.add('location-indicator', 'mod-verses');
  verseRef.append(asVersesRange(startingVerses));
  td.append(verseRef);

  const tr = document.createElement('tr');
  tr.dataset.class = 'line';
  tr.dataset.lineIndex = String(index);
  tr.append(td);
  return tr;
}

export function pageElement(page: Page): HTMLTableElement {
  const table = document.createElement('table');
  page.forEach((_, index) => table.append(lineElement(page, index)));
  return table;
}
