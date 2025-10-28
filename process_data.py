import csv
from difflib import SequenceMatcher
from fontTools.ttLib import TTFont
import json
from NoIndentEncoder import NoIndent, NoIndentEncoder
from pathlib import Path
import re
import requests
import unicodedata

src_p = Path('./tikkun.io/src/data')
bsb_p = Path('./berean.bible/bsb_tables.tsv')
dst_p = Path('./src/data')

shlomo = TTFont('./tikkun.io/assets/fonts/Shlomosemistam.ttf')
garamondItalic = TTFont('./assets/fonts/AGaramondPro-Italic.otf')
garamond = TTFont('./assets/fonts/AGaramondPro-Regular.otf')

pages_data = { 'torah': [], 'esther': [] }
lookup_data = { 'torah': {}, 'esther': {} }
bsb_data = { 'torah': [], 'esther': [] }


def is_hyphen(c):
    return unicodedata.category(c) == 'Pd'

def width_in_font(font, c):
    glyph_name = font.getBestCmap()[ord(c)]
    return font['hmtx'][glyph_name][0]

def ktiv(s):
    s = s.replace(r'־', ' ')
    s = re.sub(r'#\[[^]]*\]', '', s)
    s = re.sub(r'[^א-ת\\s׆]', '', s)
    s = re.sub(r'\s{2,}', ' ', s)
    return s


last_seen_verse = {}
def tikkun_io_by_line(scroll, page, line_num, line):
    global last_seen_verse
    width = [0]
    ends_with_sof_pasuk = False
    num_sof_pasuk = 0

    columns = []
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

            fragments[i] = []
            for j in range(0, len(verse_fragments)):
                if j > 0:
                    width.append(0)
                width[-1] += sum( width_in_font(shlomo, c) for c in ktiv(verse_fragments[j]) )

                words_with_seps = re.split(r'([^\s׀־׆#]+(?:#\[[^]]*\][^\sא-ת׀־׆#]*)?)', verse_fragments[j])
                words = [ words_with_seps[i-1] + words_with_seps[i] for i in range(1, len(words_with_seps), 2) ]
                if len(words_with_seps) > 1:
                    words[-1] += words_with_seps[-1]

                fragments[i].append({ "he": NoIndent(words), "en": [] })

            if ends_with_sof_pasuk:
                width.append(0)


        columns.append(fragments)
    line["text"] = columns

    for i in range(0, len(line["verses"])):
        line["verses"][i]['start'] = True

    num_verses = num_sof_pasuk + (0 if ends_with_sof_pasuk else 1)

    if len(line["verses"]) < num_verses:
        line["verses"].insert(0, last_seen_verse)

    if len(line["verses"]) > 0:
        last_seen_verse = { **line["verses"][-1], 'start': False }

    for i in range(0, len(line["verses"])):
        v = line["verses"][i]
        v["width"] = width[i]
        if v["book"] not in lookup_data[scroll]:
            lookup_data[scroll][v["book"]] = {}
        if v["chapter"] not in lookup_data[scroll][v["book"]]:
            lookup_data[scroll][v["book"]][v["chapter"]] = {}
        if v["verse"] not in lookup_data[scroll][v["book"]][v["chapter"]]:
            lookup_data[scroll][v["book"]][v["chapter"]][v["verse"]] = []
        ref = { "page": page, "line": line_num+1, "index": i+1 }
        lookup_data[scroll][v["book"]][v["chapter"]][v["verse"]].append(ref)

    verse_index = 0
    for col in range(0, len(line["text"])):
        fragments = line["text"][col]
        for i in range(0, len(fragments)):
            for j in range(0, len(fragments[i])):
                if j == len(fragments[i])-1 and len(fragments[i][j]["he"].value) == 0:
                    fragments[i].pop()
                    break
                fragments[i][j]["verseIndex"] = verse_index
                if j < len(fragments[i]) - 1 and verse_index < len(line["verses"])-1:
                    verse_index += 1

    del line["aliyot"]

def tikkun_io_by_verse(scroll, book, chapter, verse, refs):
    total_width = 0
    for ref in refs:
        line = pages_data[scroll][ref["page"]-1][ref["line"]-1]
        total_width += line["verses"][ref["index"]-1]["width"]
    for ref in refs:
        line = pages_data[scroll][ref["page"]-1][ref["line"]-1]
        line["verses"][ref["index"]-1]["width"] /= total_width

last_seen_book = ''
def bsb_by_word(entry_obj):
    global last_seen_book

    he = entry_obj['WLC / Nestle Base TR RP WH NE NA SBL']
    if entry_obj['Language'] != 'Hebrew' or len(he) == 0:
        return

    if len(entry_obj['VerseId']) > 0:
        last_seen_book = entry_obj['VerseId'].split(' ')[0]
    scroll = None
    if last_seen_book in ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']:
        scroll = 'torah'
    elif last_seen_book == 'Esther':
        scroll = 'esther'
    else:
        return

    en = entry_obj[' BSB version '].strip().removeprefix('. . .')
    if en in ['-', 'vvv']: en = ''

    bsb_data[scroll].append({
        "heWord": entry_obj['Heb Sort'],
        "enWord": entry_obj['BSB Sort'],
        "he": he,
        "en": entry_obj['begQ'].strip() + en + \
              entry_obj['pnc'].strip() + \
              entry_obj['endQ'].strip() + \
              entry_obj['End text'].strip(),
        "hasContent": len(en) == 0,
    })

def bsb_by_hebrew_word(scroll, page, line_num, line):
    global bsb_data_index
    if page == 1 and line_num == 0:
        bsb_data_index = 0
    for col in range(0, len(line["text"])):
        fragments = line["text"][col]
        for i in range(0, len(fragments)):
            for j in range(0, len(fragments[i])):
                words = fragments[i][j]["he"].value
                if len(words) > 0 and len(words[-1]) == 0:
                    words.pop()
                for k, word in enumerate(words):
                    if word.endswith('פ') or word.endswith('ס'):
                        word = word[:-1]
                    bsb_word = bsb_data[scroll][bsb_data_index]["he"]
                    if bsb_word.endswith('פ') or bsb_word.endswith('ס'):
                        bsb_word = bsb_word[:-1]
                    if ktiv(word) != ktiv(bsb_word):
                        diff = SequenceMatcher(None, ktiv(word), ktiv(bsb_word))
                        changes = sum(max(i2 - i1, j2 - j1)
                                      for (tag,i1,i2,j1,j2) in diff.get_opcodes()
                                      if tag != 'equal')
                        # print(scroll, page, line_num, word, bsb_word, bsb_data[scroll][bsb_data_index]["heWord"], diff.ratio(), changes)
                        if changes > 2:
                            # print('-------')
                            bsb_data[scroll][bsb_data_index+1]["he"] = \
                                bsb_data[scroll][bsb_data_index]["he"] + \
                                bsb_data[scroll][bsb_data_index+1]["he"]
                            sep = ''
                            if len(bsb_data[scroll][bsb_data_index]["en"]) > 0 and \
                               not is_hyphen(bsb_data[scroll][bsb_data_index]["en"][-1]) and \
                               len(bsb_data[scroll][bsb_data_index+1]["en"]) > 0:
                                sep = ' '
                            bsb_data[scroll][bsb_data_index+1]["en"] = \
                                bsb_data[scroll][bsb_data_index]["en"] + sep + \
                                bsb_data[scroll][bsb_data_index+1]["en"]
                            bsb_data[scroll][bsb_data_index+1]["hasContent"] = \
                                bsb_data[scroll][bsb_data_index]["hasContent"] | \
                                bsb_data[scroll][bsb_data_index+1]["hasContent"]
                            bsb_data_index += 1
                    bsb_data[scroll][bsb_data_index]["tikkun"] = {
                        "page": page,
                        "line": line_num+1,
                        "word": k+1
                    }
                    del bsb_data[scroll][bsb_data_index]["heWord"]
                    bsb_data_index += 1

def bsb_by_english_word(scroll, page, line_num, line):
    global bsb_data_index
    if page == 1 and line_num == 0:
        bsb_data_index = 0
    for col in range(0, len(line["text"])):
        fragments = line["text"][col]
        for i in range(0, len(fragments)):
            for j in range(0, len(fragments[i])):
                for k in range(0, len(fragments[i][j]["he"].value)):
                    fragments[i][j]["en"].append(NoIndent({
                        "words": bsb_data[scroll][bsb_data_index]["en"],
                        "page": bsb_data[scroll][bsb_data_index]["tikkun"]["page"],
                        "line": bsb_data[scroll][bsb_data_index]["tikkun"]["line"],
                        "word": bsb_data[scroll][bsb_data_index]["tikkun"]["word"]
                    }))
                    bsb_data_index += 1

def repair_by_line(scroll, page, line_num, line):
    global bsb_data_index
    if page == 1 and line_num == 0:
        bsb_data_index = 0
    for col in range(0, len(line["text"])):
        fragments = line["text"][col]
        for i in range(0, len(fragments)):
            for j in range(0, len(fragments[i])):
                if not any( re.search('[0-9A-Za-z]', obj.value["words"]) for obj in fragments[i][j]["en"]):
                    print(scroll, page, line_num+1, [obj.value["words"] for obj in fragments[i][j]["en"]])





print("Processing tikkun.io data...")
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
    for book in lookup_data[scroll]:
        for chapter in lookup_data[scroll][book]:
            for verse in lookup_data[scroll][book][chapter]:
                tikkun_io_by_verse(scroll, int(book), int(chapter), int(verse), lookup_data[scroll][book][chapter][verse])

print("Processing Berean Standard Bible data...")
with bsb_p.open() as f:
    bsb_headers, got_header = [], False
    for entry in csv.reader(f, delimiter='\t'):
        if not got_header:
            bsb_headers = list(entry)
            # print(bsb_headers)
            got_header = True
            continue
        entry_obj = { bsb_headers[i]: entry[i] for i in range(0, len(entry)) }
        bsb_by_word(entry_obj)

print("Combining data...")
for scroll in pages_data:
    list.sort(bsb_data[scroll], key=lambda obj: float(obj['heWord']))
    for page, lines in enumerate(pages_data[scroll]):
        for line_num in range(0, len(lines)):
            bsb_by_hebrew_word(scroll, page+1, line_num, lines[line_num])
    bsb_data[scroll] = [ entry for entry in bsb_data[scroll] if "tikkun" in entry ]
    list.sort(bsb_data[scroll], key=lambda obj: float(obj['enWord']))
    for page, lines in enumerate(pages_data[scroll]):
        for line_num in range(0, len(lines)):
            bsb_by_english_word(scroll, page+1, line_num, lines[line_num])
    for page, lines in enumerate(pages_data[scroll]):
        for line_num in range(0, len(lines)):
            repair_by_line(scroll, page+1, line_num, lines[line_num])

print("Saving results...")
for scroll in pages_data:
    pages_p = Path('pages') / scroll
    (dst_p / pages_p).mkdir(parents=True, exist_ok=True)
    for i in range(0, len(pages_data[scroll])):
        with (dst_p / pages_p / f'{i+1}.json').open('w') as f:
            json.dump(pages_data[scroll][i], f, ensure_ascii=False, indent=2, cls=NoIndentEncoder)

    lookup_p = Path('lookup')
    (dst_p / lookup_p).mkdir(parents=True, exist_ok=True)
    with (dst_p / lookup_p / f'{scroll}.json').open('w') as f:
        json.dump(lookup_data[scroll], f, ensure_ascii=False, indent=2, cls=NoIndentEncoder)

    english_p = Path('english')
    (dst_p / english_p).mkdir(parents=True, exist_ok=True)
    with (dst_p / english_p/ f'{scroll}.json').open('w') as f:
        json.dump(bsb_data[scroll], f, ensure_ascii=False, indent=2, cls=NoIndentEncoder)


