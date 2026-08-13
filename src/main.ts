import { loadPage } from "./data"
import { fragmentText, ketiv, ktivKriAnnotation, pageElement } from "./tikkun";

// const e = await validateData();
// if (e !== null) { throw e; }
// console.log("No errors!")

// Just load this page for now as a test
const page = await loadPage('torah', 1);
const pageDiv = document.createElement('div');
pageDiv.classList.add('tikkun-page');
pageDiv.append(pageElement(page, (fragments) => {
  return ktivKriAnnotation(ketiv(fragmentText(fragments)));
}));
document.getElementById('pages')!.append(pageDiv);

export {}
