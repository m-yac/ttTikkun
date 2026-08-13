import { type VerseRef, type Fragment, type LineData, type PageData } from "./data"

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

/** NOTE: In `tikkun.io`, this name is mistakenly swapped with `ketiv` */
export function kri(text: string): string {
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

/** NOTE: In `tikkun.io`, this name is mistakenly swapped with `kri` */
export function ketiv(text: string): string {
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

// To be applied to the output of `kri` with argument 'ketiv-kri'
export function expandAnnotation(text: string, cssClass: string): Node[] {
  return text.trim().split(/[{}]/g).map((part, i) => {
    // used to be delimited by `{` and `}`
    if (i % 2 === 1) {
      const span = document.createElement('span');
      span.classList.add(cssClass);
      span.append(part);
      return span;
    }
    return new Text(part);
  });
}

export function fragmentText(fragment: Fragment): string {
  return fragment.map((part) => part.he.join('')).join('');
}

export function lineElement(
  page: PageData, index: number,
  onFragment: (fragment: Fragment) => (string | Node)[]
): HTMLTableRowElement {
  const line: LineData = page[index];

  const lineTd = document.createElement('td');
  lineTd.classList.add('line'); 
  if (line.isPetucha) {
    lineTd.classList.add('is-petucha');
  }

  line.text.columns.forEach((column) => {
    const columnDiv = document.createElement('div');
    columnDiv.classList.add('column');
    if (line.text.format === 'columns') {
      columnDiv.classList.add('is-two-column');
    }

    column.forEach((fragment) => {
      const fragmentSpan = document.createElement('span');
      fragmentSpan.classList.add('fragment');
      if (line.text.format === 'setuma') {
        fragmentSpan.classList.add('is-setuma');
      }

      fragmentSpan.append(...onFragment(fragment));
      columnDiv.append(fragmentSpan);
    });
    lineTd.append(columnDiv);
  });

  const startingVerses = line.verses.filter((verse) =>
    verse.indexOfFirstWord === 0);

  const verseRefSpan = document.createElement('span');
  verseRefSpan.classList.add('verse-ref');
  verseRefSpan.append(asVersesRange(startingVerses));
  // lineTd.append(verseRefSpan);

  const lineTr = document.createElement('tr');
  lineTr.dataset.class = 'line';
  lineTr.dataset.lineIndex = String(index);
  lineTr.append(lineTd);
  return lineTr;
}

export function pageElement(
  page: PageData,
  onFragment: (fragment: Fragment) => (string | Node)[]
): HTMLTableElement {
  const pageTable = document.createElement('table');
  page.forEach((_, index) =>
    pageTable.append(lineElement(page, index, onFragment)));
  return pageTable;
}
