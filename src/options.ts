import { DefaultTransliterationScheme } from 'havarotjs/transliteration';
import type { HebrewMark } from 'havarotjs/syllablePart';
import { punctuation, taamim } from 'havarotjs/utils/regularExpressions';

const ACCENT_BOLD = '<b>ta</b>${syllableSeparator}am';
const ACCENT_TAAM = 'ta\u{05AB}${syllableSeparator}am';

// ========================================================
//  The options and the transliteration scheme they define
// ========================================================

const optionSpecs = {
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
    default: 'e',
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
  ashkenazi: {
    label: [{he: 'ת/אָ/אֹ', name: 'tav/qamats/holam'}, ' as:'],
    choices: ['t/a/o', 's/o/oi'],
    default: 't/a/o',
  },
  syllableSeparator: {
    label: ["Between syllables:"],
    choices: ['', '·', '|'],
    names: { '': 'nothing', '·': 'middle dot', '|': 'vertical bar' },
    default: '·',
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
  accents: {
    label: ["Accents, ", {he: 'טַ֫עַם', name: 'word accented with a trope marking'}, ' as:'],
    choices: [ACCENT_BOLD, ACCENT_TAAM],
    names: {
      [ACCENT_BOLD]: 'bold accented syllables',
      [ACCENT_TAAM]: 'keep trope marking on accented syllables',
    },
    default: ACCENT_TAAM,
  },
} as const satisfies Record<string, OptionSpec>; // see below for this type

const optionDefaults = Object.fromEntries(
  Object.entries(optionSpecs).map(([key, spec]) => [key, spec.default]),
) as Options; // see below for how this type is defined in terms of optionsSpecs

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
      marks['א־'] = ''; // maqaf
      marks['א׀'] = '|'; // paseq
      marks['א׃'] = ':'; // sof passuq
      marks['א׆'] = ''; // nun hafukha
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

// ==================================
//  Types [GENERATED ENTIRELY BY AI]
// ==================================

// A Hebrew segment of a label, rendered in the `inlineHe` style. Its `name` is
// how it is spoken by a screen reader, which cannot be left to the niqqud-blind
// guesswork of reading e.g. 'אֵ' as 'alef'.
export interface HebrewSegment {
  readonly he: string;
  readonly name: string;
}

// A segment of a label wrapped in an HTML tag, e.g. `<b>`
export interface TaggedSegment {
  readonly tag: string;
  readonly text: string
}

// A piece of text which may contain Hebrew or tagged segments
export type Label =
  string | readonly (string | HebrewSegment | TaggedSegment)[];

interface OptionSpec {
  label: Label;
  choices?: readonly string[];
  names?: Readonly<Record<string, string>>;
  default: unknown;
};

// The value of an option is one of its `choices`, or a boolean if it has none
type OptionValue<S extends OptionSpec> =
  S['choices'] extends readonly (infer V)[] ? V : boolean;

type OptionSpecs = typeof optionSpecs;

// The value of every option. Mutable, unlike the `as const` specs it comes from.
export type Options = {
  -readonly [K in keyof OptionSpecs]: OptionValue<OptionSpecs[K]>;
};

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
        buttons: choices.map((value) => ({
          label: parseTags(value),
          name: names[value],
          tlSample: true,
          checked: () => values[key] === value,
          set: () => { values[key] = value; },
        })),
      });
    } else {
      toggles.push({
        label: spec.label,
        tlSample: false,
        checked: () => values[key] as boolean,
        set: (input) => { values[key] = input.checked; },
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

    container.append(input, label);
  });

  return { el: groupDiv, update: () => updates.forEach((u) => u()) };
}

// Fill in the options panel with the options of `options` and wire up its
// show/hide toggle. `changed` is called whenever an option is changed.
export function setupOptions(options: Options, changed: () => void): void {
  const toggle = document.getElementById('optionsToggle') as HTMLButtonElement;
  const panel = document.getElementById('optionsPanel') as HTMLDivElement;

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
    panel.append(el);
  }

  // A taam sits far above the letters it accompanies, so a label containing
  // one is set in a font which leaves room for it - as are all the others, so
  // that the panel keeps to one font
  const labels = groups.flatMap((group) => [
    ...group.label === undefined ? [] : [group.label],
    ...group.buttons.map((button) => button.label),
  ]);
  const setFont = () => panel.classList.toggle(
    'hasTaam', labels.some((l) => hasTaam(expandLabel(l, values))));
  setFont();
  updates.push(setFont);

  toggle.addEventListener('click', () => {
    const shown = panel.hidden;
    panel.hidden = !shown;
    toggle.setAttribute('aria-expanded', String(shown));
    toggle.textContent = `${shown ? 'Hide' : 'Show'} transliteration options`;
  });
}
