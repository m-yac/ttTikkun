"""What has to hold of the built pages, whatever the sources throw at them.

These read the pages the `built` fixture just wrote -- see conftest.py.
"""

import json

from combine.main import dst_p as data_p

import pytest

scrolls = ['torah', 'esther']


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
    with (data_p / 'english' / f'{scroll}.json').open() as f:
        return json.load(f)

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
            for text, _ in sub["en"] for word in text.split() ]
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
        for text, he in sub["en"]:
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
        for text, he in sub["en"]:
            inner = he[1:-1] if len(he) > 1 else []
            assert [] not in inner, (ref, text, he)
            assert any(word != [] for word in he) or len(he) == 0, (ref, text, he)


@pytest.mark.parametrize('scroll', scrolls)
def test_each_broken_piece_is_answered_by_the_next_one(built, scroll):
    """A piece that continues into the fragment after it must be picked up by a
    piece that continues from the one before, and vice versa -- reading in
    order, they alternate."""
    marked = [ (ref, text, he) for ref, _, sub in fragments(scroll)
               for text, he in sub["en"]
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
def test_lookup_points_at_the_verse_it_claims(built, scroll):
    with (data_p / 'lookup' / f'{scroll}.json').open() as f:
        lookup = json.load(f)
    all_pages = pages(scroll)
    for book, chapters in lookup.items():
        for chapter, verses in chapters.items():
            for verse, entry in verses.items():
                for ref in entry["refs"]:
                    line = all_pages[ref["page"]-1][ref["line"]]
                    found = line["verses"][ref["index"]]
                    assert [found["book"], found["chapter"], found["verse"]] == \
                           [int(book), int(chapter), int(verse)]


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
