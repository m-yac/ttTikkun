// ======================================================================
//  Plain text editing of a `contenteditable` [GENERATED ENTIRELY BY AI]
// ======================================================================

import { EditHistory } from './history';

export interface EditableTextOptions {
  // Called whenever the text has changed, with the offset the caret belongs at
  // once the element has been rendered from it again - or `null` to leave the
  // caret where the browser has already put it
  changed(caret: number | null): void;
}

// The plain text of a `contenteditable` element, as it was typed/pasted
// edited, without any of the HTML the text is rendered as. Every edit the
// element is asked for is made to `text` here, and the caller left to render
// the element from it again, rather than being left to the browser: an
// element rendered as a block per line, as `he` is, is edited by a browser on
// those blocks rather than on the newlines they were made from - so a 
// backspace at the head of a line merges two blocks the next render puts
// straight back, and a space typed there ends up outside them - all of it 
// leaving the text something other than what was written. Whatever isn't
// recognized here is left to the browser and read back off the element
// afterwards: see the `input` listener below.
export class EditableText {
  private value = '';
  private history: EditHistory;

  constructor(private el: HTMLElement, private opts: EditableTextOptions) {
    // Anything the browser was left to edit itself - a composition, say, or an
    // autocorrection - is read back off `el` and rendered again. Every other
    // edit is applied to `value` by hand, and never reaches the DOM at all:
    // see `applyEdit`. This has to run before the undo history reads the text,
    // which it does on the same event, so it is registered before the history
    // is set up.
    el.addEventListener('input', () => {
      const shown = el.textContent ?? '';
      if (shown === this.value) {
        return;
      }
      this.value = shown;
      opts.changed(this.caret);
    });

    this.history = new EditHistory({
      el,
      getText: () => this.value,
      getCaret: () => this.caret,
      restored: (snapshot) => {
        this.value = snapshot.text;
        opts.changed(snapshot.caret);
      },
    });

    el.addEventListener('beforeinput', (e) => this.onBeforeInput(e));

    el.addEventListener('paste', (e) => {
      e.preventDefault();
      this.insertPasted(asPlainText(e.clipboardData), 'insertFromPaste');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.focus();
      this.insertPasted(asPlainText(e.dataTransfer), 'insertFromDrop');
    });

    // Disallow dragging
    el.addEventListener('dragstart', (e) => e.preventDefault());
  }

  get text(): string {
    return this.value;
  }

  // Start again from `text`, as though it had just been loaded: nothing here
  // is an edit of what came before, so there is no history to keep and no
  // `changed` to report - the caller renders the element itself.
  reset(text: string): void {
    this.value = text;
    this.history.clear();
  }

  // ==================================
  //  Managing the cursor (caret)
  // ==================================

  // The offset of a (node, offset) DOM position in the plain text of `el`
  private offsetOf(node: Node, offset: number): number {
    const range = document.createRange();
    range.selectNodeContents(this.el);
    range.setEnd(node, offset);
    return range.toString().length;
  }

  // The current selection as a `[start, end]` pair of plain text offsets
  private get selection(): [number, number] | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode ||
        !this.el.contains(sel.anchorNode) || !this.el.contains(sel.focusNode)) {
      return null;
    }
    const anchor = this.offsetOf(sel.anchorNode, sel.anchorOffset);
    const focus = this.offsetOf(sel.focusNode, sel.focusOffset);
    return anchor <= focus ? [anchor, focus] : [focus, anchor];
  }

  get caret(): number | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.focusNode ||
        !this.el.contains(sel.focusNode)) {
      return null;
    }
    return this.offsetOf(sel.focusNode, sel.focusOffset);
  }

  setCaret(offset: number | null): void {
    if (!offset) { return; }
    const walker = document.createTreeWalker(this.el, NodeFilter.SHOW_TEXT);
    let seen = 0;
    let last: Node | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const len = node.textContent?.length ?? 0;
      // An offset which falls between two nodes - the end of a line and the
      // start of the next one, say - is put at the start of the later of them,
      // which is where the caret belongs when it has just been moved to the
      // head of a line
      if (seen + len > offset) {
        putCaret(node, offset - seen);
        return;
      }
      seen += len;
      last = node;
    }
    if (last !== null) {
      putCaret(last, last.textContent?.length ?? 0);
    }
  }

  // ==================================
  //  Making an edit
  // ==================================

  private applyEdit(start: number, end: number, insert: string,
                    type: string, data?: string | null): void {
    const before = this.history.snapshot();
    const edited = this.value.slice(0, start) + insert + this.value.slice(end);
    if (edited !== this.value) {
      this.value = edited;
      this.opts.changed(start + insert.length);
    }
    this.history.applied(before, type, data);
  }

  private insertPasted(pasted: string, type: string): void {
    const [start, end] = this.selection ?? [this.value.length, this.value.length];
    this.applyEdit(start, end, pasted, type);
  }

  private onBeforeInput(e: InputEvent): void {
    // A composition is left to run its course, and read off `el` when it ends
    if (e.isComposing || !e.cancelable) {
      return;
    }
    const selection = this.selection;
    if (selection === null) {
      return;
    }
    let [start, end] = selection;
    const collapsed = start === end;
    let insert = '';

    switch (e.inputType) {
      case 'insertText':
        insert = e.data ?? '';
        break;
      case 'insertLineBreak':
      case 'insertParagraph':
        insert = '\n';
        break;
      case 'deleteContentBackward':
        start = collapsed ? this.codePointBefore(start) : start;
        break;
      case 'deleteContentForward':
        end = collapsed ? this.codePointAfter(end) : end;
        break;
      case 'deleteWordBackward':
        start = collapsed ? this.wordBefore(start) : start;
        break;
      case 'deleteWordForward':
        end = collapsed ? this.wordAfter(end) : end;
        break;
      case 'deleteSoftLineBackward':
      case 'deleteHardLineBackward':
        start = collapsed ? this.lineStart(start) : start;
        break;
      case 'deleteSoftLineForward':
      case 'deleteHardLineForward':
        end = collapsed ? this.lineEnd(end) : end;
        break;
      case 'deleteEntireSoftLine':
        [start, end] = [this.lineStart(start), this.lineEnd(end)];
        break;
      // The rest of the deletions are of the selection and nothing more
      case 'deleteContent':
      case 'deleteByCut':
      case 'deleteByDrag':
        break;
      default:
        return;
    }

    e.preventDefault();
    this.applyEdit(start, end, insert, e.inputType, e.data);
  }

  // ==================================
  //  How far an edit reaches
  // ==================================

  // How far a deletion at `offset` reaches. A backspace takes a single
  // character rather than the whole grapheme cluster a browser would have
  // taken, so that the niqqud written on a letter can be deleted one at a time
  // and the letter left standing. The character is a code point and not a code
  // unit: the two halves of a surrogate pair are only a character together.
  private codePointBefore(offset: number): number {
    if (offset <= 0) {
      return 0;
    }
    const cp = this.value.codePointAt(offset - 2);
    const pair = cp !== undefined && cp > 0xffff;
    return offset - (pair ? 2 : 1);
  }

  private codePointAfter(offset: number): number {
    if (offset >= this.value.length) {
      return this.value.length;
    }
    const cp = this.value.codePointAt(offset);
    return Math.min(this.value.length, offset + (cp! > 0xffff ? 2 : 1));
  }

  private wordBefore(offset: number): number {
    let start = offset;
    while (start > 0 && /\s/.test(this.value[start - 1])) {
      start -= 1;
    }
    while (start > 0 && !/\s/.test(this.value[start - 1])) {
      start -= 1;
    }
    return start;
  }

  private wordAfter(offset: number): number {
    let end = offset;
    while (end < this.value.length && /\s/.test(this.value[end])) {
      end += 1;
    }
    while (end < this.value.length && !/\s/.test(this.value[end])) {
      end += 1;
    }
    return end;
  }

  // The line here is the one the text is written in rather than the one it is
  // shown on, which is as much as the newlines in it can say
  private lineStart(offset: number): number {
    return this.value.lastIndexOf('\n', offset - 1) + 1;
  }

  private lineEnd(offset: number): number {
    const nl = this.value.indexOf('\n', offset);
    return nl < 0 ? this.value.length : nl;
  }
}

function putCaret(node: Node, offset: number): void {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// Normalize text arriving from the clipboard or a drag-and-drop
function asPlainText(data: DataTransfer | null): string {
  return (data?.getData('text/plain') ?? '').replace(/\r\n?/g, '\n');
}
