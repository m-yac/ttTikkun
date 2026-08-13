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
const page = await loadPage('torah', lookups['torah'][2][15][1].refs[0].page);
const tikkunPageDiv = document.createElement('div');
tikkunPageDiv.classList.add('tikkun-page');
tikkunPageDiv.append(new KetivPage(page).element);
tikkunPageDiv.append(new KriPage(page).element);
tikkunPageDiv.append(new TranslitPage(page, translit).element);
tikkunPageDiv.append(new EnglishPage(page).element);
document.getElementById('pages')!.append(tikkunPageDiv);

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
