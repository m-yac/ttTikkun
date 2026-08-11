import { loadPage } from "./data"
import { pageHTML } from "./tikkun";

// Just load this page for now as a test
const page = await loadPage('torah', 1);
const pageDiv = document.createElement('div');
pageDiv.classList.add('tikkun-page');
pageDiv.innerHTML = pageHTML(page);
document.getElementById('pages')!.append(pageDiv);

export {}
