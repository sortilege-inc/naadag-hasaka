#!/usr/bin/env python3
"""campaign/source/import_notion.py — the owner's Notion export → campaign/source/notion/*.md.

The export (a folder of Notion HTML pages and their images) stays outside the repo. Each page is
rendered here as plain Markdown the GM tabs can show (engine/gm-text.js: paragraphs, `- ` lists,
`## ` headings become section breaks for build_seed.py), with the players' real names removed. The
images are not copied: the four character sheets are transcribed into campaign/source/sheets.json,
Soova's timeline and family tree into campaign/source/gm.md, and the rest are pages of the book
(already in data/). MANIFEST.tsv records each page's source name (redacted), sha256 and word counts.

Gate (exit 1 on failure): every word of each page's text reaches its .md as often as it is written,
except the redacted names, which must reach it zero times.

Usage: python3 campaign/source/import_notion.py "<…/Private & Shared>"
"""
import glob
import hashlib
import os
import re
import sys
from collections import Counter
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'notion')
# The players' names are never written in this repo, not even here: they are read from the export at
# run time — the main page's Players property (run together, "AbcDefGhi") and the "[Name]" or
# "[Played by Name]" after each character page's title — and removed.
PAGE_TAG = re.compile(r'\s*\[(?:Played by )?([A-Z][a-z]+)\]')


def player_names(root):
    main = next(p for p in glob.glob(os.path.join(root, '*.html')))
    html = open(main, encoding='utf-8').read()
    m = re.search(r'Players</th>\s*<td>(.*?)</td>', html, re.S)
    run = re.sub(r'<[^>]+>', '', m.group(1)) if m else ''
    names = set(re.findall(r'[A-Z][a-z]+', run))
    for f in glob.glob(os.path.join(root, '**', '*.html'), recursive=True):
        names.update(PAGE_TAG.findall(os.path.basename(f)))
    if not names:
        sys.exit('import_notion: FAIL — no players found to redact')
    return names, run


# page → slug (by the start of its file name)
SLUGS = [('Naadag Hasaka ', 'naadag-hasaka'), ('Daatsu', 'daatsu'), ('Gambling with Naasi', 'gambling-with-naasi'),
         ('Mahokamit', 'makokamit'), ('Migatuka', 'migatuka'), ('Rules Reference', 'rules-reference'),
         ('Soova', 'soova'), ('Syn', 'syn'), ('Tika', 'tika')]
# what an image in the export is (not copied; campaign/PLAN.md, the Notion import)
IMAGES = {
    'cc.png': 'the saga’s icon', 'cc 1.png': 'a session icon', 'cc 2.png': 'a session icon', 'cc 3.png': 'a session icon',
    'Untitled.png': 'a page of the book (Animals of Cahokia)', 'Untitled 1.png': 'a page of the book (People of Cahokia)',
    'Dodecahedron.jpg': 'a d12',
}
SHEETS = {'Daatsu': 'Daatsu’s character sheet (in sheets.json)', 'Tika': 'Tika’s character sheet (in sheets.json)'}
SOOVA_IMAGES = ['Soova’s character sheet (in sheets.json)', 'Soova’s timeline (in gm.md)', 'Soova’s timeline, as a table (in gm.md)',
                'Soova’s family by marriage, a tree (in gm.md)', 'Wazawi’s character sheet (in sheets.json)',
                'a page of the book (The Black)', 'a page of the book (The Black, continued)', 'a page of the book (The Black, continued)',
                'a page of the book (The Wards of Paraa)']


class Page(HTMLParser):
    """block-level Markdown: headings, list items (nesting marked ↳), paragraphs, table rows, images"""
    BLOCK = {'p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'figure', 'summary', 'details', 'br', 'blockquote'}

    def __init__(self, images):
        super().__init__(convert_charrefs=True)
        self.lines, self.cur, self.skip, self.depth, self.head, self.cell = [], [], 0, 0, None, False
        self.images, self.img_i = images, 0

    def flush(self):
        t = re.sub(r'\s+', ' ', ''.join(self.cur)).strip()
        self.cur = []
        if not t:
            return
        if self.head:
            self.lines.append('\n## ' + t + '\n')
        else:
            self.lines.append(t)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('style', 'script', 'head'):
            self.skip += 1
            return
        if tag in self.BLOCK:
            self.flush()
        if tag in ('h1', 'h2', 'h3', 'h4', 'summary'):
            self.head = tag
        if tag == 'ul' or tag == 'ol':
            self.depth += 1
        if tag == 'li':
            self.cur.append('- ' + ('↳ ' * (self.depth - 1)))
        if tag in ('td', 'th'):
            if self.cell:
                self.cur.append(' | ')
            self.cell = True
        if tag == 'tr':
            self.cell = False
        if tag == 'input' and a.get('type') == 'checkbox':
            self.cur.append('[x] ' if 'checked' in a else '[ ] ')
        if tag == 'img' and not (a.get('src') or '').startswith('http'):
            self.flush()
            self.lines.append('[image: %s]' % self.images(a.get('src') or ''))

    def handle_endtag(self, tag):
        if tag in ('style', 'script', 'head'):
            self.skip -= 1
            return
        if tag in self.BLOCK or tag in ('td', 'th'):
            if tag in ('td', 'th'):
                return
            self.flush()
        if tag in ('h1', 'h2', 'h3', 'h4', 'summary'):
            self.head = None
        if tag in ('ul', 'ol'):
            self.depth -= 1

    def handle_data(self, d):
        if not self.skip:
            self.cur.append(d)


WORD = re.compile(r"[A-Za-zÀ-ÿ0-9’'][\w’'-]*")


def words(t):
    return Counter(w.lower() for w in WORD.findall(t))


def raw_text(html):
    p = HTMLParser(convert_charrefs=True)
    out, skip = [], [0]
    p.handle_starttag = lambda t, a: (skip.__setitem__(0, skip[0] + 1) if t in ('style', 'script', 'head') else out.append(' '))
    p.handle_endtag = lambda t: (skip.__setitem__(0, skip[0] - 1) if t in ('style', 'script', 'head') else out.append(' '))
    p.handle_data = lambda d: out.append(d) if not skip[0] else None
    p.feed(html)
    return ''.join(out)


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: import_notion.py "<…/Private & Shared>"')
    root = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    names, run = player_names(root)
    NAMES = {n.lower() for n in names} | ({run.lower()} if run else set())
    REDACT = [r'\s*\[(?:Played by )?(?:%s)\]' % '|'.join(sorted(names))] + ([re.escape(run)] if run else [])
    manifest = []
    for path in sorted(glob.glob(os.path.join(root, '**', '*.html'), recursive=True)):
        base = os.path.basename(path)
        slug = next((s for k, s in SLUGS if base.startswith(k)), None)
        if not slug:
            sys.exit('import_notion: FAIL — no slug for ' + base)
        html = open(path, encoding='utf-8').read()
        soova_i = iter(SOOVA_IMAGES)

        def image(src, slug=slug):
            name = os.path.basename(src).replace('%20', ' ')
            if slug == 'soova':
                return next(soova_i)
            if slug in ('daatsu', 'tika'):
                return SHEETS[slug.capitalize()]
            return IMAGES.get(name, name)
        pg = Page(image)
        pg.feed(html)
        pg.flush()
        md = '\n'.join(pg.lines)
        md = re.sub(r'\n{3,}', '\n\n', md).strip() + '\n'
        for r in REDACT:
            md = re.sub(r, '', md)
        # the gate: the page's words, less the redacted ones, all arrive; the redacted never do
        src = words(raw_text(html))
        got = words(md)
        for w in NAMES:
            if got.get(w):
                sys.exit('import_notion: FAIL — %s: a player’s name survives ("%s")' % (slug, w))
        # "Played by" goes with a player's name, as often as the page prints it
        pb = len(re.findall(r'Played by (?:%s)' % '|'.join(sorted(names)), raw_text(html)))
        lost = {w: (src[w], got[w]) for w in src if src[w] - (pb if w in ('played', 'by') else 0) > got[w] and w not in NAMES}
        if lost:
            sys.exit('import_notion: FAIL — %s: words lost %s' % (slug, dict(list(lost.items())[:8])))
        with open(os.path.join(OUT, slug + '.md'), 'w', encoding='utf-8') as fh:
            fh.write(md)
        title = base
        for r in REDACT:
            title = re.sub(r, '', title)
        manifest.append((slug, title, hashlib.sha256(html.encode()).hexdigest()[:16], sum(src.values()), sum(got.values())))
    with open(os.path.join(OUT, 'MANIFEST.tsv'), 'w', encoding='utf-8') as fh:
        fh.write('slug\tsource page (players redacted)\tsha256\tsource words\twritten words\n')
        for m in manifest:
            fh.write('\t'.join(str(x) for x in m) + '\n')
    print('import_notion: OK — %d pages; every word kept but the players’ names; %s'
          % (len(manifest), ', '.join('%s %d' % (m[0], m[4]) for m in manifest)))


if __name__ == '__main__':
    main()
