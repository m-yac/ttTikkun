import { Book, loadLookups, LookupEntry } from "./data"
import { TikkunBook } from "./book";
import { pageTypes } from "./page";
import { Transliteration } from "./transliteration";

// import { validateData } from "./data";
// const e = await validateData();
// if (e !== null) { throw e; }
// console.log("No errors!")

const lookups = await loadLookups();

const translit = new Transliteration();

// For now, always start at a fixed spot
const [book, start]: [Book, LookupEntry] =
  // ['torah', lookups['torah'][2][15][1].refs[0]];
  ['torah', lookups['torah'][5][32][1].refs[0]];
  // ['esther', lookups['esther'][1][9][7].refs[0]];

const pagesDiv = document.getElementById('pages')!;
const tikkunBook = await TikkunBook.open(pagesDiv, book, translit, start);

// For now, press 1,2,3,4 to choose the left page and 7,8,9,0 the right page
const leftKeys = ['1', '2', '3', '4'];
const rightKeys = ['7', '8', '9', '0'];

window.addEventListener('keydown', (event) => {
  const left = pageTypes[leftKeys.indexOf(event.key)];
  const right = pageTypes[rightKeys.indexOf(event.key)];
  if (left != undefined) { tikkunBook.updateLeftPage(left); }
  if (right != undefined) { tikkunBook.updateRightPage(right); }
});
