import { loadPage } from "./data"
import { pageElement } from "./tikkun";

// Just load this page for now as a test
const page = await loadPage('torah', 1);
const pageDiv = document.createElement('div');
pageDiv.classList.add('tikkun-page');
pageDiv.append(pageElement(page));
document.getElementById('pages')!.append(pageDiv);

export {}
