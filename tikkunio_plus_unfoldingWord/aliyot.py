import json
from pathlib import Path

from .NoIndentEncoder import NoIndent

top_level = Path(__file__).parent.parent

# The Torah's readings: the full kriyah and the holidays from hebcal-leyning,
# the triennial divisions from hebcal-triennial
leyning_p = top_level / 'textSources' / 'hebcal-leyning' / 'src'
triennial_p = top_level / 'textSources' / 'hebcal-triennial' / 'src'


def load(path):
    with path.open() as f:
        return json.load(f)


# ================
#  The parashiyot
# ================

def parashah_divisions():
    """Every parashah the Torah can be read in, with the ways each one can be
    divided into aliyot: the full kriyah, and every triennial division
    hebcal-triennial lists for it. Each is given as
    `{'book', 'joins', 'divisions'}`, `joins` naming the two parashiyot a
    doubled entry reads together and being empty for the rest.

    A doubled parashah comes before the two it joins, since a year which reads
    them together reads neither of them on its own.

    A triennial division is named as hebcal names it, which is for the year of
    the cycle it is read in -- 'Y.1' through 'Y.3' -- except where hebcal
    lists more than one per year: one per letter it gives the patterns of
    which of the three years a doubled parashah is read Separately or
    Together in ('D.1', the letters being spelled out by `year_types`), or
    one per way of dividing the parashah ('alt.Y.2', Vaetchanan being
    divisible so that the Ten Commandments fall in year two). Each of those is
    offered as a division in its own right, since which of them a given year
    uses is a property of the cycle rather than of the parashah.

    A division named for one of Israel's patterns is left out, as everything
    Israel's alone is: the diaspora's cycle never falls into one of those
    patterns, so it is a division no reader of ours reads.
    """
    leyning = load(leyning_p / 'aliyot.json')
    triennial = load(triennial_p / 'triennial.json')

    order = sorted((entry.get('num1', entry['num']),
                    not entry.get('combined'), name)
                   for name, entry in leyning.items())
    parashiyot = { name: { 'book': leyning[name]['book'],
                           'joins': [ leyning[name][part]
                                      for part in ('p1', 'p2')
                                      if part in leyning[name] ],
                           'divisions': { 'full': leyning[name]['fullkriyah'] } }
                   for _, _, name in order }

    for key, entry in triennial.items():
        # ':' marks an alternative division rather than another parashah
        name, _, variant = key.partition(':')
        if name not in parashiyot:
            continue
        listed = entry.get('years') or entry['variations']
        for div, aliyot in listed.items():
            qualifier, _, year = div.rpartition('.')
            if qualifier.startswith('IL'):
                continue
            # A division read exactly as another one is listed as its name
            while isinstance(aliyot, str):
                aliyot = listed[aliyot]
            if variant:
                qualifier = f'{variant}.{qualifier}'
            parashiyot[name]['divisions'][f'{qualifier}.{year}'] = aliyot

    return parashiyot


def patterns():
    """The pattern of which of the three years the pair is read Separately or
    Together in that each of hebcal's letters stands for, for every parashah
    read as one of a pair -- the doubled parashah and each of the two it
    joins alike, all three of which are read in the same patterns.

    A division is named by hebcal's letter and nothing else, the letters
    being what a reader is offered ('Year 1 (D)'), so this is the only thing
    which says what one of them means: which years read the pair apart, and
    so how often and when the division is read (see `splitYears` in
    `data.ts`). The letters are a pair's own and say nothing about any other
    pair, hebcal giving them out pattern by pattern in an order of its own.

    'Y' is not a letter of this kind -- it is the name a division carries
    when it is the only one of its year, and says nothing about any pattern
    -- so it is left out, as is every letter of Israel's (see
    `israels_letter`).
    """
    leyning = load(leyning_p / 'aliyot.json')
    triennial = load(triennial_p / 'triennial.json')
    types = {}
    for name, entry in leyning.items():
        if not entry.get('combined'):
            continue
        patterns = { letter: pattern for pattern, letter
                     in triennial[name].get('patterns', {}).items()
                     if letter != 'Y' and not letter.startswith('IL') }
        types[entry['p1']] = patterns
        types[entry['p2']] = patterns
    return types


def division_order(div):
    """The full kriyah first and then the triennial divisions by year, since
    which variant of a year a parashah is read in matters less than the year;
    within a year the plain 'Y' division, where there is one, comes first."""
    if div == 'full':
        return (0, 0, False, '')
    qualifier, _, year = div.rpartition('.')
    return (1, int(year), qualifier != 'Y', qualifier)


# ==============
#  The holidays
# ==============

# How hebcal keys the maftir of a reading which is read only one way
MAFTIR = 'M'

# The readings hebcal lists as one which are read as several here, each given
# as the key hebcal files it under and the name each of the maftirim it offers
# a choice of is read under.
#
# hebcal lists the Shabbat of chol ha-moed once, with a maftir for each day of
# chol ha-moed that Shabbat can fall on ('M-day1'); which of them is read is a
# property of the day rather than of the reading, so each is split out into a
# reading of its own, reading that maftir as its maftir. Every other reading
# is read exactly one way and needs no splitting, and any which hebcal comes
# to offer a choice of maftir in an update has to be added here -- which a
# reading turning up with a maftir keyed anything but `MAFTIR` is what catches
# (see `checkAliyot` in `holidays.ts`).
#
# `holidays.ts` names each of the readings this makes, and carries the same
# list so that it can name a day of hebcal's back to the reading it takes (see
# `MAFTIR_CHOICES` there).
MAFTIR_CHOICES = [
    { 'key': 'Sukkot Shabbat Chol ha-Moed',
      'maftirim': {
          'M-day1': 'Sukkot Shabbat Chol ha-Moed Day 1',
          'M-day2': 'Sukkot Shabbat Chol ha-Moed Day 2',
          'M-day3': 'Sukkot Shabbat Chol ha-Moed Day 3',
          'M-day4': 'Sukkot Shabbat Chol ha-Moed Day 4',
          'M-day5': 'Sukkot Shabbat Chol ha-Moed Day 5',
      } },
]


def split_maftirim(readings):
    """Every reading of `readings`, with each of the ones which offers a
    choice of maftir split into one reading per maftir on offer (see
    `MAFTIR_CHOICES`).

    Each stands where the reading it was split out of stood, so that the
    readings stay in hebcal's own order.
    """
    choices = { choice['key']: choice['maftirim'] for choice in MAFTIR_CHOICES }
    split = {}
    for key, aliyot in readings.items():
        maftirim = choices.get(key)
        if maftirim is None:
            split[key] = aliyot
            continue
        missing = [ maftir for maftir in maftirim if maftir not in aliyot ]
        if missing:
            raise Exception(f'{key} is read with no {", ".join(missing)}, '
                            f'which it was expected to offer a choice of')
        rest = { num: aliyah for num, aliyah in aliyot.items()
                 if num not in maftirim }
        for maftir, name in maftirim.items():
            split[name] = { **rest, MAFTIR: aliyot[maftir] }
    return split


def holiday_readings():
    """Every reading hebcal lists for a holiday, aliyah by aliyah, under the
    key hebcal files it under -- or, for a reading which offers a choice of
    maftir, under the name each of those maftirim is read under (see
    `split_maftirim`).

    An alias is a second name for a reading listed under another (see
    `holiday_aliases`), and an Israel reading is a second way of reading a day
    we already have, so neither is a reading of its own. Everything else is
    listed, including the days which add only a maftir to the week's parashah
    and the days which read nothing at all: `holidays.ts` has to account for
    every reading there is, and can only do that if it is shown every one.
    """
    return split_maftirim(
        { key: reading.get('fullkriyah', {})
          for key, reading in load(leyning_p / 'holiday-readings.json').items()
          if not reading.get('alias') and not reading.get('il') })


def holiday_aliases(readings):
    """The second names hebcal files some of its readings under, each against
    the reading it stands for.

    hebcal names a day by whichever of these it happens to use -- the fast of
    Gedaliah rather than the morning of a fast day, the month rather than Rosh
    Chodesh -- so a day it names can only be matched to a reading of ours once
    these have been followed (see `Holidays.place` in `holidays.ts`).
    """
    return { key: reading['key']
             for key, reading in load(leyning_p / 'holiday-readings.json').items()
             if reading.get('alias') and not reading.get('il')
             and reading['key'] in readings }


# ============================
#  Placing them in the pages
# ============================

def aliyah_order(num):
    """The order hebcal's aliyot are read in: the numbered ones, and then the
    maftir."""
    return (0, int(num), '') if num.isdigit() else (1, 0, num)


def parse_verse(book, ref):
    """A hebcal 'chapter:verse' within a book of the Torah."""
    chapter, _, verse = ref.partition(':')
    return [book, int(chapter), int(verse)]


def verse_refs(verse_lookup, what, verse):
    """Every line the verse appears on, in reading order."""
    book, chapter, num = verse
    entry = verse_lookup.get(book, {}).get(chapter, {}).get(num)
    if entry is None:
        raise Exception(f'{what} is at {book} {chapter}:{num}, which is not '
                        f'on any page of the scroll')
    return [ ref.value for ref in entry['refs'] ]


def place(what, begin, end):
    """An aliyah: the verses it runs from and to, both inclusive
    """
    if begin[0] != end[0]:
        raise Exception(f'{what} does not begin and end in the same book')
    return NoIndent([begin[0], begin[1:], end[1:]])


def parashah_aliyot():
    """Where each aliyah of each division of each parashah begins and ends."""
    placed = {}
    for name, parashah in parashah_divisions().items():
        placed[name] = {}
        for div, aliyot in sorted(parashah['divisions'].items(),
                                  key=lambda kv: division_order(kv[0])):
            placed[name][div] = {}
            for num in sorted(aliyot, key=aliyah_order):
                # An aliyah is listed as [begin, end], sometimes followed by a
                # note on where other sources put its edges, which we have no
                # use for
                begin, end = aliyot[num][0], aliyot[num][1]
                placed[name][div][num] = place(
                    f'{name} {div} aliyah {num}',
                    parse_verse(parashah['book'], begin),
                    parse_verse(parashah['book'], end))
    return placed


def holiday_aliyot():
    """Where each aliyah of each holiday reading begins and ends."""
    placed = {}
    for key, aliyot in holiday_readings().items():
        placed[key] = {}
        for num in sorted(aliyot, key=aliyah_order):
            span = aliyot[num]
            placed[key][num] = place(f'{key} aliyah {num}',
                                     parse_verse(span['k'], span['b']),
                                     parse_verse(span['k'], span['e']))
    return placed


def lookups(scroll):
    """The aliyot of everything read from `scroll`, to be written into its
    book file alongside the verse lookup they were placed with.

    Only the Torah is read in parashiyot or on a holiday, so every other
    scroll is left with neither.
    """
    if scroll != 'torah':
        return { 'aliyahLookup': {}, 'patterns': {}, 'holidayLookup': {},
                 'holidayAliases': {} }
    holidays = holiday_aliyot()
    return { 'aliyahLookup': parashah_aliyot(),
             'patterns': patterns(),
             'holidayLookup': holidays,
             'holidayAliases': holiday_aliases(holidays) }
