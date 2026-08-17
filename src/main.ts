import { loadLookups, loadPage } from "./data"
import { TikkunPage, pageTypes } from "./page";
import { Transliteration } from "./transliteration";

// import { validateData } from "./data";
// const e = await validateData();
// if (e !== null) { throw e; }
// console.log("No errors!")

const lookups = await loadLookups();

const translit = new Transliteration();

// For now, just load this page as a test
// const page = await loadPage('torah', 8);
const page = await loadPage('torah', lookups['torah'][2][15][1].refs[0].page);
// const page = await loadPage('torah', lookups['torah'][5][32][1].refs[0].page);
// const page = await loadPage('esther', lookups['esther'][1][9][7].refs[0].page);

const tikkunPage = new TikkunPage(page, translit);
document.getElementById('pages')!.append(tikkunPage.element);
await tikkunPage.loadPrerequisites();
tikkunPage.ensureNoLineWraps();
tikkunPage.updatePages();

// For now, press 1,2,3,4 to choose the left page and 7,8,9,0 the right page
const leftKeys = ['1', '2', '3', '4'];
const rightKeys = ['7', '8', '9', '0'];

window.addEventListener('keydown', (event) => {
  const left = pageTypes[leftKeys.indexOf(event.key)];
  const right = pageTypes[rightKeys.indexOf(event.key)];
  if (left != undefined) { tikkunPage.updateLeftPage(left); }
  if (right != undefined) { tikkunPage.updateRightPage(right); }
});
