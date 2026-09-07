"""What has to hold of the built pages, whatever the sources throw at them.

These read the pages the `built` fixture just wrote -- see conftest.py.
"""

import json

from tikkunio_plus_unfoldingWord.aliyot import (holiday_readings,
                                                parashah_divisions)
from tikkunio_plus_unfoldingWord.main import data_p as data_p, ult_data

import pytest

scrolls = ['torah', 'esther']


def book_data(scroll):
    """What the build wrote about the scroll itself: its page count, its line
    counts, and its lookups."""
    with (data_p / 'books' / f'{scroll}.json').open() as f:
        return json.load(f)

def pages(scroll):
    """Every page's lines, read back out of the array-like object each page is
    written as."""
    out, page = [], 1
    while (data_p / 'pages' / scroll / f'{page}.json').exists():
        with (data_p / 'pages' / scroll / f'{page}.json').open() as f:
            lines = json.load(f)
            out.append([ lines[str(i)] for i in range(0, lines["length"]) ])
        page += 1
    return out

def english(scroll):
    """The translation the build read, verse by verse. It is no longer written
    out -- the pages are all there is now -- so it is taken straight from the
    build that the `built` fixture just ran."""
    return [ [ entry.value for entry in verse ] for verse in ult_data[scroll] ]

def parts(line):
    """A line's verse parts in reading order."""
    return [ part for column in line["text"]
             for fragment in column
             for part in fragment ]

def fragments(scroll):
    """Every fragment in reading order, with the ref that addresses it."""
    for page, lines in enumerate(pages(scroll), 1):
        for line_num, line in enumerate(lines):
            for frag_num, sub in enumerate(parts(line)):
                yield [page, line_num, frag_num], line, sub

@pytest.mark.parametrize('scroll', scrolls)
def test_english_reads_in_ult_order_and_nothing_is_lost(built, scroll):
    """The whole point of the breaks. Reading the scroll fragment by fragment
    has to give back the ULT exactly: every word once, in its own order."""
    want = [ word for verse in english(scroll) for entry in verse
             for word in entry["en"].split() ]
    got = [ word for _, _, sub in fragments(scroll)
            for text, _, *_rest in sub["en"] for word in text.split() ]
    assert got == want


@pytest.mark.parametrize('scroll', scrolls)
def test_every_footnote_lands_in_the_pages_once(built, scroll):
    """The pages carry the whole ULT now, notes and all: each one appears once,
    in the order the translation gives them."""
    want = [ note for verse in english(scroll) for entry in verse
             for note in entry["footnotes"] ]
    got = [ note for _, _, sub in fragments(scroll)
            for piece in sub["en"] if len(piece) > 2 for note in piece[2] ]
    assert got == want


@pytest.mark.parametrize('scroll', scrolls)
def test_verse_index_addresses_a_verse_the_line_has(built, scroll):
    """The Decalogue reads all four short commandments as one verse, so its
    lines hold more sentences than they do verses."""
    for ref, line, sub in fragments(scroll):
        assert 0 <= sub["verseIndex"] < len(line["verses"]), ref


@pytest.mark.parametrize('scroll', scrolls)
def test_every_fragment_has_hebrew(built, scroll):
    for ref, _, sub in fragments(scroll):
        assert len(sub["he"]) > 0, ref


@pytest.mark.parametrize('scroll', scrolls)
def test_refs_point_at_hebrew_that_exists(built, scroll):
    """A bare number is a word of the fragment it sits in; a four-part ref is a
    word somewhere else on the scroll."""
    everything = { tuple(ref): sub for ref, _, sub in fragments(scroll) }
    for ref, _, sub in fragments(scroll):
        for text, he, *_ in sub["en"]:
            for word in he:
                if word == []:
                    continue
                if isinstance(word, int):
                    assert 0 <= word < len(sub["he"]), (ref, text, word)
                else:
                    assert len(word) == 4, (ref, text, word)
                    assert tuple(word[:3]) in everything, (ref, text, word)
                    assert tuple(word[:3]) != tuple(ref), (ref, text, word)
                    other = everything[tuple(word[:3])]
                    assert 0 <= word[3] < len(other["he"]), (ref, text, word)


@pytest.mark.parametrize('scroll', scrolls)
def test_continuation_markers_sit_at_the_edges_of_a_ref_list(built, scroll):
    """An empty ref stands in for a neighbouring piece, so it only makes sense
    leading or trailing -- and a piece is never only markers."""
    for ref, _, sub in fragments(scroll):
        for text, he, *_ in sub["en"]:
            inner = he[1:-1] if len(he) > 1 else []
            assert [] not in inner, (ref, text, he)
            assert any(word != [] for word in he) or len(he) == 0, (ref, text, he)


@pytest.mark.parametrize('scroll', scrolls)
def test_each_broken_piece_is_answered_by_the_next_one(built, scroll):
    """A piece that continues into the fragment after it must be picked up by a
    piece that continues from the one before, and vice versa -- reading in
    order, they alternate."""
    marked = [ (ref, text, he) for ref, _, sub in fragments(scroll)
               for text, he, *_ in sub["en"]
               if len(he) > 0 and (he[0] == [] or he[-1] == []) ]
    expecting = False
    for ref, text, he in marked:
        assert (he[0] == []) == expecting, (ref, text, he)
        expecting = he[-1] == [] and len(he) > 1
    assert not expecting, "a piece continues into nothing"


@pytest.mark.parametrize('scroll', scrolls)
def test_a_verses_words_are_numbered_straight_through(built, scroll):
    """indexOfFirstWord picks up exactly where the verse left off on the line
    before, so a verse's words number continuously however many lines it
    crosses -- and a verse starts at nought."""
    seen = {}
    for page, lines in enumerate(pages(scroll), 1):
        for line_num, line in enumerate(lines):
            words = {}
            for sub in parts(line):
                words[sub["verseIndex"]] = \
                    words.get(sub["verseIndex"], 0) + len(sub["he"])
            for i, verse in enumerate(line["verses"]):
                if i not in words:
                    continue
                key = (verse["book"], verse["chapter"], verse["verse"])
                assert verse["indexOfFirstWord"] == seen.get(key, 0), \
                       (key, page, line_num)
                seen[key] = seen.get(key, 0) + words[i]


@pytest.mark.parametrize('scroll', scrolls)
def test_book_counts_the_pages_and_their_lines(built, scroll):
    """`standardNumLines` and `variantNumLines` together give every page's line
    count, which is what the reader leaves room for before it lays a page out."""
    data, all_pages = book_data(scroll), pages(scroll)
    assert data["pageCount"] == len(all_pages)
    for page, lines in enumerate(all_pages, 1):
        expected = data["variantNumLines"].get(str(page),
                                               data["standardNumLines"])
        assert len(lines) == expected
    assert data["standardNumLines"] not in data["variantNumLines"].values()


@pytest.mark.parametrize('scroll', scrolls)
def test_lookup_points_at_the_verse_it_claims(built, scroll):
    lookup = book_data(scroll)["verseLookup"]
    all_pages = pages(scroll)
    for book, chapters in lookup.items():
        for chapter, verses in chapters.items():
            for verse, entry in verses.items():
                for ref in entry["refs"]:
                    line = all_pages[ref["page"]-1][ref["line"]]
                    found = line["verses"][ref["index"]]
                    assert [found["book"], found["chapter"], found["verse"]] == \
                           [int(book), int(chapter), int(verse)]


def check_lines_run_between(scroll, listed):
    """Each aliyah is listed as running between the lines its first and last
    verses are on: the first line of the first verse, the last of the last."""
    lookup = book_data(scroll)["verseLookup"]
    for key, span in listed.items():
        assert span["begin"] <= span["end"], key
        for verse, want, first in [(span["begin"], span["firstLine"], True),
                                   (span["end"], span["lastLine"], False)]:
            book, chapter, num = verse
            refs = lookup[str(book)][str(chapter)][str(num)]["refs"]
            ref = refs[0] if first else refs[-1]
            assert { k: ref[k] for k in want } == want, key


@pytest.mark.parametrize('scroll', scrolls)
def test_every_aliyah_of_every_parashah_is_placed_in_the_scroll(built, scroll):
    """The `aliyahLookup` holds every way hebcal divides every parashah, each
    aliyah placed at the lines its verses fall on."""
    listed = {}
    for parashah, divisions in book_data(scroll)["aliyahLookup"].items():
        assert divisions
        for division, aliyot in divisions.items():
            assert aliyot
            for num, span in aliyot.items():
                listed[(parashah, division, num)] = span
    check_lines_run_between(scroll, listed)


@pytest.mark.parametrize('scroll', scrolls)
def test_every_holiday_reading_is_placed_in_the_scroll(built, scroll):
    """The `holidayLookup` holds every reading hebcal lists for a holiday
    under hebcal's own key, each aliyah placed at the lines its verses fall
    on. A day which reads nothing of the Torah is listed with no aliyot at
    all, so that `holidays.ts` is shown every reading there is.

    Nothing more is asked of them than that. A holiday's aliyot are read on
    the day rather than in the order of the scroll, so unlike the parashiyot
    they need not follow one another and need not run forwards -- see
    `HolidayLookup` in `data.ts`.
    """
    holidays = book_data(scroll)["holidayLookup"]
    assert set(holidays) == \
        (set(holiday_readings()) if scroll == 'torah' else set())

    listed = { (name, num): span
               for name, aliyot in holidays.items()
               for num, span in aliyot.items() }
    check_lines_run_between(scroll, listed)


@pytest.mark.parametrize('scroll', scrolls)
def test_every_alias_stands_for_a_reading_that_is_there(built, scroll):
    """Each of `holidayAliases` names a reading the `holidayLookup` holds, so
    that following one always arrives somewhere."""
    data = book_data(scroll)
    for alias, key in data["holidayAliases"].items():
        assert key in data["holidayLookup"], alias
        assert alias not in data["holidayLookup"], alias


@pytest.mark.parametrize('scroll', scrolls)
def test_the_parashiyot_tile_the_scroll_in_order(built, scroll):
    """Every scroll read in parashiyot is covered by them exactly once: each
    full kriyah runs straight through its parashah, and each parashah picks up
    where the one before it left off. This is what lets the nav bar find the
    parashah a verse belongs to by looking for the last one to begin at or
    before it.

    A doubled parashah is not part of that run -- it covers the same verses as
    the two it joins, and is listed before them so that the singles are what
    the nav bar settles on.
    """
    aliyot = book_data(scroll)["aliyahLookup"]
    joins = { name: parashah["joins"]
              for name, parashah in parashah_divisions().items() } \
            if scroll == 'torah' else {}
    assert set(aliyot) == set(joins)

    def run_through(parashah):
        """A parashah's full kriyah, aliyah by aliyah. The maftir repeats the
        end of the seventh rather than following it, so it is no part of it."""
        full = aliyot[parashah]["full"]
        run = [ full[str(num)] for num in range(1, 9) if str(num) in full ]
        for before, after in zip(run, run[1:]):
            assert before["end"] < after["begin"], parashah
        if "M" in full:
            last = str(len(run))
            assert full[last]["begin"] <= full["M"]["begin"]
            assert full["M"]["end"] == full[last]["end"]
        return run

    ends_at = None
    for parashah, parts in joins.items():
        run = run_through(parashah)
        if parts:
            # The pair takes in its two parashiyot and nothing besides
            first, second = (run_through(part) for part in parts)
            assert run[0]["begin"] == first[0]["begin"]
            assert run[-1]["end"] == second[-1]["end"]
            continue
        if ends_at is not None:
            assert ends_at < run[0]["begin"], parashah
        ends_at = run[-1]["end"]


def test_the_decalogue_reads_its_four_commandments_as_one_verse(built):
    """Exodus 20:13 and Deuteronomy 5:17 each hold four sentences, one per
    commandment, where every other verse in the scroll holds one."""
    torah = pages('torah')
    for page, line_num, chapter, verse in [(84, 13, 20, 13), (209, 8, 5, 17)]:
        line = torah[page-1][line_num-1]
        assert [ (v["chapter"], v["verse"]) for v in line["verses"] ][-1] == \
               (chapter, verse)
        # Two sentences of it fall on this line -- "you shall not murder", then
        # the start of "you shall not commit adultery" -- and both are that one
        # verse, not one verse each.
        assert [ sub["verseIndex"] for sub in parts(line) ][-2:] == \
               [len(line["verses"])-1, len(line["verses"])-1]
