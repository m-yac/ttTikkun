// =========================================
//  Undo history [GENERATED ENTIRELY BY AI]
// =========================================

export interface Snapshot { text: string; caret: number }

export interface UndoOptions {
  // The `contenteditable` element whose plain text is tracked
  el: HTMLElement;
  getText(): string;
  getCaret(): number | null;
  // Called after the text of `el` has been set back to a snapshot
  restored(caret: number): void;
}

// Edits of the same type made within this many ms are undone as a group
const COALESCE_MS = 1000;
const COALESCABLE = new Set(['insertText', 'deleteContentBackward', 'deleteContentForward']);
const HISTORY_LIMIT = 500;

export class EditHistory {
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];

  // The state of `el` just before the edit currently in progress, if any
  private pending: (Snapshot & { type: string }) | null = null;
  // The type and time of the last recorded edit, used to coalesce typing
  private lastEdit = { type: '', time: -Infinity };

  constructor(private opts: UndoOptions) {
    const { el } = opts;

    el.addEventListener('beforeinput', (e) => {
      // Undo/redo from sources other than the keyboard, e.g. the context menu
      if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
        e.preventDefault();
        if (e.inputType === 'historyUndo') {
          this.undo();
        } else {
          this.redo();
        }
        return;
      }
      this.pending = { ...this.snapshot(), type: e.inputType };
    });

    el.addEventListener('input', (e) => {
      if (this.pending && this.pending.text !== opts.getText()) {
        this.push(this.pending, this.pending.type, (e as InputEvent).data);
      }
      this.pending = null;
    });

    el.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
        }
        if (key === 'y' && !e.metaKey) {
          e.preventDefault();
          this.redo();
        }
        // Bold/italic/underline, which would otherwise insert formatting
        if (key === 'b' || key === 'i' || key === 'u') {
          e.preventDefault();
        }
      } else if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' ||
                 e.key.startsWith('Page')) {
        this.breakGroup();
      }
    });

    // Moving the caret with the mouse also starts a new undo group
    el.addEventListener('pointerdown', () => this.breakGroup());
  }

  snapshot(): Snapshot {
    const text = this.opts.getText();
    return { text, caret: this.opts.getCaret() ?? text.length };
  }

  // Record that `el` just changed from `before`, by an edit of type `type`
  push(before: Snapshot, type: string, data?: string | null): void {
    const now = performance.now();
    const coalesce = this.undoStack.length > 0 && COALESCABLE.has(type) &&
                     type === this.lastEdit.type && now - this.lastEdit.time < COALESCE_MS;
    if (!coalesce) {
      this.undoStack.push(before);
      if (this.undoStack.length > HISTORY_LIMIT) {
        this.undoStack.shift();
      }
    }
    this.redoStack.length = 0;
    // Break the group at whitespace, so that undo goes word by word
    this.lastEdit = /\s/.test(data ?? '') ? { type: '', time: -Infinity } : { type, time: now };
  }

  // Stop the next edit from being coalesced with the previous one
  breakGroup(): void {
    this.lastEdit = { type: '', time: -Infinity };
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (prev) {
      this.restore(prev, this.redoStack);
    }
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (next) {
      this.restore(next, this.undoStack);
    }
  }

  private restore(to: Snapshot, from: Snapshot[]): void {
    from.push(this.snapshot());
    this.opts.el.textContent = to.text;
    this.breakGroup();
    this.opts.el.focus();
    this.opts.restored(to.caret);
  }
}
