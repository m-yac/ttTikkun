"""Where the English gets broken when it crosses a fragment boundary."""

from tikkunio_plus_unfoldingWord.main import break_at, en_prefixes, frag_sequence, verse_breaks


def verse(alignments, frags):
    """A verse to hand to verse_breaks, from alignments written as
    (english, [hebrew word index, ...]) and Hebrew written as one string of
    space-separated words per fragment.

    Every Hebrew word is given the same width, so the breaks fall wherever the
    *counts* say, which keeps the expectations below readable.
    """
    entries = [ { "en": en, "he": he } for en, he in alignments ]
    at, i = {}, 0
    for f, words in enumerate(frags):
        for _ in words.split():
            at[i] = f
            i += 1

    words = [ entry["en"].split() for entry in entries ]
    starts = [0]
    for w in words:
        starts.append(starts[-1] + len(w))
    prefixes = en_prefixes([ word for w in words for word in w ])

    return verse_breaks(entries, at, len(frags), { i: 1.0 for i in at },
                        prefixes, starts), starts


def test_break_falls_between_alignments_that_dont_overlap():
    # "b" is the last on the near side and "c" the first on the far side, so the
    # break goes between them and neither is broken.
    breaks, starts = verse([("a", [0]), ("b", [1]), ("c", [2]), ("d", [3])],
                           ["w w", "w w"])
    assert breaks == [starts[2]]


def test_alignment_straddling_a_boundary_alone_is_broken_through():
    # Nothing else is contested, so there is no seam to break at: the alignment
    # itself has to give, and its four words split with the Hebrew two-to-one.
    breaks, starts = verse([("the", [0]), ("and let it separate", [1, 2, 3])],
                           ["w w w", "w"])
    assert starts[1] < breaks[0] < starts[2]


def test_single_word_straddling_a_boundary_goes_to_the_wider_side():
    # One word can't be broken, so it goes whole -- to the near side, which has
    # two of the three Hebrew words behind it.
    breaks, starts = verse([("thigh", [0, 1, 2])], ["w w", "w"])
    assert breaks == [starts[1]]

    # ... and to the far side when the weight is there instead.
    breaks, starts = verse([("thigh", [0, 1, 2])], ["w", "w w"])
    assert breaks == [starts[0]]


def test_english_doubling_back_breaks_at_a_seam_not_through_an_alignment():
    # Esther 9:1: "Now in" and "12" both reach across the boundary while "month"
    # sits beyond it, so all three are contested. A seam is available, so the
    # break takes it and leaves every alignment whole.
    breaks, starts = verse(
        [("Now in", [0, 1]), ("month", [2]), ("twelve", [0, 1]), ("which", [3])],
        ["w", "w w w"])
    assert breaks[0] in (starts[1], starts[2])


def test_breaks_never_move_backwards():
    # One alignment over four fragments: it gets a break per boundary, and they
    # have to come in order or the English would read out of order.
    breaks, _ = verse([("a b c d", [0, 1, 2, 3])], ["w", "w", "w", "w"])
    assert breaks == sorted(breaks)
    assert len(breaks) == 3


def test_break_at_lands_on_the_hebrews_proportions():
    prefixes = [0, 1, 2, 3, 4]
    candidates = [0, 1, 2, 3, 4]
    assert break_at(prefixes, 0, 4, candidates, 1, 1) == 2
    assert break_at(prefixes, 0, 4, candidates, 3, 1) == 3
    assert break_at(prefixes, 0, 4, candidates, 0, 1) == 0


def test_break_at_only_ever_returns_a_candidate():
    prefixes = [0, 1, 2, 3, 4]
    assert break_at(prefixes, 0, 4, [1, 3], 1, 1) in (1, 3)
    assert break_at(prefixes, 0, 4, [2], 99, 1) == 2


def test_break_at_falls_back_when_the_hebrew_has_no_width():
    assert break_at([0, 1], 0, 1, [0, 1], 0, 0) == 0


def test_frag_sequence_orders_fragments_by_reading_order():
    a, b = { "he": None }, { "he": None }
    order, at = frag_sequence({ 0: (a, [1, 8, 1]), 1: (a, [1, 8, 1]),
                                2: (b, [1, 9, 1]) })
    assert [ frag for frag, _ in order ] == [a, b]
    assert at == { 0: 0, 1: 0, 2: 1 }


def test_en_prefixes_grow_with_each_word():
    prefixes = en_prefixes(["and", "let", "it", "separate"])
    assert prefixes[0] == 0
    assert prefixes == sorted(prefixes)
    assert len(prefixes) == 5
    # Hebrew has no glyphs in Garamond; it must still be measured, not skipped.
    assert en_prefixes(["יהוה"])[1] > 0
