import { loadLookups, loadPage } from "./data"
import { KriPage, KetivPage, EnglishPage, TranslitPage } from "./page";
import { Transliteration } from "./transliteration";

// import { validateData } from "./data";
// const e = await validateData();
// if (e !== null) { throw e; }
// console.log("No errors!")

const lookups = await loadLookups();

const translit = new Transliteration();

// For now, just load this page as a test
// const page = await loadPage('torah', lookups['torah'][2][15][1].refs[0].page);
const page = await loadPage('torah', lookups['torah'][5][32][1].refs[0].page);

const tikkunPageDiv = document.createElement('div');
tikkunPageDiv.classList.add('tikkun-page');
const pages = [
  new KetivPage(page),
  new KriPage(page),
  new TranslitPage(page, translit),
  new EnglishPage(page),
];
tikkunPageDiv.append(...pages.map((page) => page.element));
document.getElementById('pages')!.append(tikkunPageDiv);

for (const page of pages) {
  await page.ensureFontLoaded();
}
const width = pages[0].getWidth();
for (const page of pages) {
  page.setWidth(width);
  page.ensureNoLineBreaks();
}

// For now, press 1,2,3,4 to switch between the pages
let shown = 'show-ketiv';
function updateShown(key: string) {
  tikkunPageDiv.classList.remove(shown);
  if (key == '1') { shown = 'show-ketiv'; }
  if (key == '2') { shown = 'show-kri'; }
  if (key == '3') { shown = 'show-tl'; }
  if (key == '4') { shown = 'show-en'; }
  tikkunPageDiv.classList.add(shown);
}
updateShown('ketiv');
window.addEventListener('keydown', (event) => updateShown(event.key));
