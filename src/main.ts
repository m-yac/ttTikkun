import { Book, loadBooks, lookupVerseRef, type VerseRef } from "./data"
import { TikkunBook } from "./book";
import { pageTypes } from "./page";
import { NavBar, refStart } from "./nav";
import { Transliteration } from "./transliteration";

// import { validateData } from "./data";
// const e = await validateData();
// if (e !== null) { throw e; }
// console.log("No errors!")

const books = await loadBooks();

const translit = new Transliteration();

// The default starting place
const [book, ref]: [Book, VerseRef] =
  ['torah', { book: 5, chapter: 6, verse: 4 }];
  // ['torah', { book: 2, chapter: 15, verse: 1 }];
  // ['torah', { book: 5, chapter: 32, verse: 1 }];
  // ['esther', { book: 1, chapter: 9, verse: 7 }];
const start = lookupVerseRef(books[book].verseLookup, ref)![0];

const pagesDiv = document.getElementById('pages')!;
const tikkunBook = await TikkunBook.open(pagesDiv, books[book], translit,
                                         refStart(books[book]) ?? start);

const navDiv = document.getElementById('nav')!;
new NavBar(navDiv, tikkunBook, translit, start);

// For now, press 1,2,3,4 to choose the left page and 7,8,9,0 the right page
const leftKeys = ['1', '2', '3', '4'];
const rightKeys = ['7', '8', '9', '0'];

window.addEventListener('keydown', (event) => {
  const left = pageTypes[leftKeys.indexOf(event.key)];
  const right = pageTypes[rightKeys.indexOf(event.key)];
  if (left != undefined) { tikkunBook.updateLeftPage(left); }
  if (right != undefined) { tikkunBook.updateRightPage(right); }
});
