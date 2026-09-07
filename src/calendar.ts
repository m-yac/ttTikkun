// ==========================================================
//  When each reading is next read [GENERATED ENTIRELY BY AI]
// ==========================================================

import type { HDate } from '@hebcal/core';
import { divisionYear, divisionPatternName, FULL_KRIYAH, MAFTIR,
         TriennialDivision, type Division } from './data';
import { NONE, type Holidays } from './holidays';

/**
 * Which calendar to read by. Nothing Israel's alone reaches our data at all:
 * the readings hebcal marks as Israel's are left out of the `HolidayLookup`,
 * and the divisions named for the patterns of Separate and Together years
 * which only Israel falls into are left out of the `AliyahLookup` (see
 * `holiday_readings` and `israels_letter` in `aliyot.py`). The few days of
 * Sukkot and Simchat Torah which Israel alone reads and hebcal does not mark
 * are the one thing left to leave out here, and are named in
 * `ONLY_IN_ISRAEL`.
 */
const IL = false;

/**
 * How many of the years ahead a reading is read in are worth naming - the
 * ones after them being far enough off that saying which they are tells the
 * reader nothing they did not already know from the two before
 */
const AHEAD = 2;

/**
 * How many triennial cycles ahead to look for the years which read a parashah
 * as one of its divisions does.
 *
 * A year of the cycle comes round every three years, but a cycle which splits
 * the parashah's pair in some particular way can be a good deal rarer than
 * that. This is exactly as far as it takes to find `AHEAD` years for every
 * division our data lists: Vayakhel and Pekudei as `SSS` are the last to be
 * settled, and are settled on the 263rd cycle. Every division listed is one
 * our own calendar reads - the ones only Israel reads never reach the data
 * (see `IL`) - so nothing is ever scanned this far without something to
 * find.
 */
const CYCLES = 263;

/**
 * How many years ahead to look for a day a holiday's reading falls on. The
 * rarest of them - the seventh day of Pesach on Shabbat, and the second day
 * of Chanukah - come round about every twenty, and this is far enough to
 * find `AHEAD` of every one of them.
 */
const YEARS = 25;

/**
 * The holiday, day, and occasion of a reading, as the years ahead are filed
 * under - a day being asked after under the first two alone
 */
function place(...parts: readonly string[]): string {
  return parts.join('\n');
}

/**
 * The readings which only Israel's calendar comes round to, and so which no
 * reader of ours reads.
 *
 * Israel keeps one day of a festival where the diaspora keeps two, which
 * moves the whole of Sukkot along by a day: the fifth day of chol ha-moed is
 * Hoshana Raba in the diaspora and a day of its own in Israel, and Simchat
 * Torah is the 22nd of Tishrei there and the 23rd here. So Israel reads days
 * the diaspora never reaches - and a Shabbat of chol ha-moed, which takes the
 * maftir of whichever day it falls on, falls on the first, third or fourth
 * day here and on the second or fifth only there.
 *
 * hebcal marks most of Israel's readings as its own, and those never reach
 * our data; these it does not, so they are named here. Scanning two thousand
 * years of the diaspora's calendar turns up these and no others.
 */
const ONLY_IN_ISRAEL: ReadonlySet<string> = new Set([
  place('Sukkot', 'Fifth Day of Chol Hamoed', 'Weekday'),
  place('Sukkot', 'Fifth Day of Chol Hamoed', 'Shabbat'),
  place('Sukkot', 'Second Day of Chol Hamoed', 'Shabbat'),
  place('Simchat Torah', 'Morning', 'Shabbat'),
]);

/**
 * The readings which no calendar comes round to, in Israel or here.
 *
 * hebcal lists a reading for every day a holiday could fall on without
 * asking whether the calendar ever puts it there, and the fifth day of
 * Chanukah is one it never does: Kislev is 29 or 30 days, and neither
 * length ever leaves that day a Shabbat. Scanning three hundred years turns
 * up this one and no others.
 */
const NEVER_FALLS: ReadonlySet<string> = new Set([
  place('Shabbat Chanukah', 'Fifth Day', NONE),
]);

/**
 * Whether one of a holiday's readings falls on a day our calendar never comes
 * round to - one only Israel keeps, or one no calendar reaches at all (see
 * `ONLY_IN_ISRAEL` and `NEVER_FALLS`).
 *
 * A parashah needs nothing of the kind: every division our data lists is one
 * our own calendar reads (see `IL`).
 */
export function neverFalls(holiday: string, day: string, occasion: string):
    boolean {
  const at = place(holiday, day, occasion);
  return ONLY_IN_ISRAEL.has(at) || NEVER_FALLS.has(at);
}

/**
 * The days each reading which no day of hebcal's is named for is read on.
 *
 * A day carries one reading in hebcal, which is the one read in the morning,
 * so the readings of an afternoon and of a night are named by no day at all:
 * the two ways of reading the mincha of Yom Kippur, and the night on which
 * Simchat Torah begins. Each is read on a day we do find, and is read
 * whichever way that day divides its own reading, so the days are named here
 * and their years taken as its own.
 */
const SAME_DAY: Record<string, readonly string[]> = {
  [place('Yom Kippur', 'Afternoon')]: [place('Yom Kippur', 'Morning')],
  [place('Simchat Torah', 'Evening')]: [place('Simchat Torah', 'Morning')],
};

/**
 * Everything we ask hebcal, which is a good deal more code than the rest of
 * the book put together and none of which is needed to read it - so it is
 * fetched only once the reader reaches for one of the dropdowns which shows
 * the years, and until it arrives no reading has one (see `loadCalendar`)
 */
type Hebcal = {
  core: typeof import('@hebcal/core'),
  leyning: typeof import('@hebcal/leyning'),
  triennial: typeof import('@hebcal/triennial'),
};
let hebcal: Hebcal | null = null;

/**
 * Where in the year the reader is, which is what 'next' is measured from -
 * fixed when the calendar loads, as everything worked out from it is
 */
let today: HDate;

/**
 * Fetch the calendar, and call `ready` once the years can be worked out. A
 * calendar which fails to arrive simply leaves every reading without one.
 *
 * This is a large download and a fair amount of work, so it is asked for only
 * when something is about to want it rather than on the way in (see
 * `onReach` in `nav.ts`).
 */
export function loadCalendar(ready: () => void) {
  if (hebcal !== null) { return ready(); }
  void Promise.all([import('@hebcal/core'), import('@hebcal/leyning'),
                    import('@hebcal/triennial')])
    .then(([core, leyning, triennial]) => {
      hebcal = { core, leyning, triennial };
      today = new core.HDate(new Date());
      ready();
    })
    .catch(() => {});
}

/** Whether the calendar has landed, and so has any year to give */
export function haveCalendar(): boolean {
  return hebcal !== null;
}

/** The civil year a date falls in, or `null` where it has already gone by */
function yearOf(date: HDate | undefined): number | null {
  return date !== undefined && date.abs() >= today.abs()
    ? date.greg().getFullYear() : null;
}


// ================
//  The parashiyot
// ================

/** Every parashah we have worked the years out for already */
const cache = new Map<string, Map<string, number[]>>();

/**
 * Which of a parashah's divisions are read in the same years as each other:
 * the year of the cycle, and hebcal's letter for the pattern of Separate and
 * Together years its pair is read in - `'Y'` being the name a division
 * carries when it is the only one of its year, and so asking nothing of the
 * cycle beyond that the parashah is read in it at all. The ways of dividing
 * one reading ('Year 2', 'Year 2 Alternate') differ in neither, and share their
 * years.
 *
 * This is hebcal's own name for a reading, which is what it answers with
 * when asked how it reads a parashah in a year of a cycle.
 */
function readingKey(division: Division): string {
  return `${divisionPatternName(division)}.${divisionYear(division)}`;
}

/**
 * The next few years in which `parashah` is read as each of `divisions`
 * divides it, soonest first - a division which is never read that way, and
 * every division at all before the calendar has landed, having no years.
 *
 * The cycles ahead are walked once, and each one asked how it reads the
 * parashah in each of its three years: which years of it read the parashah as
 * aliyot of its own - a year which reads its pair the other way round reads
 * it as none - and which of the readings of it each of those years reads,
 * which hebcal names as our divisions are named. The walk stops as soon as
 * every division asked for has all the years it needs, which for most
 * parashiyot is within the first few cycles.
 *
 * A whole parashah is worked out at once rather than a division at a time,
 * since every division of it is read out of the same cycles as every other.
 */
export function parashahYears(parashah: string,
                              divisions: readonly Division[]):
    Map<string, number[]> {
  if (hebcal === null) { return new Map(); }
  const found = cache.get(parashah);
  if (found !== undefined) { return found; }

  const { getTriennial, Triennial } = hebcal.triennial;
  // The years of each reading a division of this parashah names, which
  // several of them can share
  const readings = new Map<string, number[]>();
  for (const division of divisions) {
    if (division === FULL_KRIYAH) { continue; }
    readings.set(readingKey(division), []);
  }

  const start = Triennial.getCycleStartYear(today.getFullYear());
  const wanting = () =>
    [...readings.values()].some((years) => years.length < AHEAD);
  for (let n = 0; n < CYCLES && wanting(); n++) {
    // Every year of a cycle is read out of that same cycle, so one is enough
    // to answer for all three
    let cycle;
    try { cycle = getTriennial(start + 3 * n); }
    // A cycle hebcal will not give us is the end of what we can look over
    catch { break; }

    try {
      for (let yr = 0; yr < 3; yr++) {
        const reading = cycle.getReading(parashah, yr);
        // A year which reads the pair the other way round reads this parashah
        // as no aliyot of its own, and so reads none of its divisions
        if (reading.aliyot === undefined) { continue; }
        const year = yearOf(reading.date);
        // hebcal names the reading exactly as one of our divisions is named,
        // save that a parashah read the same way every year is named for the
        // one year it was written down under, where we list it under each -
        // so the year is taken from the one being asked after and only the
        // pattern is read out of hebcal's name
        const named = TriennialDivision.safeParse(reading.variation);
        if (!named.success) { continue; }
        const key = `${divisionPatternName(named.data)}.${yr + 1}`;
        const years = readings.get(key);
        if (year !== null && years !== undefined && years.length < AHEAD) {
          years.push(year);
        }
      }
    }
    // A parashah hebcal has never heard of is read in no year of any cycle
    catch { break; }
  }

  const years = new Map<string, number[]>();
  for (const division of divisions) {
    const read = readings.get(readingKey(division));
    if (read !== undefined) { years.set(division, read); }
  }
  cache.set(parashah, years);
  return years;
}


// ==============
//  The holidays
// ==============

/**
 * The years ahead each holiday reading is read in, soonest first, under the
 * day it falls on and under that day's occasion - a day being worth a year of
 * its own because it is offered in a dropdown of its own (see `AliyahChoice`
 * in `nav.ts`)
 */
let scanned: Map<string, number[]> | null = null;

/**
 * Add a year to the ones `at` is read in. The days are scanned a year at a
 * time, but a Hebrew year runs across two civil ones, so where a year lands
 * among those already found is not something the order of the scan settles.
 */
function remember(years: Map<string, number[]>, at: string, year: number) {
  const found = years.get(at) ?? [];
  if (found.includes(year)) { return; }
  found.push(year);
  found.sort((a, b) => a - b);
  years.set(at, found);
}

/**
 * Note that the reading hebcal knows as `key` is read in the year `date`
 * falls in, under the holiday, day, and occasion we file that key under -
 * and under the day alone besides. A key we give no name to is one of the
 * readings we do not offer, and is passed over.
 */
function found(holidays: Holidays, years: Map<string, number[]>, key: string,
               cholHaMoedDay: number | undefined, date: HDate | undefined) {
  const year = yearOf(date);
  if (year === null) { return; }
  const at = holidays.place(key, cholHaMoedDay);
  if (at === null) { return; }
  const [holiday, day, occasion] = at;
  remember(years, place(holiday, day), year);
  remember(years, place(holiday, day, occasion), year);
}

/**
 * Every day of the years ahead which reads something of the Torah, filed
 * under the holiday, day, and occasion our data lists it as.
 *
 * A day is found in one of two ways. A holiday is an event of hebcal's, and
 * names its own reading. A special shabbat is not: it reads the week's
 * parashah as any other Shabbat does and only adds a maftir to it, so it is
 * named by the reason hebcal gives for that maftir rather than by an event -
 * which is also the only way to find the Shabbat Rosh Chodesh which falls in
 * Masei, since that one is a property of the parashah being read and not of
 * the day.
 *
 * Every holiday is scanned at once, since the days of a year arrive together
 * and sorting them costs far less than walking the years again.
 */
function scanHolidays(holidays: Holidays): Map<string, number[]> {
  const { HDate, HebrewCalendar } = hebcal!.core;
  const { getLeyningKeyForEvent, getLeyningOnDate } = hebcal!.leyning;
  const years = new Map<string, number[]>();

  for (let i = 0; i < YEARS; i++) {
    const year = today.getFullYear() + i;
    for (const event of HebrewCalendar.getHolidaysForYearArray(year, IL)) {
      const key = getLeyningKeyForEvent(event, IL);
      if (key !== undefined) {
        found(holidays, years, key, event.cholHaMoedDay, event.getDate());
      }
    }
    // 1 Tishrei begins the year; the Shabbatot run from the first one after it
    let date = new HDate(1, 7, year);
    while (date.getDay() !== 6) { date = date.next(); }
    for (; date.getFullYear() === year; date = new HDate(date.abs() + 7)) {
      const reading = getLeyningOnDate(date, IL, false);
      // A Shabbat which reads its parashah straight through gives no reason
      // for any of its aliyot, having nothing to explain
      const maftir = reading !== undefined && 'reason' in reading
        ? reading.reason?.[MAFTIR] : undefined;
      if (maftir !== undefined) {
        found(holidays, years, maftir, undefined, date);
      }
    }
  }

  // A reading no day of hebcal's is named for is read on the days of another,
  // whose years are its own - however that day divides its own reading
  for (const [at, sources] of Object.entries(SAME_DAY)) {
    const read = [...new Set(sources.flatMap((from) => years.get(from) ?? []))]
                   .sort((a, b) => a - b);
    const [holiday, day] = at.split('\n');
    years.set(at, read);
    for (const occasion of Object.keys(holidays.holidays[holiday]?.[day] ?? {})) {
      years.set(place(at, occasion), read);
    }
  }

  for (const [at, read] of years) { years.set(at, read.slice(0, AHEAD)); }
  return years;
}

/**
 * The next few years each holiday reading is read in, soonest first, under
 * the day it falls on (`'Pesach\nFirst Day'`) and under that day's occasion
 * (`'Pesach\nFirst Day\nShabbat'`) - nothing at all being read before the
 * calendar has landed.
 *
 * Every holiday is worked out at once, and only once: the days of a year
 * arrive from hebcal together, so asking after one reading costs the same as
 * asking after all of them.
 */
export function holidayYears(holidays: Holidays): Map<string, number[]> {
  if (hebcal === null) { return new Map(); }
  return scanned ??= scanHolidays(holidays);
}
