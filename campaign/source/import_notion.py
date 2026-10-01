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

Usage: python3 campaign/source/import_notion.py <naadag-hasaka export> [--playlog <rpg-playlog export>] [--redact <file>]

  ../naadag-hasaka-support/archive/notion-export/2026-09-28/naadag-hasaka            the saga's pages
  --playlog …/notion-export/2026-09-28/rpg-playlog                                   the session pages
  --redact ../naadag-hasaka-support/redact.txt     other spellings of the players' names the session notes
                                                   use, one per line, matched exactly — kept OUTSIDE the repo

A web page the Story Guide pasted into Notion (CUTS) is not copied, only cited.
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


# page → slug (by the start of its file name; the first match wins)
SLUGS = [('A Good Death - GM Notes', 'session-1a-gm-notes'), ('1 A Good Death', 'session-1a'),
         ('1 B Good Death', 'session-1b'), ('1 C Good Death', 'session-1c'), ('2 A Stabbing Westward', 'session-2a'),
         ('2 B Nakatoo Boys', 'session-2b-nakatoo-boys'), ('2 B Stabbing Westward', 'session-2b-stabbing-westward'),
         ('2 C Coyote', 'session-2c'), ('Coyote & Crow Session Zero', 'session-zero'),
         ('Naadag Hasaka ', 'naadag-hasaka'), ('Daatsu', 'daatsu'), ('Gambling with Naasi', 'gambling-with-naasi'),
         ('Mahokamit', 'makokamit'), ('Migatuka', 'migatuka'), ('Rules Reference', 'rules-reference'),
         ('Soova', 'soova'), ('Syn', 'syn'), ('Tika', 'tika')]
# what an image in the export is (not copied; campaign/PLAN.md, the Notion import)
IMAGES = {
    'cc.png': 'the saga’s icon', 'cc 1.png': 'a session icon', 'cc 2.png': 'a session icon', 'cc 3.png': 'a session icon',
    'Untitled.png': 'a page of the book (Animals of Cahokia)', 'Untitled 1.png': 'a page of the book (People of Cahokia)',
    'Dodecahedron.jpg': 'a d12',
}
PLAYLOG_IMAGES = {
    ('session-1a', 'Untitled.png'): 'a portrait of Grandmother Naadag (on the site: campaign/assets/portraits/naadag.webp)',
    ('session-2a', 'Untitled.png'): 'a map: the north–south strip kept for animal migration, over North America',
    ('session-2a', 'Untitled 1.png'): 'the book’s map of Makasing',
    ('session-2a', 'Untitled 2.png'): 'the book’s map laid over a map of the United States: Cahokia at St. Louis, Coyote City in northern New Mexico',
    ('session-2b-nakatoo-boys', 'Untitled.png'): 'an image of three men of the Nakotoo caravan',
}
# web pages pasted into a Notion page: from the first marker to the page's end, cited, not copied
CUTS = {'session-2b-stabbing-westward': ('Indigenous Crop: The Jerusalem Artichoke',
        '[Pasted here in Notion and not copied: foodtank.com on the Jerusalem artichoke '
        '(https://foodtank.com/news/2014/02/indigenous-crop-the-jerusalem-artichoke/), and lists of '
        'edible flowers from wildedible.com and askaprepper.com.]')}
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


def near(a, b):
    """edit distance of at most 1"""
    if abs(len(a) - len(b)) > 1:
        return False
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    return a[i + 1:] == b[i + 1:] or a[i:] == b[i + 1:] or a[i + 1:] == b[i:]


ENGLISH = set()
if os.path.exists('/usr/share/dict/words'):
    ENGLISH = {w.strip().lower() for w in open('/usr/share/dict/words', encoding='utf-8', errors='ignore')}


def suspects(md, names):
    """words one letter from a player's name (5+ letters) that the redaction list missed — a spelling the
    session notes use that nobody listed. A lowercase English word ("justice", "corn") is not one."""
    out = set()
    for t in re.findall(r"[A-Za-zÀ-ÿ]+", md):
        low = t.lower()
        if t == '[a' or (t.islower() and low in ENGLISH):
            continue
        if any(len(n) >= 5 and near(low, n.lower()) for n in names) and t not in ('Corinth',):
            out.add(t)
    return out


def raw_text(html):
    p = HTMLParser(convert_charrefs=True)
    out, skip = [], [0]
    p.handle_starttag = lambda t, a: (skip.__setitem__(0, skip[0] + 1) if t in ('style', 'script', 'head') else out.append(' '))
    p.handle_endtag = lambda t: (skip.__setitem__(0, skip[0] - 1) if t in ('style', 'script', 'head') else out.append(' '))
    p.handle_data = lambda d: out.append(d) if not skip[0] else None
    p.feed(html)
    return ''.join(out)


def main():
    args = sys.argv[1:]
    opt = lambda k: args[args.index(k) + 1] if k in args else None
    if not args or args[0].startswith('--'):
        sys.exit(__doc__)
    root, playlog, redact_file = args[0], opt('--playlog'), opt('--redact')
    os.makedirs(OUT, exist_ok=True)
    names, run = player_names(root)
    extra = [l.strip() for l in open(redact_file, encoding='utf-8')] if redact_file else []
    extra = [x for x in extra if x and not x.startswith('#')]
    # every way a player is named: in a page title's tag, run together in Players, or loose in a note
    REDACT = [(r'\s*\[(?:Played by )?(?:%s)\]' % '|'.join(sorted(names)), '')] + ([(re.escape(run), '')] if run else [])
    TOKENS = sorted(set(names) | set(extra), key=len, reverse=True)
    LOOSE = re.compile(r'\[?\b(?:%s)\b\]?' % '|'.join(re.escape(t) for t in TOKENS))
    pages = sorted(glob.glob(os.path.join(root, '**', '*.html'), recursive=True))
    if playlog:
        pages += sorted(glob.glob(os.path.join(playlog, '**', '*.html'), recursive=True))
    manifest = []
    for path in pages:
        base = os.path.basename(path)
        slug = next((s for k, s in SLUGS if base.startswith(k)), None)
        if not slug:
            sys.exit('import_notion: FAIL — no slug for ' + base)
        html = open(path, encoding='utf-8').read()
        soova_i = iter(SOOVA_IMAGES)

        def image(src, slug=slug):
            name = os.path.basename(src).replace('%20', ' ')
            if (slug, name) in PLAYLOG_IMAGES:
                return PLAYLOG_IMAGES[(slug, name)]
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
        raw = raw_text(html)
        cut_words = Counter()
        if slug in CUTS:
            marker, note = CUTS[slug]
            at = md.index(marker)
            cut_words = words(md[at:])
            md = md[:at] + note + '\n'
        for r, rep in REDACT:
            md = re.sub(r, rep, md)
        md = LOOSE.sub('[a player]', md)
        # the gate: the page's words, less the redacted and the cut, all arrive; a name never does
        src, got = words(raw), words(md)
        for t in TOKENS:
            if re.search(r'\b%s\b' % re.escape(t), md):
                sys.exit('import_notion: FAIL — %s: a player’s name survives ("%s")' % (slug, t))
        sus = suspects(md, names)
        if sus:
            sys.exit('import_notion: FAIL — %s: a spelling close to a player’s name survives %s; add it to the --redact file'
                     % (slug, sorted(sus)))
        named = Counter()
        for t in re.findall(r"\b(?:%s)(?:’s|'s)?\b" % '|'.join(re.escape(t) for t in TOKENS + ([run] if run else [])), raw):
            named.update(words(t))
        pb = len(re.findall(r'Played by (?:%s)' % '|'.join(sorted(names)), raw))
        lost = {w: (src[w], got[w]) for w in src
                if src[w] - named[w] - cut_words[w] - (pb if w in ('played', 'by') else 0) > got[w]}
        if lost:
            sys.exit('import_notion: FAIL — %s: words lost %s' % (slug, dict(list(lost.items())[:8])))
        with open(os.path.join(OUT, slug + '.md'), 'w', encoding='utf-8') as fh:
            fh.write(md)
        title = base
        for r, rep in REDACT:
            title = re.sub(r, rep, title)
        manifest.append((slug, title, hashlib.sha256(html.encode()).hexdigest()[:16], sum(src.values()), sum(got.values())))
    with open(os.path.join(OUT, 'MANIFEST.tsv'), 'w', encoding='utf-8') as fh:
        fh.write('slug\tsource page (players redacted)\tsha256\tsource words\twritten words\n')
        for m in manifest:
            fh.write('\t'.join(str(x) for x in m) + '\n')
    print('import_notion: OK — %d pages; every word kept but the players’ names%s; %s'
          % (len(manifest), ' and the cited web pages' if any(m[0] in CUTS for m in manifest) else '',
             ', '.join('%s %d' % (m[0], m[4]) for m in manifest)))


if __name__ == '__main__':
    main()
