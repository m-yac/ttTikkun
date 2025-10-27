from fontTools.ttLib import TTFont
import json
from pathlib import Path
import re
import requests

def split_by(xs, f):
    ys = [[]]
    for i in range(0, len(xs)):
        ys[-1].append(xs[i])
        if i < len(xs)-1 and f(xs[i]):
            ys.append([])
    return ys

src_p = Path('./tikkun.io/src/data')
dst_p = Path('./src/data')

pages_data = { 'torah': [], 'esther': [] }
lookup_data = { 'torah': {}, 'esther': {} }

last_seen_verse = {}


shlomo = TTFont('./tikkun.io/assets/fonts/Shlomosemistam.ttf')
garamondItalic = TTFont('./assets/fonts/AGaramondPro-Italic.otf')
garamond = TTFont('./assets/fonts/AGaramondPro-Regular.otf')

def width_in_font(font, c):
    glyph_name = font.getBestCmap()[ord(c)]
    return font['hmtx'][glyph_name][0]


translations = { "torah": [], "esther": [] }

hyphens = r'\-\‐\‑\‒\–\—\―'

def html_re(body):
    return r'<br>|<[^>]+>{}<\/[^>]+>'.format(body,body)

sefaria_html_re = html_re(r'(?:[^<]+|{})*'.format(html_re(r'[^<]*')))
sefaria_split_re = r'((?:[^<\s{}]+|{})+[\s{}]*)'\
                   .format(hyphens, sefaria_html_re, hyphens)

def split_sefaria(line):
    line = re.sub(r'(<br>)([^$\s])', r'\1 \2', line)
    words = re.findall(sefaria_split_re, line)
    total_len, ret = 0, []
    for w in words:
        repl_i = re.sub(r'<i>([^<]*)<\/?i>', r'#(\1)', w)
        repl_i_no_tags = re.sub(sefaria_html_re, '', repl_i)
        split_by_i = re.split(r'#\(([^<]*)\)', repl_i_no_tags)
        word_len = 0
        for i in range(0, len(split_by_i)):
            font = garamond if i % 2 == 0 else garamondItalic
            for c in split_by_i[i]:
                if c == 'י' or c == 'ו': c = 'l'
                if c == 'ה': c = 'H'
                if c == 'ḥ': c = 'h'
                word_len += width_in_font(font, c)
        total_len += word_len
        ret.append((word_len, w))
    return [ (l / total_len, w) for (l, w) in ret ]

def fetch_sefaria_data(scroll, book):
    url = f'https://www.sefaria.org/api/v3/texts/{book}?version=english'
    headers = {"accept": "application/json"}
    response = requests.get(url, headers).json()
    text = response["versions"][0]["text"]
    text = [ [ split_sefaria(v) for v in ch ] for ch in text ]
    translations[scroll].append(text)

print("Fetching data from Sefaria...")
fetch_sefaria_data('torah', 'Genesis'),
fetch_sefaria_data('torah', 'Exodus'),
fetch_sefaria_data('torah', 'Leviticus'),
fetch_sefaria_data('torah', 'Numbers'),
fetch_sefaria_data('torah', 'Deuteronomy')
fetch_sefaria_data('esther', 'Esther')


def process_by_line(scroll, page, line_num, line):
    global last_seen_verse
    width = [0]
    ends_with_sof_pasuk = False
    num_sof_pasuk = 0

    for col in range(0, len(line["text"])):
        fragments = line["text"][col]
        for i in range(0, len(fragments)):

            fragments[i] = fragments[i] \
                .replace('#(פ)', '') \
                .replace('(׆)#', '׆ ') \
                .replace('#(׆)', ' ׆')

            no_sp_nun_haf = fragments[i].replace(' ', '').replace('׆', '')
            if len(no_sp_nun_haf) > 0:
                ends_with_sof_pasuk = no_sp_nun_haf.endswith('׃')
            
            verse_fragments = fragments[i].split('׃')
            for j in range(0, len(verse_fragments)):
                if j > 0:
                    width.append(0)
                ktiv = verse_fragments[j].replace(r'־', ' ')
                ktiv = re.sub(r'#\[[^]]*\]', ' ', ktiv)
                ktiv = re.sub(r'[^א-ת\\s׆]', '', ktiv)
                ktiv = re.sub(r'\s{2,}', ' ', ktiv)
                width[-1] += sum( width_in_font(shlomo, c) for c in ktiv )
                if j < len(verse_fragments) - 1:
                    verse_fragments[j] += '׃'

            num_sof_pasuk += len(verse_fragments) - 1

        line["text"][col] = ' {ס}'.join(line["text"][col])
    line["text"] = ' {ש} '.join(line["text"])

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

    del line["aliyot"]

    saved = { "isPetucha": None, "verses": None }
    for k in saved:
        saved[k] = line[k]
        del line[k]

    line["translation"] = ''

    for k in saved:
        line[k] = saved[k]

    parts = re.split(r'׃\s*({[סש]}|׆)?\s*', line["text"])
    split_parts = []
    for i in range(0, len(parts)):
        if i % 2 == 1:
            split_parts.append(parts[i])
        if i % 2 == 0:
            split_parts.append(re.split(r' ({[סש]}) ', parts[i]))
    all_parts = []
    for i in range(0, len(split_parts)):
        if i % 2 == 1:
            continue
        if i == len(split_parts)-1 and len(split_parts[i][0]) == 0:
            break
        if i // 2 >= len(line["verses"]):
            for j in range(i-1, len(split_parts)):
                if j % 2 == 1:
                    all_parts[i-2].append(split_parts[j])
                if j % 2 == 0:
                    all_parts[i-2].extend(split_parts[j])
            break
        if i > 0:
            all_parts.append(split_parts[i-1])
        all_parts.append(split_parts[i])
    line["parts"] = all_parts
    line["hasSpecialFormatting"] = \
        any(len(part) > 1 for i,part in enumerate(all_parts) if i % 2 == 0)

def process_by_verse(scroll, book, chapter, verse, refs):
    total_width = 0
    for ref in refs:
        line = pages_data[scroll][ref["page"]-1][ref["line"]-1]
        total_width += line["verses"][ref["index"]-1]["width"]
    for ref in refs:
        line = pages_data[scroll][ref["page"]-1][ref["line"]-1]
        line["verses"][ref["index"]-1]["width"] /= total_width

def add_translation(scroll, page, line_num, lines):
    line, next_line = lines[line_num], lines[min(line_num+1, len(lines)-1)]
    for i in range(0, len(line["parts"])):
        if i % 2 == 1:
            if line["parts"][i] is not None:
                if len(line["translation"]) > 0 and \
                   line["translation"][-1] != ' ':
                    line["translations"] += ' '
                line["translation"] += line["parts"][i].replace('ס', 's') \
                                               .replace('ש', 'S') + ' '
            continue
        if len(line["parts"][i]) == 0:
            continue

        v = line["verses"][i // 2]
        tr = translations[scroll][v["book"]-1][v["chapter"]-1][v["verse"]-1]
        total_width = 0

        if line["hasSpecialFormatting"]:
            tr_by_br        = split_by(tr, lambda lw: '<br>' in lw[1])
            tr_by_period    = split_by(tr, lambda lw: '.'    in lw[1])
            tr_by_semicolon = split_by(tr, lambda lw: ';'    in lw[1])
            tr_parts = tr_by_br if len(tr_by_br) > 1 else \
                       tr_by_period if len(tr_by_period) > 1 else \
                       tr_by_semicolon
            print("[-]", scroll, page, line_num, line["text"])
            # for j in range(0, len(line["parts"][i])-1):
            #     print(line["parts"], [ [ w for l,w in part ] for part in tr_parts])
            #     for k in range(0, len(tr_parts[j])):
            #         l, w = tr_parts[j][k]
            #         tr.pop(0)
            #         total_width += l
            #         line["translation"] += w
            line["translation"] += " {FIXME} "
        elif next_line["hasSpecialFormatting"]:
            print("[v]", scroll, page, line_num, line["text"])
        while len(tr) > 0:
            l, w = tr[0]
            if total_width + l > v["width"]:
                if total_width > v['width'] or \
                   total_width + l / 2 > v['width']:
                    break
            tr.pop(0)
            total_width += l
            line["translation"] += w
            if len(tr) == 0 and w[-1] not in hyphens:
                line["translation"] += ' '


print("Processing tikkun.io data...")
for scroll in pages_data:
    book_p = Path('pages') / scroll
    page = 1
    while (src_p / book_p / f'{page}.json').exists():
        with (src_p / book_p / f'{page}.json').open() as f:
            lines = json.load(f)
            for line_num in range(0, len(lines)):
                process_by_line(scroll, page, line_num, lines[line_num])
            pages_data[scroll].append(lines)
        page += 1
    for book in lookup_data[scroll]:
        for chapter in lookup_data[scroll][book]:
            for verse in lookup_data[scroll][book][chapter]:
                process_by_verse(scroll, int(book), int(chapter), int(verse), lookup_data[scroll][book][chapter][verse])
    for page, lines in enumerate(pages_data[scroll]):
        for line_num in range(0, len(lines)):
            add_translation(scroll, page+1, line_num, lines)



print("Saving results...")
for scroll, pages in pages_data.items():
    book_p = Path('pages') / scroll
    (dst_p / book_p).mkdir(parents=True, exist_ok=True)
    for i in range(0, len(pages)):
        with (dst_p / book_p / f'{i+1}.json').open('w') as f:
            json.dump(pages[i], f, ensure_ascii=False, indent=2)
for scroll, lookup in lookup_data.items():
    lookup_p = Path('lookup')
    (dst_p / lookup_p).mkdir(parents=True, exist_ok=True)
    with (dst_p / lookup_p / f'{scroll}.json').open('w') as f:
        json.dump(lookup, f, ensure_ascii=False, indent=2)


