import { DefaultTransliterationScheme } from 'havarotjs/transliteration';
import type { HebrewMark } from 'havarotjs/syllablePart';
import { punctuation, taamim } from 'havarotjs/utils/regularExpressions';

const ACCENT_BOLD = '<b>ta</b>${syllableSeparator}am';
const ACCENT_TAAM = 'ta\u{05AB}${syllableSeparator}am';

// ===================
//  Types for options
// ===================

// A label for an option: either a string or an array consisting of
// strings render as English, strings rendered as Hebrew (with tooltip
// text), or strings wrapped in an HTML tag
export type Label =
  string | readonly (string | HebrewSegment | TaggedSegment)[];

export interface HebrewSegment {
  readonly he: string;
  readonly name: string;
}

export interface TaggedSegment {
  readonly tag: string;
  readonly text: string
}

// An option - consisting of a label, some number of choices, optional 
// tooltip text for those choices, a default value, and whether this option
// is always visible at the top
interface OptionSpec {
  label: Label;
  choices: readonly string[];
  names?: Readonly<Record<string, string>>;
  default: string;
  alwaysVisible?: boolean;
};

// =============
//  The options
// =============

const optionSpecs = {
  accents: {
    label: ["Show accents, ", {he: 'טַ֫עַם', name: 'word accented with a trope marking'}, ' as:'],
    choices: [ACCENT_BOLD, ACCENT_TAAM],
    names: {
      [ACCENT_BOLD]: 'bold accented syllables',
      [ACCENT_TAAM]: 'keep trope marking on accented syllables',
    },
    default: ACCENT_TAAM,
    alwaysVisible: true,
  },
  syllableSeparator: {
    label: ["Between syllables:"],
    choices: ['', '·'],
    names: { '': 'nothing', '·': 'middle dot' },
    default: '·',
    alwaysVisible: true,
  },
  tsere: {
    label: [{ he: 'אֵ', name: 'tsere' }, ' as:'],
    choices: ['e', 'ei'],
    default: 'e',
  },
  tsereYod: {
    label: [{ he: 'אֵי', name: 'tsere yod' }, ' as:'],
    choices: ['e', 'ei'],
    default: 'ei',
  },
  vocalSheva: {
    label: ['Vocal ', { he: 'אְ', name: 'sheva' }, ' as:'],
    choices: ['e', '’'],
    names: { 'e': 'e', '’': 'apostrophe' },
    default: '’',
  },
  ashkenazi: {
    label: [{he: 'ת/אָ/אֹ', name: 'tav/qamats/holam'}, ' as:'],
    choices: ['t/a/o', 's/o/oi'],
    default: 't/a/o',
  },
  het: {
    label: [{he: 'ח', name: 'het'}, ' as:'],
    choices: ['ḥ', 'ch', 'kh'],
    default: 'ch',
  },
  khaf: {
    label: [{he: 'כ/ך', name: 'khaf (with no dagesh)'}, ' as:'],
    choices: ['ch', 'kh'],
    default: 'ch',
  },
  wawShureq: {
    label: [{he: 'וּבְ', name: 'shureq followed by a consonant with a sheva'}, ' as:'],
    choices: ['uv', 'u${syllableSeparator}v${vocalSheva}'],
    names: {
      'uv': 'one syllable with a silent sheva',
      'u${syllableSeparator}v${vocalSheva}':
        'two syllables with a vocal sheva',
    },
    default: 'uv',
  },
} as const satisfies Record<string, OptionSpec>; // see below for this type

type OptionSpecs = typeof optionSpecs;

// An object that picks a choice for each option in `optionSpecs`
export type Options = {
  [O in keyof OptionSpecs]: OptionSpecs[O]['choices'][number];
};

// The set of default options
const optionDefaults = Object.fromEntries(
  Object.entries(optionSpecs).map(([key, spec]) => [key, spec.default]),
) as Options;

// Option choices which if you choose them, cause other options' choices
// to be overridden
const optionOverrides: {
  [O in keyof Options]?: { [C in Options[O]]?: Partial<Options> }
} = {
  ashkenazi: {
    's/o/oi': { tsere: 'ei', tsereYod: 'ei', vocalSheva: '’' }
  },
};

// =====================================================
//  The transliteration scheme defined by these options
// =====================================================

export class OptionsScheme extends DefaultTransliterationScheme {
  opts: Options = { ...optionDefaults };

  // Whether to bold accents or keep taamim
  get boldAccents(): boolean {
    return this.opts.accents === ACCENT_BOLD;
  }

  override get syllabificationOptions() {
    const syl = { ...super.syllabificationOptions };
    syl.wawShureq = this.opts.wawShureq !== optionDefaults.wawShureq;
    return syl;
  }

  override get syllableSeparator() {
    return this.opts.syllableSeparator;
  }

  override get vowels(): { [fromStart: string]: string } {
    const vowels = { ...super.vowels };
    vowels['אֵ'] = this.opts.tsere;
    vowels['אֵה'] = this.opts.tsere;
    vowels['אֵי'] = this.opts.tsereYod;
    vowels['אְ'] = this.opts.vocalSheva;
    if (this.opts.ashkenazi !== optionDefaults.ashkenazi) {
      vowels['אָ'] = 'o';
      vowels['אָה'] = 'o';
      vowels['אׇ'] = 'o';
      vowels['אֹ'] = 'oi';
      vowels['אֹו'] = 'oi';
    }
    return vowels;
  }

  override get consonants(): { [fromStart: string]: string } {
    const consonants = { ...super.consonants };
    consonants['ח'] = this.opts.het;
    consonants['כ'] = this.opts.khaf;
    consonants['ך'] = this.opts.khaf;
    if (this.opts.ashkenazi !== optionDefaults.ashkenazi) {
      consonants['ת'] = 's';
      consonants['ּת'] = 't';
    }
    return consonants;
  }

  override get hebrewMarks(): { [fromStart: string]: string } {
    const marks = { ...super.hebrewMarks };
    if (this.boldAccents) {
      marks['א־'] = '';
      marks['א׀'] = '|';
      marks['א׃'] = ':';
      marks['א׆'] = '';
    }
    return marks;
  }

  override hebrewMarkExceptions(m: HebrewMark, txt: string): string | undefined {
    if (this.boldAccents && !punctuation.test(m.text)) {
      return '';
    }
    return super.hebrewMarkExceptions(m, txt);
  }
}

// =========================================================
//  Saving and restoring options [GENERATED ENTIRELY BY AI]
// =========================================================

const COOKIE_NAME = 'tlOptions';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

// What is kept in the cookie: the options which differ from their defaults, and
// whether the options panel is expanded. Only the differences are saved so that
// a change of defaults is picked up by anyone who never touched that option.
interface SavedState {
  opts: Partial<Record<string, unknown>>;
  expanded: boolean;
}

function readCookie(name: string): string | undefined {
  for (const entry of document.cookie.split('; ')) {
    const eq = entry.indexOf('=');
    if (eq > 0 && entry.slice(0, eq) === name) {
      return decodeURIComponent(entry.slice(eq + 1));
    }
  }
  return undefined;
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}` +
    `; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

// Whether a saved value is still one this option can take. A cookie may have
// been written by an older version of the page, or by hand.
function isValidValue(spec: OptionSpec, value: unknown): boolean {
  if (spec.choices !== undefined) {
    return typeof value === 'string' && spec.choices.includes(value);
  }
  return typeof value === 'boolean';
}

// Apply the saved options, if any, to `options`, and return whether the panel
// was saved as expanded. Anything unrecognized in the cookie is ignored.
function loadState(options: Options): boolean {
  const cookie = readCookie(COOKIE_NAME);
  if (cookie === undefined) {
    return false;
  }
  let saved: unknown;
  try {
    saved = JSON.parse(cookie);
  } catch {
    return false;
  }
  if (typeof saved !== 'object' || saved === null) {
    return false;
  }
  const state = saved as Partial<SavedState>;

  const specs: Record<string, OptionSpec> = optionSpecs;
  const values = options as Record<string, unknown>;
  if (typeof state.opts === 'object' && state.opts !== null) {
    for (const [key, value] of Object.entries(state.opts)) {
      const spec = specs[key];
      if (spec !== undefined && isValidValue(spec, value)) {
        values[key] = value;
      }
    }
  }

  return state.expanded === true;
}

function saveState(options: Options, expanded: boolean): void {
  const values = options as Record<string, unknown>;
  const defaults = optionDefaults as Record<string, unknown>;
  const opts: Record<string, unknown> = {};
  for (const key of Object.keys(optionSpecs)) {
    if (values[key] !== defaults[key]) {
      opts[key] = values[key];
    }
  }
  writeCookie(COOKIE_NAME, JSON.stringify({ opts, expanded } satisfies SavedState));
}

// ============================================
//  Building the UI [GENERATED ENTIRELY BY AI]
// ============================================

// One button of a group: how it is labelled, when it is shown as selected, and
// what it does to the options when clicked
interface OptionButton {
  label: Label;
  // What a screen reader should speak in place of `label`, and what is shown
  // on hover, if it differs
  name?: string;
  // Whether the label is a sample of transliterated text, and so should be
  // shown in the same font as `tl`
  tlSample: boolean;
  checked: () => boolean;
  set: (input: HTMLInputElement) => void;
}

// A group of buttons rendered as one rounded container, as in `tr`. Either a
// group of radio buttons (a choice of values for one option) or a group of
// checkboxes (one boolean option each).
interface OptionGroup {
  name: string;
  label?: Label;
  radio: boolean;
  // Whether this group belongs to the panel which is always visible
  alwaysVisible?: boolean;
  buttons: OptionButton[];
}

// A choice is used both as the value of its option and as its own label, so any
// markup it contains is written inline, as `<tag>text</tag>`. Splitting it out
// here keeps the tags out of what is displayed.
function parseTags(choice: string): Label {
  const segments: (string | TaggedSegment)[] = [];
  let cursor = 0;
  for (const m of choice.matchAll(/<(\w+)>(.*?)<\/\1>/g)) {
    if (m.index > cursor) {
      segments.push(choice.slice(cursor, m.index));
    }
    segments.push({ tag: m[1], text: m[2] });
    cursor = m.index + m[0].length;
  }
  if (cursor < choice.length) {
    segments.push(choice.slice(cursor));
  }
  return segments;
}

// What the options overridden by the currently chosen values held before they
// were overridden. A key leaves the stash as soon as its option is set by hand,
// so that only an untouched override is ever put back.
const overrideStash: Record<string, unknown> = {};

function clearOverrideStash(): void {
  for (const key of Object.keys(overrideStash)) {
    delete overrideStash[key];
  }
}

// Only the shape of the overrides matters here, not which options have them
const overrides: Record<
  string, Record<string, Record<string, unknown> | undefined> | undefined
> = optionOverrides;

// Set `key` to `value`, putting back what the value it replaces overrode and
// overriding what the new value implies
function setOption(
  values: Record<string, unknown>, key: string, value: unknown,
): void {
  const byValue = overrides[key];
  // A value set by hand is the user's, so it is no longer ours to put back
  delete overrideStash[key];

  for (const [k, v] of Object.entries(byValue?.[String(values[key])] ?? {})) {
    if (k in overrideStash) {
      if (values[k] === v) {
        values[k] = overrideStash[k];
      }
      delete overrideStash[k];
    }
  }

  values[key] = value;

  for (const [k, v] of Object.entries(byValue?.[String(value)] ?? {})) {
    overrideStash[k] = values[k];
    values[k] = v;
  }
}

// The groups of `optionSpecs`: one per choice, in order, then one containing a
// checkbox for each boolean option
function optionGroups(options: Options): OptionGroup[] {
  // The keys and values of `optionSpecs` correspond by construction, so the
  // types of the individual options are of no use here
  const values = options as Record<string, unknown>;
  const groups: OptionGroup[] = [];
  const toggles: OptionButton[] = [];

  // Only the shape of a spec matters here, not which options happen to exist
  const specs: Record<string, OptionSpec> = optionSpecs;
  for (const [key, spec] of Object.entries(specs)) {
    const choices = spec.choices;
    if (choices !== undefined) {
      const names: Readonly<Record<string, string>> = spec.names ?? {};
      groups.push({
        name: key,
        label: spec.label,
        radio: true,
        alwaysVisible: spec.alwaysVisible,
        buttons: choices.map((value) => ({
          label: parseTags(value),
          name: names[value],
          tlSample: true,
          checked: () => values[key] === value,
          set: () => { setOption(values, key, value); },
        })),
      });
    } else {
      toggles.push({
        label: spec.label,
        tlSample: false,
        checked: () => values[key] as boolean,
        set: (input) => { setOption(values, key, input.checked); },
      });
    }
  }

  if (toggles.length > 0) {
    groups.push({ name: 'toggles', radio: false, buttons: toggles });
  }

  return groups;
}

// A label may refer to the current value of another option as `${key}`, e.g.
// 'u${syllableSeparator}v${vocalSheva}'. Such labels are expanded here and
// re-expanded whenever an option changes.
function expandString(text: string, values: Record<string, unknown>): string {
  return text.replace(/\$\{(\w+)\}/g, (_, key: string) => String(values[key]));
}

function expandLabel(label: Label, values: Record<string, unknown>): Label {
  if (typeof label === 'string') {
    return expandString(label, values);
  }
  return label.map((segment) =>
    typeof segment === 'string' ? expandString(segment, values) : segment);
}

// Whether a label contains any `${key}`, and so must be re-expanded on change
function hasTemplate(label: Label): boolean {
  const segments = typeof label === 'string' ? [label] : label;
  return segments.some((s) => typeof s === 'string' && /\$\{\w+\}/.test(s));
}

// Whether a label contains a Hebrew accent in text set in the font of the
// element which contains it. Hebrew segments are excluded: they carry their
// own font.
function hasTaam(label: Label): boolean {
  const segments = typeof label === 'string' ? [label] : label;
  return segments.some((s) => {
    if (typeof s === 'string') {
      return taamim.test(s);
    }
    return 'he' in s ? false : taamim.test(s.text);
  });
}

// Render a label into `el`, with any Hebrew segments in the `inlineHe` style
// and named by their `name` on hover, and any tagged segments in an element of
// their tag
function appendLabel(el: HTMLElement, label: Label): void {
  for (const segment of typeof label === 'string' ? [label] : label) {
    if (typeof segment === 'string') {
      el.append(segment);
    } else if ('he' in segment) {
      const he = document.createElement('span');
      he.className = 'inlineHe';
      he.dir = 'rtl';
      he.lang = 'he';
      he.title = segment.name;
      he.textContent = segment.he;
      el.append(he);
    } else {
      const tagged = document.createElement(segment.tag);
      tagged.textContent = segment.text;
      el.append(tagged);
    }
  }
}

// How a label is spoken by a screen reader: its Hebrew segments by name, the
// rest as written
function spokenLabel(label: Label): string {
  if (typeof label === 'string') {
    return label;
  }
  return label.map((segment) => {
    if (typeof segment === 'string') {
      return segment;
    }
    return 'he' in segment ? segment.name : segment.text;
  }).join('');
}

// Each group is a label and a container of hidden `input`s, each styled as a
// button by the `label` which follows it. The returned `update` re-expands any
// label which refers to the value of an option.
function makeGroup(
  group: OptionGroup,
  values: Record<string, unknown>,
  changed: () => void,
): { el: HTMLDivElement; update: () => void } {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'optionGroup';
  const updates: (() => void)[] = [];

  // Render `text` into the (initially empty) `el`, re-rendering on update if it
  // refers to the value of an option
  const render = (el: HTMLElement, text: Label) => {
    const fill = () => {
      el.replaceChildren();
      appendLabel(el, expandLabel(text, values));
    };
    fill();
    if (hasTemplate(text)) {
      updates.push(fill);
    }
  };

  if (group.label !== undefined) {
    const label = document.createElement('span');
    label.className = 'optionLabel';
    render(label, group.label);
    groupDiv.append(label);
  }

  const container = document.createElement('div');
  container.className = 'checkboxContainer';
  groupDiv.append(container);

  // A radio group is a single tab stop whose buttons are reached with the arrow
  // keys, so the group itself is what a screen reader announces on entry: it
  // must carry the label, which is attached to no one button and is in any case
  // Hebrew a screen reader would read without its niqqud
  if (group.radio && group.label !== undefined) {
    const label = group.label;
    container.setAttribute('role', 'radiogroup');
    const name = () => container.setAttribute(
      'aria-label', spokenLabel(expandLabel(label, values)));
    name();
    if (hasTemplate(label)) {
      updates.push(name);
    }
  }

  group.buttons.forEach((button, i) => {
    const id = `opt-${group.name}-${i}`;

    const input = document.createElement('input');
    input.type = group.radio ? 'radio' : 'checkbox';
    input.id = id;
    input.name = `opt-${group.name}`;
    input.checked = button.checked();
    // Overrides the `label` below, whose text may be a bare symbol, or empty
    if (button.name !== undefined) {
      input.setAttribute('aria-label', button.name);
    }

    const label = document.createElement('label');
    label.htmlFor = id;
    if (button.name !== undefined) {
      label.title = button.name;
    }
    render(label, button.label);
    if (button.tlSample) {
      label.classList.add('tlSample');
    }

    input.addEventListener('change', () => {
      button.set(input);
      changed();
    });

    updates.push(() => { input.checked = button.checked(); });

    container.append(input, label);
  });

  // A taam sits far above the letters it accompanies, so a group containing one
  // is given room for it - in every one of its buttons, so that they keep to
  // one height
  const buttonLabels = group.buttons.map((button) => button.label);
  const setTaam = () => container.classList.toggle(
    'hasTaam', buttonLabels.some((l) => hasTaam(expandLabel(l, values))));
  setTaam();
  if (buttonLabels.some(hasTemplate)) {
    updates.push(setTaam);
  }

  return { el: groupDiv, update: () => updates.forEach((u) => u()) };
}

// Fill in the options panel with the options of `options` and wire up its
// show/hide toggle. `changed` is called whenever an option is changed.
export function setupOptions(options: Options, changed: () => void): void {
  const toggle = document.getElementById('optionsToggle') as HTMLButtonElement;
  const alwaysPanel =
    document.getElementById('alwaysOptionsPanel') as HTMLDivElement;
  const panel = document.getElementById('optionsPanel') as HTMLDivElement;

  // The cookie is read only here, as the page loads, and written only as the
  // page is left, so that two tabs may hold different options without either
  // changing under the other: each keeps what it was loaded with, and the tab
  // left last is the one a newly opened tab inherits from.
  let expanded = loadState(options);

  // An option's value may appear in another option's label, so every group is
  // updated whenever any option changes
  const updates: (() => void)[] = [];
  const onChange = () => {
    updates.forEach((u) => u());
    changed();
  };

  const values = options as Record<string, unknown>;
  const groups = optionGroups(options);
  for (const group of groups) {
    const { el, update } = makeGroup(group, values, onChange);
    updates.push(update);
    (group.alwaysVisible ? alwaysPanel : panel).append(el);
  }

  // A taam sits far above the letters it accompanies, so a label containing
  // one is set in a font which leaves room for it - as are all the others, in
  // both panels, so that the options keep to one font. The room itself is made
  // per group, in `makeGroup`, as only the group with the taam in it needs to
  // be any taller.
  const labels = groups.flatMap((group) => [
    ...group.label === undefined ? [] : [group.label],
    ...group.buttons.map((button) => button.label),
  ]);
  const setFont = () => {
    const taam = labels.some((l) => hasTaam(expandLabel(l, values)));
    alwaysPanel.classList.toggle('hasTaam', taam);
    panel.classList.toggle('hasTaam', taam);
  };
  setFont();
  updates.push(setFont);

  // Text at the end of the panel which puts every option back to its default
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'optionsToggle';
  reset.textContent = 'Reset to defaults';
  reset.addEventListener('click', () => {
    Object.assign(options, optionDefaults);
    clearOverrideStash();
    onChange();
  });
  panel.append(reset);

  const setExpanded = (shown: boolean) => {
    expanded = shown;
    panel.hidden = !shown;
    toggle.setAttribute('aria-expanded', String(shown));
    toggle.textContent =
      `${shown ? 'Show fewer' : 'Show more'} transliteration options`;
  };
  setExpanded(expanded);

  toggle.addEventListener('click', () => setExpanded(!!panel.hidden));

  // `pagehide` covers leaving the page, including a refresh; `visibilitychange`
  // is what a mobile browser fires when it discards the page without warning
  const save = () => saveState(options, expanded);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      save();
    }
  });
}
