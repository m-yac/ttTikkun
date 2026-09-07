import { aliyotOf, MAFTIR, type BookData, type HolidayAliases,
         type HolidayLookup, type Reading } from './data';

/**
 * The readings `hebcal-leyning` lists as having muliple alternate maftirim
 * instead of breaking them up into separate holidays - split up by the Python
 * code (see `MAFTIR_CHOICES` in `aliyot.py`), so we must split them up here too
 */
const MAFTIR_CHOICES: { key: string, maftirim: Record<string, string> }[] = [
  { key: "Sukkot Shabbat Chol ha-Moed",
    maftirim: {
      "M-day1": "Sukkot Shabbat Chol ha-Moed Day 1",
      "M-day2": "Sukkot Shabbat Chol ha-Moed Day 2",
      "M-day3": "Sukkot Shabbat Chol ha-Moed Day 3",
      "M-day4": "Sukkot Shabbat Chol ha-Moed Day 4",
      "M-day5": "Sukkot Shabbat Chol ha-Moed Day 5",
    } },
];

type RenamedHoliday = [string, string | null, string | null];

// Holdays that are kept and (possibly) renamed
const HOLIDAYS: Record<string, RenamedHoliday> = {
  "Pesach I":                          ["Pesach", "First Day", "Weekday"],
  "Pesach I (on Shabbat)":             ["Pesach", "First Day", "Shabbat"],
  "Pesach II":                         ["Pesach", "Second Day", null],
  "Pesach Chol ha-Moed Day 1":         ["Pesach", "First Day of Chol Hamoed", null],
  "Pesach Chol ha-Moed Day 2":         ["Pesach", "Second Day of Chol Hamoed", null],
  "Pesach Chol ha-Moed Day 3":         ["Pesach", "Third Day of Chol Hamoed", null],
  "Pesach Chol ha-Moed Day 4":         ["Pesach", "Fourth Day of Chol Hamoed", null],
  "Pesach Shabbat Chol ha-Moed":       ["Pesach", "Shabbat of Chol Hamoed", null],
  "Pesach VII":                        ["Pesach", "Seventh Day", "Weekday"],
  "Pesach VII (on Shabbat)":           ["Pesach", "Seventh Day", "Shabbat"],
  "Pesach VIII":                       ["Pesach", "Eighth Day", "Weekday"],
  "Pesach VIII (on Shabbat)":          ["Pesach", "Eighth Day", "Shabbat"],
  "Shavuot I":                         ["Shavuot", "First Day", null],
  "Shavuot II":                        ["Shavuot", "Second Day", "Weekday"],
  "Shavuot II (on Shabbat)":           ["Shavuot", "Second Day", "Shabbat"],
  "Tish'a B'Av":                       ["Tish'a B'Av", null, null],
  "Rosh Hashana I":                    ["Rosh Hashana", "First Day", "Weekday"],
  "Rosh Hashana I (on Shabbat)":       ["Rosh Hashana", "First Day", "Shabbat"],
  "Rosh Hashana II":                   ["Rosh Hashana", "Second Day", null],
  "Yom Kippur":                        ["Yom Kippur", "Morning", "Weekday"],
  "Yom Kippur (on Shabbat)":           ["Yom Kippur", "Morning", "Shabbat"],
  "Yom Kippur (Mincha, Traditional)":  ["Yom Kippur", "Afternoon", "Traditional"],
  "Yom Kippur (Mincha, Alternate)":    ["Yom Kippur", "Afternoon", "Alternate"],
  "Sukkot I":                          ["Sukkot", "First Day", "Weekday"],
  "Sukkot I (on Shabbat)":             ["Sukkot", "First Day", "Shabbat"],
  "Sukkot II":                         ["Sukkot", "Second Day", null],
  "Sukkot Chol ha-Moed Day 1":         ["Sukkot", "First Day of Chol Hamoed", "Weekday"],
  "Sukkot Chol ha-Moed Day 2":         ["Sukkot", "Second Day of Chol Hamoed", "Weekday"],
  "Sukkot Chol ha-Moed Day 3":         ["Sukkot", "Third Day of Chol Hamoed", "Weekday"],
  "Sukkot Chol ha-Moed Day 4":         ["Sukkot", "Fourth Day of Chol Hamoed", "Weekday"],
  "Sukkot Chol ha-Moed Day 5":         ["Sukkot", "Fifth Day of Chol Hamoed", "Weekday"],
  // NB: The five entries below are from us, not hebcal-leyning (see MAFTIR_CHOICES)
  "Sukkot Shabbat Chol ha-Moed Day 1": ["Sukkot", "First Day of Chol Hamoed", "Shabbat"],
  "Sukkot Shabbat Chol ha-Moed Day 2": ["Sukkot", "Second Day of Chol Hamoed", "Shabbat"],
  "Sukkot Shabbat Chol ha-Moed Day 3": ["Sukkot", "Third Day of Chol Hamoed", "Shabbat"],
  "Sukkot Shabbat Chol ha-Moed Day 4": ["Sukkot", "Fourth Day of Chol Hamoed", "Shabbat"],
  "Sukkot Shabbat Chol ha-Moed Day 5": ["Sukkot", "Fifth Day of Chol Hamoed", "Shabbat"],
  "Sukkot Final Day (Hoshana Raba)":   ["Sukkot", "Final Day (Hoshana Raba)", null],
  "Shmini Atzeret":                    ["Shmini Atzeret", null, "Weekday"],
  "Shmini Atzeret (on Shabbat)":       ["Shmini Atzeret", null, "Shabbat"],
  "Erev Simchat Torah":                ["Simchat Torah", "Evening", null],
  "Simchat Torah":                     ["Simchat Torah", "Morning", "Weekday"],
  "Simchat Torah (on Shabbat)":        ["Simchat Torah", "Morning", "Shabbat"],
  "Chanukah Day 1":                    ["Chanukah", "First Day", "Weekday"],
  "Chanukah Day 2":                    ["Chanukah", "Second Day", "Weekday"],
  "Chanukah Day 3":                    ["Chanukah", "Third Day", "Weekday"],
  "Chanukah Day 4":                    ["Chanukah", "Fourth Day", "Weekday"],
  "Chanukah Day 5":                    ["Chanukah", "Fifth Day", "Weekday"],
  "Chanukah Day 6":                    ["Chanukah", "Sixth Day", "Rosh Chodesh"],
  "Chanukah Day 7":                    ["Chanukah", "Seventh Day", "Weekday"],
  "Chanukah Day 7 (on Rosh Chodesh)":  ["Chanukah", "Seventh Day", "Rosh Chodesh"],
  "Chanukah Day 8":                    ["Chanukah", "Eighth Day", "Weekday"],
  "Purim":                             ["Purim", null, null],
  "Rosh Chodesh":                      ["Rosh Chodesh", null, "Weekday"],
  "Yom HaAtzma'ut":                    ["Yom HaAtzma'ut", null, null],
};

// Holdays that are kept and renamed, but only add a maftir
const SPECIAL_SHABBATOT: Record<string, RenamedHoliday> = {
  "Chanukah Day 1 (on Shabbat)":         ["Shabbat Chanukah", "First Day", null],
  "Chanukah Day 2 (on Shabbat)":         ["Shabbat Chanukah", "Second Day", null],
  "Chanukah Day 3 (on Shabbat)":         ["Shabbat Chanukah", "Third Day", null],
  "Chanukah Day 4 (on Shabbat)":         ["Shabbat Chanukah", "Fourth Day", null],
  "Chanukah Day 5 (on Shabbat)":         ["Shabbat Chanukah", "Fifth Day", null],
  "Chanukah Day 7 (on Shabbat)":         ["Shabbat Chanukah", "Seventh Day", null],
  "Shabbat Rosh Chodesh Chanukah":       ["Shabbat Chanukah", "Rosh Chodesh", null],
  "Chanukah Day 8 (on Shabbat)":         ["Shabbat Chanukah", "Eighth Day", null],
  "Shabbat HaChodesh":                   ["Shabbat HaChodesh", null, "–"],
  "Shabbat HaChodesh (on Rosh Chodesh)": ["Shabbat HaChodesh", null, "Rosh Chodesh"],
  "Shabbat Parah":                       ["Shabbat Parah", null, null],
  "Shabbat Shekalim":                    ["Shabbat Shekalim", null, "–"],
  "Shabbat Shekalim (on Rosh Chodesh)":  ["Shabbat Shekalim", null, "Rosh Chodesh"],
  "Shabbat Zachor":                      ["Shabbat Zachor", null, null],
  "Shabbat Rosh Chodesh":                ["Shabbat Rosh Chodesh", null, "–"],
  "Masei on Shabbat Rosh Chodesh":       ["Shabbat Rosh Chodesh", null, "Masei"],
};

// Holdays that are ignored for now
const IGNORED_HOLIDAYS = new Set([
  // Holidays that don't add any aliyot (i.e. only a haftarah)
  "Erev Tish'a B'Av",
  "Erev Purim",
  "Shabbat HaGadol",
  "Shabbat Shuva (with Vayeilech)",
  "Shabbat Shuva (with Ha'azinu)",
  "Shabbat Shuva",
  "Pinchas occurring after 17 Tammuz",
  "Kedoshim following Special Shabbat",
  "Ki Teitzei with 3rd Haftarah of Consolation",
  "Shabbat Machar Chodesh",
  // Holidays that don't have a particular date
  "Fast Day (Morning)",
  "Fast Day (Afternoon)",
]);

// ========================================================
//  [EVERYTHING BELOW THIS POINT GENERATED ENTIRELY BY AI]
// ========================================================

/**
 * The name a day or an occasion carries when the reading has nothing to say
 * about it - Purim being read one way on the one day, so that naming either
 * would be naming something the reader was never offered a choice of. The
 * nav bar leaves a dropdown out entirely where this is all it would hold.
 */
export const NONE = '';

/**
 * Every reading of every holiday, under the holiday, the day of it, and the
 * occasion the day falls on - the three of which are the three dropdowns the
 * nav bar offers a holiday under, and `NONE` where the reading has nothing to
 * say about one of them.
 *
 * A holiday's days are the ones it can be read on rather than all the ones it
 * has: Pesach is eight days, but the four of chol ha-moed which read aliyot
 * of their own are the four it lists. An occasion is what tells two readings
 * of the same day apart - the weekday reading of the first day of Pesach
 * against the one for when it falls on Shabbat, the two ways of reading the
 * mincha of Yom Kippur - and hebcal writes it into the reading's own key
 * (`'Pesach I (on Shabbat)'`), or, for the Shabbat of chol ha-moed, into the
 * maftir the day takes, which is what that reading is split by before it gets
 * here (see `MAFTIR_CHOICES`).
 *
 * Everything is in the order the dicts above list it in, which is the order
 * it is offered in.
 */
export type Readings =
  Partial<Record<string,           // holiday
  Partial<Record<string,           // day
  Partial<Record<string, Reading>>>>>>; // occasion

/**
 * Check that a reading's aliyot are keyed the way its naming takes them to
 * be, which is what catches an update to hebcal-leyning moving a reading out
 * from under the name we gave it.
 *
 * `numbered` asks that the aliyot besides the maftir run `1` through `n` with
 * no gaps, which a holiday's reading does because it is read straight through
 * - where a special shabbat's is added to the week's parashah, so which of
 * that parashah's aliyot it replaces is hebcal's to say and not ours to check.
 *
 * There is nothing else left to check. A reading carries a single maftir or
 * none at all, one which offers a choice of maftir having been split into a
 * reading per maftir before it got here (see `MAFTIR_CHOICES`) - and one
 * which still offered a choice would be keyed by something which is no
 * `Aliyah`, and so would never have loaded at all (see `HolidayLookup`).
 */
function checkAliyot(key: string, aliyot: Reading, numbered: boolean) {
  const found = aliyotOf(aliyot).filter((n) => n !== MAFTIR).map(Number);
  if (numbered && found.some((n, i) => n !== i + 1)) {
    throw new Error(`${key} is read as aliyot ${found.join(', ')}, which are ` +
                    `not 1 through ${found.length}`);
  }
}

/**
 * Every holiday reading of one book, under the names this file gives them,
 * along with the way back from one of hebcal's own keys to the name we gave
 * it - which is what the calendar has to have, since it can only ask hebcal
 * for a day under the key hebcal knows it by (see `place`).
 *
 * Every reading hebcal lists has to be accounted for by one of the three
 * dicts above, and every name they give has to be of a reading hebcal lists,
 * so that an update to hebcal-leyning which adds, drops, or renames a reading
 * is a build failure rather than a holiday quietly missing from the nav bar.
 */
export class Holidays {
  /** The holidays, which are read on days of their own */
  readonly holidays: Readings = {};
  /**
   * The special shabbatot, which are offered under a heading of their own: a
   * special shabbat is not a reading of its own day but a maftir added to a
   * Shabbat which reads its parashah as every other Shabbat does
   */
  readonly special: Readings = {};
  private readonly aliases: HolidayAliases;

  constructor(data: BookData) {
    const { holidayLookup } = data;
    this.aliases = data.holidayAliases;
    // A book which is read on no holiday at all has nothing to name, and no
    // reading to hold any of these names against
    if (Object.keys(holidayLookup).length === 0) { return; }

    for (const key of Object.keys(holidayLookup)) {
      if (!IGNORED_HOLIDAYS.has(key) && !(key in HOLIDAYS) &&
          !(key in SPECIAL_SHABBATOT)) {
        throw new Error(`hebcal reads ${key}, which holidays.ts does not name`);
      }
    }
    for (const key of IGNORED_HOLIDAYS) {
      if (!(key in holidayLookup)) {
        throw new Error(`holidays.ts names ${key}, which hebcal does not read`);
      }
    }

    this.file(this.holidays, HOLIDAYS, holidayLookup, true);
    this.file(this.special, SPECIAL_SHABBATOT, holidayLookup, false);
  }

  /**
   * File each of `namings`' readings under the holiday, day, and occasion it
   * is named as - checking as it goes that hebcal reads it, and that its
   * aliyot are keyed the way the naming takes them to be (see `checkAliyot`)
   */
  private file(readings: Readings, namings: Record<string, RenamedHoliday>,
               lookup: HolidayLookup, numbered: boolean) {
    for (const [key, [holiday, day, occasion]] of Object.entries(namings)) {
      const aliyot = lookup[key];
      if (aliyot === undefined) {
        throw new Error(`holidays.ts names ${key}, which hebcal does not read`);
      }
      checkAliyot(key, aliyot, numbered);
      ((readings[holiday] ??= {})[day ?? NONE] ??= {})[occasion ?? NONE] =
        aliyot;
    }
  }

  /**
   * Where the reading hebcal knows as `key` is offered here - the holiday,
   * the day, and the occasion - or `null` for one we do not offer at all.
   *
   * `cholHaMoedDay` is which day of chol ha-moed the reading is being read
   * on, for the Shabbat of it, which takes the maftir of whichever day it
   * falls on and so is a different reading of ours on each.
   *
   * This is how the calendar names the days it finds, and has to arrive back
   * at the same holiday, day, and occasion this reading was filed under.
   */
  place(key: string, cholHaMoedDay?: number): [string, string, string] | null {
    let under = this.aliases[key] ?? key;
    // hebcal names such a day by the one key it lists the reading under, so
    // the maftir the day takes is what says which of the readings split out
    // of that key it is (see `MAFTIR_CHOICES`)
    const choice = MAFTIR_CHOICES.find((c) => c.key === under);
    if (choice !== undefined) {
      const split = choice.maftirim[`M-day${cholHaMoedDay}`];
      if (split === undefined) { return null; }
      under = split;
    }
    const naming = HOLIDAYS[under] ?? SPECIAL_SHABBATOT[under];
    if (naming === undefined) { return null; }
    const [holiday, day, occasion] = naming;
    return [holiday, day ?? NONE, occasion ?? NONE];
  }
}
