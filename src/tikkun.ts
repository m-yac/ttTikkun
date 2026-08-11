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

function ktivKriAnnotation(text: string) {
  return text.replace(/[{]/g, `<span class="ktiv-kri">`)
             .replace(/[}]/g, `</span>`)
             .trim();
}

function petuchaClass(isPetucha: boolean) {
  return isPetucha ? 'mod-petucha' : '';
}

function setumaClass(column: unknown[]) {
  return column.length > 1 ? 'mod-setuma' : '';
}

function fragmentText(fragment: Fragment[]) {
  return fragment.map((chunk) => chunk.he.join('')).join('');
}

function lineHTML(page: Page, index: number): string {
  const line: Line = page[index];
  return `
  <tr data-class="line" data-line-index="${index}">
    <td class="line ${petuchaClass(line.isPetucha)}">
      ${line.text
        .map(
          (column) => `
        <div class="column">
          ${column
            .map(
              (fragment) => `
            <span class="fragment ${setumaClass(
              column
            )} mod-annotations-on">${ktivKriAnnotation(
                ketiv(fragmentText(fragment))
              )}</span>
            <span class="fragment ${setumaClass(
              column
            )} mod-annotations-off">${ktivKriAnnotation(
                kri(fragmentText(fragment))
              )}</span>
          `
            )
            .join('')}
        </div>
      `
        )
        .join('')}
      <span class="location-indicator mod-verses">${asVersesRange(
        // only the verses which *begin* on this line
        line.verses.filter((verse) => verse.indexOfFirstWord === 0)
      )}</span>
    </td>
  </tr>
  `;
}

export function pageHTML(page: Page) {
  return`
  <table>
    ${page.map((_, index) => lineHTML(page, index)).join('')}
  </table>
  `;
}
