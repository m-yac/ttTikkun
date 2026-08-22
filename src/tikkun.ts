import { type VerseRef, type Fragment, type LineData, type PageData } from "./data"

// ================================================
//  Adapted from `tikkun.io/src/hebrew-numeral.ts`
// ================================================

const hebrewNumeralLetters = [
  { glyph: 'א', value: 1 },
  { glyph: 'ב', value: 2 },
  { glyph: 'ג', value: 3 },
  { glyph: 'ד', value: 4 },
  { glyph: 'ה', value: 5 },
  { glyph: 'ו', value: 6 },
  { glyph: 'ז', value: 7 },
  { glyph: 'ח', value: 8 },
  { glyph: 'ט', value: 9 },
  { glyph: 'י', value: 10 },
  { glyph: 'כ', value: 20 },
  { glyph: 'ל', value: 30 },
  { glyph: 'מ', value: 40 },
  { glyph: 'נ', value: 50 },
  { glyph: 'ס', value: 60 },
  { glyph: 'ע', value: 70 },
  { glyph: 'פ', value: 80 },
  { glyph: 'צ', value: 90 },
  { glyph: 'ק', value: 100 },
  { glyph: 'ר', value: 200 },
  { glyph: 'ש', value: 300 },
  { glyph: 'ת', value: 400 },
].reverse();

export function hebrewNumeral(n: number): string {
  if (n <= 0) return '';
  if (n === 15) return 'טו';
  if (n === 16) return 'טז';

  let i = 0;
  while (n < hebrewNumeralLetters[i].value) {
    ++i;
  }

  const letter = hebrewNumeralLetters[i];

  return `${letter.glyph}${hebrewNumeral(n - letter.value)}`;
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


// ========================================================
//  Originally based on `tikkun.io/src/components/Line.ts`
// ========================================================

function buildLine(
  page: PageData, index: number,
  onLineTd: (line: LineData, lineTd: HTMLTableCellElement) => void
): HTMLTableRowElement {
  const lineTd = document.createElement('td');
  lineTd.classList.add('line');
  onLineTd(page.lines[index], lineTd);

  const lineTr = document.createElement('tr');
  lineTr.dataset.lineIndex = String(index);
  lineTr.append(lineTd);
  return lineTr;
}

export function pageElement(
  page: PageData,
  onFragment: (fragment: Fragment, verses: VerseRef[]) => (string | Node)[]
): HTMLTableElement {
  const pageTable = document.createElement('table');
  page.lines.forEach((_, index) =>
    pageTable.append(buildLine(page, index, (line, lineTd) => {
      if (line.isPetucha) {
        lineTd.classList.add('is-petucha');
      }
      // Add each column
      line.text.columns.forEach((column) => {
        const columnDiv = document.createElement('div');
        columnDiv.classList.add('column');
        if (line.text.format === 'columns') {
          columnDiv.classList.add('is-two-column');
        }
        // Add each fragment
        column.forEach((fragment) => {
          const fragmentSpan = document.createElement('span');
          fragmentSpan.classList.add('fragment');
          if (line.text.format === 'setuma') {
            fragmentSpan.classList.add('is-setuma');
          }
          // Add each part
          fragmentSpan.append(...onFragment(fragment, line.verses));
          columnDiv.append(fragmentSpan);
        });
        lineTd.append(columnDiv);
      });
    }))
  );
  return pageTable;
}

export type VerseNumberType = 'hindu-arabic' | 'hebrew' | 'none';

export function verseRefElement(page: PageData,
                                type: VerseNumberType): HTMLTableElement {
  const verseRefTable = document.createElement('table');
  page.lines.forEach((_, index) =>
    verseRefTable.append(buildLine(page, index, (line, lineTd) => {
        if (type === 'none') { return; }

        for (let i = 0; i < line.verses.length; i++) {
          if (line.verses[i].indexOfFirstWord !== 0) { continue; }
          const [cls, n] = line.verses[i].verse === 1
                         ? ['chapter-number', line.verses[i].chapter]
                         : ['verse-number', line.verses[i].verse];

          if (i > 0) {
            lineTd.append(new Text(' '));
          }

          const refSpan = document.createElement('span');
          refSpan.classList.add(cls);
          refSpan.append(type === 'hebrew' ? hebrewNumeral(n) : String(n));
          lineTd.append(refSpan);
        }
    }))
  );
  return verseRefTable;
}
