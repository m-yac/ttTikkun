import argparse
from collections import Counter
import csv
from difflib import SequenceMatcher
from fontTools.ttLib import TTFont
import json
from lxml import etree
from . import aliyot
from .NoIndentEncoder import NoIndent, NoIndentEncoder
from .usfm import parse
from num2words import num2words
from pathlib import Path
import re
import requests
import unicodedata

top_level = Path(__file__).parent.parent

src_p = top_level / 'textSources' / 'tikkun.io' / 'src' / 'data'
uhb_p = top_level / 'textSources' / 'hbo_uhb'
# Where a run writes when nothing else is asked for; main() takes a path.
data_p = top_level / 'src' / 'data'
# Not the en_ult submodule itself: upstream's bible-editor exports keep landing
# alignment corruption in whichever book is under active work, so we read the
# newest revision of each book that parses -- built into the output directory
# alongside what a run writes. See combine/pull_clean_ult.py.
ult_p = top_level / 'textSources' / 'en_ult_clean'

heFont = TTFont(top_level / 'src' / 'fonts' / 'ShlomoStam' / 'ShlomoStam.ttf')
enFont = TTFont(top_level / 'src' / 'fonts' / 'amstelvar-v1' / 'Amstelvar-Roman[GRAD,XOPQ,XTRA,YOPQ,YTAS,YTDE,YTFI,YTLC,YTUC,wdth,wght,opsz].ttf')

ult_fnms = { "torah": ['01-GEN', '02-EXO', '03-LEV', '04-NUM', '05-DEU'], "esther": ['17-EST'] }

pages_data = { 'torah': [], 'esther': [] }
lookup_data = { 'torah': {}, 'esther': {} }
aliyah_data = { 'torah': {}, 'esther': {} }
uhb_data = { 'torah': [], 'esther': [] }
ult_data = { 'torah': [], 'esther': [] }

# Where each Hebrew word landed in the tikkun.io pages, as a
# [page, line, fragment, word] ref, and the fragment that holds it, keyed by the
# running verse counter and then by the word's index within that verse -- the
# index ult_by_book resolves each alignment down to. ult_word_frags holds
# (fragment, [page, line, fragment]) so ult_by_verse can tell whether a ref
# points into the fragment it is writing to.
ult_word_refs = { 'torah': {}, 'esther': {} }
ult_word_frags = { 'torah': {}, 'esther': {} }


def width_in_font(font, c):
    glyph_name = font.getBestCmap()[ord(c)]
    return font['hmtx'][glyph_name][0]

cmaps = {}
def text_width(font, s, fallback=None):
    """Width of `s` in em units, so widths from different fonts are comparable.

    Characters the font has no glyph for are measured in `fallback` -- Garamond
    carries no Hebrew, and ult_by_book writes יהוה into the English.
    """
    if id(font) not in cmaps:
        cmaps[id(font)] = font.getBestCmap()
    cmap, upem, width = cmaps[id(font)], font['head'].unitsPerEm, 0
    for c in s:
        if ord(c) in cmap:
            width += font['hmtx'][cmap[ord(c)]][0] / upem
        elif fallback is not None:
            width += text_width(fallback, c)
    return width

def en_prefixes(words):
    """Width of the first k of `words`, set with spaces between them, for every
    k -- the width at each position the English could be broken at."""
    space = text_width(enFont, ' ')
    prefixes = [0]
    for k, word in enumerate(words):
        prefixes.append(prefixes[-1] + (space if k > 0 else 0) +
                        text_width(enFont, word, fallback=heFont))
    return prefixes

def break_at(prefixes, lo, hi, candidates, he_before, he_after):
    """Whichever of `candidates` splits the English spanning [lo, hi] closest to
    the proportions of the Hebrew width on either side of the break."""
    if he_before + he_after <= 0:
        return candidates[0]
    target = prefixes[lo] + (prefixes[hi] - prefixes[lo]) * \
             he_before / (he_before + he_after)
    return min(candidates, key=lambda k: abs(prefixes[k] - target))

def ktiv(s):
    s = s.replace(r'־', ' ')
    s = re.sub(r'#\[[^]]*\]', '', s)
    s = re.sub(r'[^א-ת\s׆]', '', s)
    s = re.sub(r'\s{2,}', ' ', s)
    return s


def verse_parts(line):
    """A line's verse parts in reading order, each with its index within the
    line -- the `fragment` of a [page, line, fragment, word] ref."""
    n = 0
    for column in line["text"]:
        for fragment in column:
            for part in fragment:
                yield n, part
                n += 1


last_seen_verse, words_seen = {}, 0
def tikkun_io_by_line(scroll, page, line_num, line):
    global last_seen_verse
    global words_seen
    ends_with_sof_pasuk = False
    num_sof_pasuk = 0

    # The line's sentences in reading order, each with whether a sof pasuk falls
    # before it. Which of those actually end a verse isn't known until the line's
    # verses are, so they are indexed in a second pass below.
    sentences, after_sof_pasuk, columns = [], False, []
    for col in range(0, len(line["text"])):
        fragments = line["text"][col]
        for i in range(0, len(fragments)):

            verse_fragments = []
            spl = re.split(r'(׃(?:\s*#\('+'׆'+r'\))?)', fragments[i])
            for j in range(0, len(spl)):
                if j % 2 == 1:
                    continue
                v = spl[j] + (spl[j+1] if j < len(spl)-1 else '')
                verse_fragments.append(v.replace('#(פ)', '')
                                        .replace('(׆)#', '׆ ')
                                        .replace('#(׆)', ' ׆'))

            num_sof_pasuk += len(verse_fragments) - 1

            ends_with_sof_pasuk = len(verse_fragments) > 0 and \
                                  len(verse_fragments[-1]) == 0
            if ends_with_sof_pasuk:
                verse_fragments.pop()

            parts = []
            for j in range(0, len(verse_fragments)):
                words_with_seps = re.split(r'([^\s׀־׆#]+(?:#\[[^]]*\][^\sא-ת׀־׆#]*)?־?)', verse_fragments[j])
                words = [ words_with_seps[i-1] + words_with_seps[i] for i in range(1, len(words_with_seps), 2) ]
                if len(words_with_seps) > 1:
                    words[-1] += words_with_seps[-1]

                parts.append({ "he": NoIndent(words), "en": NoIndent([]) })
                sentences.append((parts[-1], after_sof_pasuk or j > 0))
                after_sof_pasuk = False

            fragments[i] = parts

            if ends_with_sof_pasuk:
                after_sof_pasuk = True

        columns.append(fragments)
    line["text"] = columns

    for i in range(0, len(line["verses"])):
        line["verses"][i]['indexOfFirstWord'] = 0

    num_verses = num_sof_pasuk + (0 if ends_with_sof_pasuk else 1)

    if len(line["verses"]) < num_verses:
        line["verses"].insert(0, last_seen_verse)

    # A verse usually ends at every sof pasuk, but not in the Decalogue: Hebrew
    # versification reads all four of the short commandments as a single verse
    # (Exodus 20:13, Deuteronomy 5:17), so those lines hold more sentences than
    # tikkun.io lists verses for them. Sentences past the line's last verse
    # continue it rather than starting one the line doesn't have.
    verse_index = 0
    for sentence, starts_sentence in sentences:
        if starts_sentence and verse_index < len(line["verses"]) - 1:
            verse_index += 1
            words_seen = 0
        sentence["verseIndex"] = verse_index
        words_seen += len(sentence["he"].value)
    if after_sof_pasuk:
        words_seen = 0

    if len(line["verses"]) > 0:
        last_seen_verse = { **line["verses"][-1],
                            'indexOfFirstWord': words_seen }

    for i in range(0, len(line["verses"])):
        v = line["verses"][i]
        if v["book"] not in lookup_data[scroll]:
            lookup_data[scroll][v["book"]] = {}
        if v["chapter"] not in lookup_data[scroll][v["book"]]:
            lookup_data[scroll][v["book"]][v["chapter"]] = {}
        if v["verse"] not in lookup_data[scroll][v["book"]][v["chapter"]]:
            lookup_data[scroll][v["book"]][v["chapter"]][v["verse"]] = NoIndent([])
        ref = [page, line_num, i]
        lookup_data[scroll][v["book"]][v["chapter"]][v["verse"]].value.append(ref)

    del line["aliyot"]

# def tikkun_io_by_verse(scroll, book, chapter, verse, refs):
#     total_width = 0
#     # for ref in refs:
#     #     line = pages_data[scroll][ref["page"]-1][ref["line"]-1]
#     #     total_width += line["verses"][ref["index"]-1]["width"]
#     # for ref in refs:
#     #     line = pages_data[scroll][ref["page"]-1][ref["line"]-1]
#     #     line["verses"][ref["index"]-1]["width"] /= total_width

def uhb_by_book(scroll, book, s):
    vws = re.findall(r'\\v [0-9]+|\\w ([^\\|]+)(?:|[^\\]*)?\\w\*', s)
    chapter, verse = 1, 1
    for word in vws:
        if len(word) == 0:
            uhb_data[scroll].append([])
        else:
            uhb_data[scroll][-1].append({ "uhb": word })

uhb_data_verse = 0
uhb_data_word = 0

def uhb_by_line(scroll, page, line_num, line):
    global uhb_data_verse
    global uhb_data_word
    if page == 1 and line_num == 0:
        uhb_data_verse, uhb_data_word = 0, 0
    
    last_seen_verse_index = 0
    word_index = line["verses"][0]["indexOfFirstWord"] if len(line["verses"]) > 0 else 0
    for frag_num, part in verse_parts(line):
        if last_seen_verse_index != part["verseIndex"]:
            last_seen_verse_index = part["verseIndex"]
            word_index = 0
        for word_in_frag, word in enumerate(part["he"].value):
            uhb_word = uhb_data[scroll][uhb_data_verse][uhb_data_word]["uhb"]
            ktiv_word = ktiv(word).strip()
            ktiv_uhb_word = ktiv(uhb_word).strip()

            if ktiv_word != ktiv_uhb_word:
                diff = SequenceMatcher(None, ktiv_word, ktiv_uhb_word)
                changes = sum(max(i2 - i1, j2 - j1)
                              for (tag,i1,i2,j1,j2) in diff.get_opcodes()
                              if tag != 'equal')
                # print(scroll, page, line_num, repr(word), repr(ktiv_word), repr(ktiv_uhb_word), repr(uhb_word), diff.ratio(), changes)
                if changes > 2:
                    # print('-------')
                    if ktiv_word not in ['צורישדי', 'פדהצור']:
                        print(scroll, page, line_num, repr(word), repr(ktiv_word), repr(ktiv_uhb_word), repr(uhb_word), diff.ratio(), changes)
                        raise Exception("Unexpected mismatch between UHB data and tikkun.io data")
                    uhb_data[scroll][uhb_data_verse][uhb_data_word]["ref"] = None
                    uhb_data_word += 1
                    if uhb_data_word >= len(uhb_data[scroll][uhb_data_verse]):
                        uhb_data_verse += 1
                        uhb_data_word = 0

            uhb_data[scroll][uhb_data_verse][uhb_data_word]["ref"] = word_index
            # Where this word sits, for ult_by_verse to point at. Keyed
            # by the verse the ref was just written into, so it stays in
            # step with what ult_by_book reads back out.
            ult_word_refs[scroll].setdefault(uhb_data_verse, {})[word_index] = \
                [page, line_num, frag_num, word_in_frag]
            ult_word_frags[scroll].setdefault(uhb_data_verse, {})[word_index] = \
                (part, [page, line_num, frag_num])
            uhb_data_word += 1
            if uhb_data_word >= len(uhb_data[scroll][uhb_data_verse]):
                uhb_data_verse += 1
                uhb_data_word = 0

            word_index += 1

def ult_by_book(scroll, book, s, uhb_s):
    global uhb_data_verse
    if book == 1:
        uhb_data_verse = 0

    verses = parse(s, uhb_s)

    for words in verses:
        for entry in words:
            spl = re.split(r'([0-9][0-9,]*)', entry["en"])
            entry["en"] = ''
            for i in range(0, len(spl)):
                if i % 2 == 0:
                    entry["en"] += spl[i]
                if i % 2 == 1:
                    entry["en"] += num2words(int(spl[i].replace(',', '')))
            entry["en"] = entry["en"].replace('Yahweh', 'יהוה')

            # parse resolved each alignment to an index into the verse's UHB
            # words; uhb_by_line left the tikkun.io ref on each of those.
            uhb_verse = uhb_data[scroll][uhb_data_verse]
            entry["he"] = [ uhb_verse[i]["ref"] for i in entry["he"]
                            if uhb_verse[i]["ref"] is not None ]

        uhb_data_verse += 1

    ult_data[scroll].extend([ [NoIndent(entry) for entry in words]
                              for words in verses ])

def array_like(items):
    """A list as an object keyed by index, which reads far better than a bare
    array once the values are as big as a line is: what would be an anonymous
    `{` in a page of them is `"23": {` instead."""
    return { "length": len(items), **{ str(i): item
                                       for i, item in enumerate(items) } }

def num_lines(pages):
    """How many lines a page of this scroll normally has, and which pages have
    some other number."""
    counts = [ len(lines) for lines in pages ]
    standard = Counter(counts).most_common(1)[0][0]
    return standard, { str(i): n for i, n in enumerate(counts, 1)
                       if n != standard }

def frag_sequence(frags):
    """The fragments a verse's Hebrew lands in, in reading order, and which of
    them each of the verse's words belongs to."""
    order, at = [], {}
    for i in sorted(frags):
        if len(order) == 0 or order[-1][1] != frags[i][1]:
            order.append(frags[i])
        at[i] = len(order) - 1
    return order, at

def verse_breaks(entries, at, num_frags, he_widths, prefixes, starts):
    """Where to break a verse's English, once per boundary between the fragments
    its Hebrew lands in.

    Everything before a break is written to the fragment on its near side, so the
    breaks are what keep the English in order: they only ever move forwards, and
    each fragment ends up with one run of it.

    Where the alignments either side of a boundary don't overlap, the break goes
    between them and nothing is broken at all. They overlap when the English
    doubles back over the boundary -- ULT word order is its own, and Esther 9:1
    reaches back over a line break for "in month 12" -- and then every alignment
    from the first that reaches across to the last is contested, and the break
    falls within that run, wherever the Hebrew's own width says.

    Within the run the break goes between two alignments if it can, which leaves
    each of them whole. Only a run of one -- an alignment straddling the boundary
    by itself, with no seam to use -- is broken through, and only if it has the
    words to spare: a single word can't be, and just goes to the wider side.
    """
    breaks = []
    for b in range(0, num_frags - 1):
        # Alignments reaching back to this boundary's near side, and forward to
        # its far side. Ones doing both straddle it.
        near = [ j for j, e in enumerate(entries) if any(at[i] <= b for i in e["he"]) ]
        far  = [ j for j, e in enumerate(entries) if any(at[i] >  b for i in e["he"]) ]

        if len(far) == 0:
            p = starts[-1]
        elif len(near) == 0 or far[0] > near[-1]:
            # Nothing contested. An alignment to no Hebrew at all has no side of
            # its own, so it rides along with the one before it.
            p = starts[near[-1]+1] if len(near) > 0 else 0
        else:
            lo, hi = starts[far[0]], starts[near[-1]+1]
            he = { i: he_widths[i]
                   for j in range(far[0], near[-1]+1) for i in entries[j]["he"] }
            seams = [ starts[j] for j in range(far[0]+1, near[-1]+1)
                      if lo <= starts[j] <= hi ]
            p = break_at(prefixes, lo, hi,
                         seams or list(range(lo+1, hi)) or [lo, hi],
                         sum(w for i, w in he.items() if at[i] <= b),
                         sum(w for i, w in he.items() if at[i] >  b))

        breaks.append(max(p, breaks[-1] if len(breaks) > 0 else 0))
    return breaks

def ult_by_verse(scroll, verse_index):
    """Write a verse's translation into the fragments its Hebrew lands in.

    ult_data, uhb_data and ult_word_refs are all indexed by the same running
    verse counter, so the verse needs no book/chapter/verse key of its own.
    """
    refs = ult_word_refs[scroll].get(verse_index, {})
    frags = ult_word_frags[scroll].get(verse_index, {})
    entries = [ entry.value for entry in ult_data[scroll][verse_index] ]

    for entry in entries:
        for i in entry["he"]:
            if i not in refs:
                raise Exception(f"{entry['c']}:{entry['v']} aligns to word "
                                f"{i+1}, which the tikkun.io verse lacks")
    if len(frags) == 0:
        return

    order, at = frag_sequence(frags)

    # The verse's English as one run of words, and where each alignment's own
    # words sit in it -- what the breaks are measured and cut against.
    words = [ entry["en"].split() for entry in entries ]
    starts = [0]
    for w in words:
        starts.append(starts[-1] + len(w))
    prefixes = en_prefixes([ word for w in words for word in w ])

    he_widths = { i: text_width(heFont, ktiv(frags[i][0]["he"].value[refs[i][3]]))
                  for i in refs }
    bounds = [0] + verse_breaks(entries, at, len(order), he_widths,
                                prefixes, starts) + [starts[-1]]

    for j, entry in enumerate(entries):
        # The fragments this alignment's own words fall between. Usually one, and
        # then nothing of it is broken; more than one only where a break landed
        # inside it. An alignment to no Hebrew has no words to place, so it rides
        # along in whichever fragment its position falls in.
        pieces = [ (f, ' '.join(words[j][max(starts[j], bounds[f]) - starts[j]:
                                        min(starts[j+1], bounds[f+1]) - starts[j]]))
                   for f in range(0, len(order))
                   if min(starts[j+1], bounds[f+1]) > max(starts[j], bounds[f])
                   or (len(words[j]) == 0 and bounds[f] <= starts[j] < bounds[f+1]) ]
        if len(pieces) == 0:
            pieces = [ (len(order)-1, entry["en"]) ]

        for p, (f, text) in enumerate(pieces):
            if len(pieces) == 1:
                # A word in the fragment being written to is just its number;
                # anything elsewhere carries its full [page, line, fragment,
                # word] ref.
                he = [ refs[i][3] if at[i] == f else refs[i] for i in entry["he"] ]
            else:
                # An empty ref stands in for the neighbouring piece: one leading
                # means this continues the fragment before, one trailing means it
                # continues into the fragment after. Words of a broken alignment
                # that no piece of it reached stay with its first piece.
                he = [ refs[i][3] for i in entry["he"] if at[i] == f ] + \
                     ([ refs[i] for i in entry["he"]
                        if at[i] not in [ g for g, _ in pieces ] ] if p == 0 else [])
                he = ([[]] if p > 0 else []) + he + \
                     ([[]] if p < len(pieces)-1 else [])
            # A footnote hangs off the end of what it annotates, so a broken
            # alignment carries its notes on its last piece. Only a piece that
            # has any writes a third element at all.
            notes = entry["footnotes"] if p == len(pieces)-1 else []
            order[f][0]["en"].value.append([text, he] + ([notes] if notes else []))



def combine_by_verse(scroll, book, chapter, verse):
    tikkun_io_words = lookup_data[scroll][book][chapter][verse]["ktiv"].value
    # for entry in ult_data[scroll][int(book)-1][int(chapter)-1][int(verse)-1]:
    #     for ult_word, occ, occs in entry.value["he"]:
    #         print(';;;;;;;;;;')
    #         norm_ult_word = ult_word.replace('\u2060', '')
    #         norm_tikkun_io_words = []
    #         tikkun_io_occs = 0
    #         for tikkun_io_word in tikkun_io_words:
    #             norm_tikkun_io_word = tikkun_io_word.replace('׃', '') \
    #                                                 .replace('־', '') \
    #                                                 .replace('׀', '') \
    #                                                 .strip()
    #             norm_tikkun_io_words.append(norm_tikkun_io_word)
    #             diff = SequenceMatcher(None, norm_ult_word, norm_tikkun_io_word)
    #             changes = sum(max(i2 - i1, j2 - j1)
    #                           for (tag,i1,i2,j1,j2) in diff.get_opcodes()
    #                           if tag != 'equal')
    #             print(norm_tikkun_io_word, changes, diff.get_opcodes())
    #             if changes <= 1:
    #                 tikkun_io_occs += 1
    #         if tikkun_io_occs != occs:
    #             print(norm_tikkun_io_words, tikkun_io_occs)
    #             print(scroll, book, chapter, verse, norm_ult_word, occs)
    #             print(len([tikkun_io_word for tikkun_io_word in tikkun_io_words \
    #                                if tikkun_io_word == ult_word]), occs)
    #             exit()
    
    # if len(words) != len(set(words)):
    # print(scroll, book, chapter, verse, words)
    # exit()

    # ktiv_tikkun_io = ' '.join(lookup_data[scroll][book][chapter][verse]["ktiv"].value).replace('  ', ' ')
    # ult_words = ult_data[scroll][int(book)-1][int(chapter)-1][int(verse)-1]
    # ktiv_ult = ktiv(" ".join(" ".join(word.value["he"]) for word in ult_words))
    # diff = SequenceMatcher(None, ktiv_tikkun_io, ktiv_ult)
    # if diff.ratio() < 1.0:
    #     print(ktiv_tikkun_io)
    #     print(ktiv_ult)
    #     print(diff.get_opcodes())
    #     exit()

ult_idxs = None
def combine_by_word(scroll, page, line_num, line):
    global ult_idxs
    if ult_idxs is None:
        ult_idxs = { scroll: [ [ [ 0 for _ in verses ] \
                                     for verses in chapters ] \
                                     for chapters in books ] \
                                     for scroll, books in ult_data.items() }
    for _, part in verse_parts(line):
        words = part["he"].value
        verse_index = part["verseIndex"]
        b = line["verses"][verse_index]["book"]-1
        c = line["verses"][verse_index]["chapter"]-1
        v = line["verses"][verse_index]["verse"]-1
                # lookup = lookup_data[scroll][f'{b+1}'][f'{c+1}'][f'{v+1}']
                # for k, word in enumerate(words):
                    # diff = SequenceMatcher(None, k, ktiv(bsb_word))
                    # entry, offset, found_one = None, 0, False
                    # while not found_one:
                    #     idx = ult_idxs[scroll][b][c][v]+offset
                    #     if idx == len(ult_data[scroll][b][c][v]):
                    #         break
                    #     entry = ult_data[scroll][b][c][v][idx].value
                    #     if ktiv(word) == ktiv(entry['he'][0]):
                    #         found_one = True
                    #     else:
                    #         offset += 1
                    # ult_idxs[scroll][b][c][v] += offset + 1



# last_seen_book = ''
# def bsb_by_word(entry_obj):
#     global last_seen_book

#     he = entry_obj['WLC / Nestle Base TR RP WH NE NA SBL']
#     if entry_obj['Language'] != 'Hebrew' or len(he) == 0:
#         return

#     if len(entry_obj['VerseId']) > 0:
#         last_seen_book = entry_obj['VerseId'].split(' ')[0]
#     scroll = None
#     if last_seen_book in ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']:
#         scroll = 'torah'
#     elif last_seen_book == 'Esther':
#         scroll = 'esther'
#     else:
#         return

#     en = entry_obj[' BSB version '].strip().removeprefix('. . .')
#     if en in ['-', 'vvv']: en = ''

#     bsb_data[scroll].append({
#         "heWord": entry_obj['Heb Sort'],
#         "enWord": entry_obj['BSB Sort'],
#         "he": he,
#         "en": entry_obj['begQ'].strip() + en + \
#               entry_obj['pnc'].strip() + \
#               entry_obj['endQ'].strip() + \
#               entry_obj['End text'].strip(),
#         "hasContent": len(en) == 0,
#     })

# def bsb_by_hebrew_word(scroll, page, line_num, line):
#     global bsb_data_index
#     if page == 1 and line_num == 0:
#         bsb_data_index = 0
#     for col in range(0, len(line["text"])):
#         fragments = line["text"][col]
#         for i in range(0, len(fragments)):
#             for j in range(0, len(fragments[i])):
#                 words = fragments[i][j]["he"].value
#                 if len(words) > 0 and len(words[-1]) == 0:
#                     words.pop()
#                 for k, word in enumerate(words):
#                     if word.endswith('פ') or word.endswith('ס'):
#                         word = word[:-1]
#                     bsb_word = bsb_data[scroll][bsb_data_index]["he"]
#                     if bsb_word.endswith('פ') or bsb_word.endswith('ס'):
#                         bsb_word = bsb_word[:-1]
#                     if ktiv(word) != ktiv(bsb_word):
#                         diff = SequenceMatcher(None, ktiv(word), ktiv(bsb_word))
#                         changes = sum(max(i2 - i1, j2 - j1)
#                                       for (tag,i1,i2,j1,j2) in diff.get_opcodes()
#                                       if tag != 'equal')
#                         # print(scroll, page, line_num, word, bsb_word, bsb_data[scroll][bsb_data_index]["heWord"], diff.ratio(), changes)
#                         if changes > 2:
#                             # print('-------')
#                             bsb_data[scroll][bsb_data_index+1]["he"] = \
#                                 bsb_data[scroll][bsb_data_index]["he"] + \
#                                 bsb_data[scroll][bsb_data_index+1]["he"]
#                             sep = ''
#                             if len(bsb_data[scroll][bsb_data_index]["en"]) > 0 and \
#                                not is_hyphen(bsb_data[scroll][bsb_data_index]["en"][-1]) and \
#                                len(bsb_data[scroll][bsb_data_index+1]["en"]) > 0:
#                                 sep = ' '
#                             bsb_data[scroll][bsb_data_index+1]["en"] = \
#                                 bsb_data[scroll][bsb_data_index]["en"] + sep + \
#                                 bsb_data[scroll][bsb_data_index+1]["en"]
#                             bsb_data[scroll][bsb_data_index+1]["hasContent"] = \
#                                 bsb_data[scroll][bsb_data_index]["hasContent"] | \
#                                 bsb_data[scroll][bsb_data_index+1]["hasContent"]
#                             bsb_data_index += 1
#                     bsb_data[scroll][bsb_data_index]["tikkun"] = {
#                         "page": page,
#                         "line": line_num+1,
#                         "word": k+1
#                     }
#                     del bsb_data[scroll][bsb_data_index]["heWord"]
#                     bsb_data_index += 1

# def bsb_by_english_word(scroll, page, line_num, line):
#     global bsb_data_index
#     if page == 1 and line_num == 0:
#         bsb_data_index = 0
#     for col in range(0, len(line["text"])):
#         fragments = line["text"][col]
#         for i in range(0, len(fragments)):
#             for j in range(0, len(fragments[i])):
#                 for k in range(0, len(fragments[i][j]["he"].value)):
#                     fragments[i][j]["en"].append(NoIndent({
#                         "words": bsb_data[scroll][bsb_data_index]["en"],
#                         "page": bsb_data[scroll][bsb_data_index]["tikkun"]["page"],
#                         "line": bsb_data[scroll][bsb_data_index]["tikkun"]["line"],
#                         "word": bsb_data[scroll][bsb_data_index]["tikkun"]["word"]
#                     }))
#                     bsb_data_index += 1

# def repair_by_line(scroll, page, line_num, line):
#     global bsb_data_index
#     if page == 1 and line_num == 0:
#         bsb_data_index = 0
#     for col in range(0, len(line["text"])):
#         fragments = line["text"][col]
#         for i in range(0, len(fragments)):
#             for j in range(0, len(fragments[i])):
#                 if not any( re.search('[0-9A-Za-z]', obj.value["words"]) for obj in fragments[i][j]["en"]):
#                     print(scroll, page, line_num+1, [obj.value["words"] for obj in fragments[i][j]["en"]])


def main(dst=data_p):
    print("[tikkun.io] Restructuring...")
    for scroll in pages_data:
        book_p = Path('pages') / scroll
        page = 1
        while (src_p / book_p / f'{page}.json').exists():
            with (src_p / book_p / f'{page}.json').open() as f:
                lines = json.load(f)
                for line_num in range(0, len(lines)):
                    tikkun_io_by_line(scroll, page, line_num, lines[line_num])
                pages_data[scroll].append(lines)
            page += 1
        # for book in lookup_data[scroll]:
        #     for chapter in lookup_data[scroll][book]:
        #         for verse in lookup_data[scroll][book][chapter]:
        #             tikkun_io_by_verse(scroll, int(book), int(chapter), int(verse), lookup_data[scroll]    [book][chapter][verse])

    print("[hebcal] Building list of aliyot...")
    for scroll in pages_data:
        aliyah_data[scroll] = aliyot.lookups(scroll)

    print("[unfoldingWord Hebrew Bible] Extracting words...")
    for scroll in pages_data:
        for book, fnm in enumerate(ult_fnms[scroll]):
            with (uhb_p / f'{fnm}.usfm').open() as f:
                uhb_by_book(scroll, book+1, f.read())

    print("[unfoldingWord Hebrew Bible] Lining up words with tikkun.io data...")
    for scroll in pages_data:
        for page, lines in enumerate(pages_data[scroll]):
            for line_num in range(0, len(lines)):
                uhb_by_line(scroll, page+1, line_num, lines[line_num])

    print("[unfoldingWord Literal Text] Extracting translation...")
    for scroll in pages_data:
        for book, fnm in enumerate(ult_fnms[scroll]):
            with (ult_p / f'{fnm}.usfm').open() as f:
                with (uhb_p / f'{fnm}.usfm').open() as g:
                    ult_by_book(scroll, book+1, f.read(), g.read())

    print("[unfoldingWord Literal Text] Lining up translation with tikkun.io data...")
    for scroll in pages_data:
        for verse_index in range(0, len(ult_data[scroll])):
            ult_by_verse(scroll, verse_index)

    # with bsb_p.open() as f:
    #     bsb_headers, got_header = [], False
    #     for entry in csv.reader(f, delimiter='\t'):
    #         if not got_header:
    #             bsb_headers = list(entry)
    #             # print(bsb_headers)
    #             got_header = True
    #             continue
    #         entry_obj = { bsb_headers[i]: entry[i] for i in range(0, len(entry)) }
    #         bsb_by_word(entry_obj)
    
    # print("Combining data...")
    # for scroll in pages_data:
    #     for book in lookup_data[scroll]:
    #         for chapter in lookup_data[scroll][book]:
    #             for verse in lookup_data[scroll][book][chapter]:
    #                 combine_by_verse(scroll, book, chapter, verse)
    # for scroll in pages_data:
    #     for page, lines in enumerate(pages_data[scroll]):
    #         for line_num in range(0, len(lines)):
    #             combine_by_word(scroll, page+1, line_num, lines[line_num])
    # for scroll in pages_data:
    #     list.sort(bsb_data[scroll], key=lambda obj: float(obj['heWord']))
    #     for page, lines in enumerate(pages_data[scroll]):
    #         for line_num in range(0, len(lines)):
    #             bsb_by_hebrew_word(scroll, page+1, line_num, lines[line_num])
    #     bsb_data[scroll] = [ entry for entry in bsb_data[scroll] if "tikkun" in entry ]
    #     list.sort(bsb_data[scroll], key=lambda obj: float(obj['enWord']))
    #     for page, lines in enumerate(pages_data[scroll]):
    #         for line_num in range(0, len(lines)):
    #             bsb_by_english_word(scroll, page+1, line_num, lines[line_num])
    #     for page, lines in enumerate(pages_data[scroll]):
    #         for line_num in range(0, len(lines)):
    #             repair_by_line(scroll, page+1, line_num, lines[line_num])
    
    print(f"Saving results to {dst}...")
    for scroll in pages_data:
        pages_p = Path('pages') / scroll
        (dst / pages_p).mkdir(parents=True, exist_ok=True)
        for i in range(0, len(pages_data[scroll])):
            with (dst / pages_p / f'{i+1}.json').open('w') as f:
                json.dump(array_like(pages_data[scroll][i]), f,
                          ensure_ascii=False, indent=2, cls=NoIndentEncoder)

        books_p = Path('books')
        (dst / books_p).mkdir(parents=True, exist_ok=True)
        standard, variants = num_lines(pages_data[scroll])
        with (dst / books_p / f'{scroll}.json').open('w') as f:
            json.dump({ "pageCount": len(pages_data[scroll]),
                        "standardNumLines": standard,
                        "variantNumLines": variants,
                        "verseLookup": lookup_data[scroll],
                        **aliyah_data[scroll] },
                      f, ensure_ascii=False, indent=2, cls=NoIndentEncoder)


def cli():
    ap = argparse.ArgumentParser(
        description="Combine the tikkun.io pages with the unfoldingWord text.")
    ap.add_argument('output', type=Path, nargs='?', default=data_p,
                    help=f'directory to write (default: {data_p.name}/)')
    main(ap.parse_args().output)

if __name__ == "__main__":
    cli()
