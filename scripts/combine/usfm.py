"""Parse unfoldingWord Literal Text (ULT) alignments against the unfoldingWord
Hebrew Bible (UHB).

The ULT marks up its English with `\\zaln-s` milestones naming a Hebrew word by
(x-content, x-occurrence, x-occurrences) -- "the Nth of M occurrences of this
word in this verse". Resolving those against the UHB is the same work whether
you want the data or only want to know the file is sound, so `parse` does both:
it returns the aligned entries, and raises Problem the moment the ULT and the
UHB disagree. `main.py` reads books already known to parse, where a problem is a
real error; `pull_clean_ult.py` searches history for books that do.

Nothing here knows about tikkun.io. Alignments resolve to indices into the
verse's UHB word list and the caller maps those onto whatever it needs.
"""
import re
import unicodedata
from functools import reduce

# Problem kinds
OCCURRENCE_OUT_OF_BOUNDS = 'occurrence-out-of-bounds'
CONTENT_NOT_IN_VERSE = 'content-not-in-verse'
OCCURRENCES_MISMATCH = 'occurrences-mismatch'
UNHANDLED_MARKER = 'unhandled-marker'

# Headings and labels: the marker and its text are both dropped.
# \ms1 "Book One", \cl "Psalm", \qa the acrostic headings of Ps 119, alongside
# the \s#/\sr/\r the Torah already used. \ms# must precede the bare markers
# below, which would otherwise match its leading \m and leave "s1 Book One".
strip_headings = r'\\(ms[0-9]*|s[0-9]*|sr|r|cl|qa)[^\\\n]*'

# Markers around text we keep. \d is a psalm superscription and \qs wraps an
# aligned "Selah", so unlike the headings above their content is translation.
# \qs must precede q[0-9]*, which would otherwise match just its \q. \ts is
# usually self-closing but 1 Chronicles has one bare instance.
drop_markers = r'(\\ts\\?\*?|\\(qs\*?|q[0-9]*|p[a-z]*|m|b|nb|d))'

footnote = r'\\f [\+\-\?] ?(.*?)\\f\*'

left_delims = '([{‘“'


def is_hyphen(c):
    return unicodedata.category(c) == 'Pd'


def add_with_ws(s1, s2):
    if len(s1) == 0 or len(s2) == 0:
        return s1 + s2
    is_comma_sep_number = len(s1) >= 2 and \
        s1[-2].isdigit() and s1[-1] == ',' and s2[0].isdigit()
    if re.match(r'[a-zA-Z0-9'+left_delims+r']', s2[0]) and \
       not is_hyphen(s1[-1]) and not is_comma_sep_number:
        return s1 + ' ' + s2
    return s1 + s2


def reformat_with_ws(s):
    return reduce(add_with_ws, s.split(), '')


def normalize(word):
    """The ULT and UHB spell identical words with their combining marks in
    different orders; NFD puts them in canonical order so they compare equal."""
    return unicodedata.normalize('NFD', word)


class Problem(Exception):
    """Raised on the first disagreement between the ULT and the UHB.

    Parsing stops there rather than collecting: callers either have a file they
    already know is clean (and a problem is a real error), or are searching
    history for one and only need to know that this revision is not it.
    """
    def __init__(self, kind, c, v, content, detail):
        self.kind, self.c, self.v = kind, c, v
        self.content, self.detail = content, detail
        super().__init__(str(self))

    def __str__(self):
        return f'{self.c}:{self.v} {self.kind}: {self.detail}'


def parse_uhb(s):
    """UHB words per verse, as {(chapter, verse): [word, ...]}.

    Verse 0 holds a chapter's `\\d` superscription, which carries an alternate
    verse number via `\\va` rather than a `\\v` of its own. Some psalms (Ps 90
    among them) have no separate superscription and fold those words into verse
    1 instead; `parse` falls back accordingly.
    """
    verses = {}
    for chapter_part in re.split(r'\\c ', s)[1:]:
        c = int(chapter_part.split(None, 1)[0])
        parts = re.split(r'\\v ', chapter_part)
        verses[(c, 0)] = re.findall(r'\\w ([^\\|]+)', parts[0])
        for verse_part in parts[1:]:
            v = int(verse_part.split(None, 1)[0])
            verses[(c, v)] = re.findall(r'\\w ([^\\|]+)', verse_part)
    return verses


def resolve(entry, uhb_words):
    """Turn an entry's (x-content, occurrence, occurrences) triples into indices
    into `uhb_words`. Raises Problem at the first disagreement."""
    new_he = []
    c, v = entry["c"], entry["v"]
    for uhb_word, occ, occs in entry["he"]:
        if occ > occs:
            raise Problem(OCCURRENCE_OUT_OF_BOUNDS, c, v, uhb_word,
                f'{uhb_word!r} is occurrence {occ} of only {occs}')

        uhb_occs = [i for i, w in enumerate(uhb_words)
                    if normalize(w) == normalize(uhb_word)]

        if len(uhb_occs) == 0:
            raise Problem(CONTENT_NOT_IN_VERSE, c, v, uhb_word,
                f'{uhb_word!r} is not a word of this verse')
        if occs != len(uhb_occs):
            raise Problem(OCCURRENCES_MISMATCH, c, v, uhb_word,
                f'{uhb_word!r} claims {occs} occurrence(s), '
                f'the Hebrew has {len(uhb_occs)}')

        new_he.append(uhb_occs[occ-1])
    return new_he


def parse(ult_text, uhb_text):
    """Parse a ULT book against its UHB counterpart.

    Returns a list of per-verse lists of entries {"en", "he", "footnotes", "c",
    "v"}. Each entry's "he" is a list of indices into that verse's UHB word list
    (see `parse_uhb`). Raises Problem at the first disagreement with the Hebrew.
    """
    uhb = parse_uhb(uhb_text)
    s = ult_text

    s = re.sub(r'\\w ([^\\|]*)(?:|[^\\]*)?\\w\*', r'\1', s)
    s = re.sub(r'\\zaln-s[^\\]*x-occurrence="([0-9]+)" x-occurrences="([0-9]+)" x-content="([^"]+)"[^\\]*\\\*',
               r'<zaln data="\1,\2,\3">', s)
    s = re.sub(r'\\zaln-e[^\\]*\\\*', '</zaln>', s)
    spl3 = re.split(r'((?:<zaln data="[^"]+">)+)([^<]*)(?:</zaln>)+', s)

    spl2 = []
    pending_footnotes = []
    to_add_to_next = { "c": 0, "v": 0 }
    for i in range(0, len(spl3)):
        if i % 3 == 0:
            sep = re.sub(strip_headings, '', spl3[i])
            sep = re.sub(drop_markers, '', sep)
            # One separator can carry several footnotes -- the unaligned
            # passages in Micah and Malachi carry two -- so take them all, and
            # match each lazily so a pair on one line stays two notes.
            for ft in re.findall(footnote, sep):
                ft = re.sub(r'\\([a-z0-9+]+)\s*([^\\\n]*)\s*\\([a-z0-9+]+)\*', r'<\1>\2</\3>', ft)
                ft = re.sub(r'\\([a-z0-9+]+)\s*([^\\\n]*)\s*', r'<\1>\2</\1>', ft)
                # A footnote ahead of the book's first alignment has nothing to
                # hang on yet, so hold it for the entry that follows.
                (spl2[-1]["footnotes"] if spl2 else pending_footnotes).append(ft)
            sep = re.sub(footnote, '', sep)
            res = re.split(r'\\([cv]) ([0-9]+)\s*', sep)
            new_sep = ''
            for j in range(0, len(res)):
                if j % 3 == 0:
                    new_sep += res[j]
                if j % 3 == 2:
                    to_add_to_next[res[j-1]] = int(res[j])
                    if res[j-1] == 'c':
                        # A \d superscription sits before \v 1 and would
                        # otherwise inherit the previous chapter's last verse.
                        to_add_to_next['v'] = 0
            if i > 0:
                if '\\' in new_sep:
                    # A bare backslash need not name a marker (a stray \* from
                    # a malformed milestone, say), so fall back to the text.
                    marker = re.search(r'\\[a-zA-Z0-9+-]*', new_sep)
                    raise Problem(UNHANDLED_MARKER,
                        to_add_to_next["c"], to_add_to_next["v"],
                        marker.group(0) if marker else new_sep.strip(),
                        f'unhandled tag in: {new_sep.strip()!r}')
                spl2.append(new_sep)
        if i % 3 == 2:
            refs = re.findall(r'<zaln data="([^"]+)">', spl3[i-1])
            for j in range(0, len(refs)):
                occ, occs, w = refs[j].split(',')
                refs[j] = [w, int(occ), int(occs)]
            body = reformat_with_ws(spl3[i])
            spl2.append({ "en": body, "he": refs, "footnotes": pending_footnotes,
                          **to_add_to_next })
            pending_footnotes = []

    verses = [[]]
    to_add_to_next = ''
    last_seen_chapter, last_seen_verse = 1, 1
    for i in range(0, len(spl2)):
        last_entry = verses[-1][-1] if len(verses[-1]) > 0 else {}
        if i % 2 == 0:
            entry = spl2[i]
            entry['en'] = to_add_to_next + entry['en']
            to_add_to_next = ''
            if entry["c"] != last_seen_chapter:
                verses.append([])
                last_seen_chapter = entry["c"]
                last_seen_verse = entry["v"]
            elif entry["v"] != last_seen_verse:
                verses.append([])
                last_seen_verse = entry["v"]
            if len(verses[-1]) > 0:
                if len(entry["he"]) == len(last_entry["he"]) and \
                   all( entry["he"][i] == last_entry["he"][i] for i in range(0, len(entry["he"])) ):
                    last_entry["en"] = add_with_ws(last_entry["en"], entry["en"])
                    last_entry["footnotes"].extend(entry["footnotes"])
                    continue
            verses[-1].append(entry)
        else:
            spl_by_left_delim = re.split(r'(['+left_delims+r'])', spl2[i])
            last_entry["en"] = add_with_ws(last_entry["en"], reformat_with_ws(spl_by_left_delim[0]))
            for s in spl_by_left_delim[1:]:
                to_add_to_next += s

    for words in verses:
        if len(words) == 0:
            continue
        c, v = words[0]["c"], words[0]["v"]
        uhb_words = uhb.get((c, v), [])
        if v == 0 and len(uhb_words) == 0:
            # No separate superscription in the UHB: it folded those words into
            # verse 1 (e.g. Psalm 90).
            uhb_words = uhb.get((c, 1), [])
        for entry in words:
            entry["he"] = resolve(entry, uhb_words)

    return verses


def main():
    import sys
    if len(sys.argv) != 3:
        sys.exit('usage: python -m combine.usfm <ult.usfm> <uhb.usfm>')
    try:
        verses = parse(open(sys.argv[1]).read(), open(sys.argv[2]).read())
    except Problem as problem:
        print(problem)
        return 1
    n = sum(len(w) for w in verses)
    print(f'{len(verses)} verses, {n} entries, no problems')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
