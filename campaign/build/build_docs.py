#!/usr/bin/env python3
"""campaign/build/build_docs.py — Naadag Hasaka's public pages → campaign/data/docs.js.

Reads campaign/docs/ (home.md, chronicle/NN-*.md, party/*.md, people/*.md: Markdown with a small
front matter) and writes window.NAADAG_DOCS for campaign/site/site.js. Every page is gated, and any
failure exits non-zero without writing:

  names    — every capitalised word that is not the first word of a sentence must be a name this saga
             declares (SAGA_NAMES: its people, from the recordings) or a word the corpus prints
             (data/*.js, the Coyote & Crow books). A misheard or invented name fails the build.
  private  — the public pages must not tell what belongs to the Story Guide's notes only (PRIVATE:
             Migatuka's lost child and her vision, the prep note's plans). See campaign/PLAN.md.
  links    — a person's `chapters` name chapters that exist; every party/people file has a name.
  words    — each page's words reach the output as often as they are written (the converter drops
             nothing but markup).

Usage: python3 campaign/build/build_docs.py [--check-only]
"""
import glob
import html
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOCS = os.path.join(ROOT, 'campaign', 'docs')
OUT = os.path.join(ROOT, 'campaign', 'data', 'docs.js')

# The saga's own people and things, spelled as the owner's Notion export spells them (campaign/PLAN.md P1).
SAGA_NAMES = {
    'Naadag', 'Grandmother', 'Soova', 'Syn', 'Daatsu', 'Migatuka', 'Wazawi', 'Zibizin', 'Ninosh',
    'Choyan', 'Tika', 'Yohipa', 'Winks', 'Seeing', 'Papa', 'Hoyohih', 'Loohok', 'Kii', 'Das',
    'Misyooyi', 'Minak', 'Kooyoopi', 'Kaptaanzi', 'Tawihichik', 'Hiicho', 'Tisimiga', 'Ninosanipan',
    'Hokawichakun',
}
# Words the chronicle capitalises that are ordinary English at a sentence's middle.
ENGLISH_OK = {'I', "I'm", "I've", "I'd", "I'll", 'Hey', 'Oh', 'Excellent', 'Welcome', 'Thank', 'Well',
              'Right', 'Would', 'You', 'Come', 'The', 'U', 'January', 'February', 'March', 'April', 'May',
              'June', 'July', 'August', 'September', 'October', 'November', 'December'}
# What the public pages must not tell (campaign/PLAN.md, decision P2): stems, case-insensitive.
PRIVATE = [r'miscarr', r'\bbaby\b(?! girl)', r'\bunborn', r'\boracle', r'\bpregnan',
           r'crime famil', r'crime lord', r'\bwithdrawal', r'long con', r'espionage', r'Hiihangaziwag',
           r'secretly Din', r'\bbetray', r'\bspy\b', r'great-aunt']


def die(msg):
    print('build_docs: FAIL — ' + msg, file=sys.stderr)
    sys.exit(1)


def corpus_words():
    words = set()
    for f in glob.glob(os.path.join(ROOT, 'data', '*.js')):
        with open(f, encoding='utf-8') as fh:
            words.update(re.findall(r"[A-ZÀ-Ý][\w’'-]*", fh.read()))
    if not words:
        die('no corpus data under data/ — run bash build/build.sh first')
    return words


def front(path):
    text = open(path, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', text, re.S)
    if not m:
        die(path + ': no front matter')
    meta = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(':')
        v = v.strip()
        if v.startswith('[') and v.endswith(']'):
            v = [int(x) if x.strip().isdigit() else x.strip() for x in v[1:-1].split(',') if x.strip()]
        elif v.isdigit():
            v = int(v)
        meta[k.strip()] = v
    return meta, m.group(2)


def inline(t):
    h = html.escape(t, quote=False)
    h = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', h)
    h = re.sub(r'(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)', r'\1<em>\2</em>', h)
    return h


def markdown(body):
    """paragraphs, ## / ### headings, > quotes, - lists; a line break inside a block is a space"""
    out = []
    for block in re.split(r'\n\s*\n', body.strip()):
        lines = block.strip().splitlines()
        if not lines:
            continue
        if lines[0].startswith('#'):
            lvl = len(lines[0]) - len(lines[0].lstrip('#'))
            out.append('<h%d>%s</h%d>' % (lvl + 1, inline(lines[0].lstrip('#').strip()), lvl + 1))
            lines = lines[1:]
            if not lines:
                continue
        if all(l.startswith('>') for l in lines):
            out.append('<blockquote><p>%s</p></blockquote>' % inline(' '.join(l.lstrip('>').strip() for l in lines)))
        elif lines[0].startswith('- '):
            items = []
            for l in lines:
                if l.startswith('- '):
                    items.append(l[2:].strip())
                else:
                    items[-1] += ' ' + l.strip()
            out.append('<ul>%s</ul>' % ''.join('<li>%s</li>' % inline(i) for i in items))
        else:
            out.append('<p>%s</p>' % inline(' '.join(l.strip() for l in lines)))
    return '\n'.join(out)


WORD = re.compile(r"[A-Za-zÀ-ÿ’'][\w’'-]*")


def words_of(text):
    return sorted(w.lower() for w in WORD.findall(text))


def check_words(name, md, h):
    plain = re.sub(r'[*#>]', ' ', re.sub(r'^\s*- ', ' ', md, flags=re.M))
    out = html.unescape(re.sub(r'<[^>]+>', ' ', h))
    if words_of(plain) != words_of(out):
        a, b = words_of(plain), words_of(out)
        missing = sorted(set(a) - set(b)) or [w for w in set(a) if a.count(w) != b.count(w)]
        die('%s: words differ between the page and its output — %s' % (name, missing[:8]))


def check_names(name, text, known):
    bad = []
    for sent in re.split(r'(?<=[.!?:;"”—])\s+|\n\s*\n|^#+ |\n#+ ', text):
        toks = re.findall(r"[A-Za-zÀ-ÿ][\w’'-]*", sent)
        for i, t in enumerate(toks):
            if i == 0 or not t[0].isupper():
                continue
            base = re.sub(r"(’s|'s|’|')$", '', t)
            if base in SAGA_NAMES or base in ENGLISH_OK or base in known:
                continue
            bad.append(t)
    if bad:
        die('%s: names neither the saga nor the books use — %s' % (name, sorted(set(bad))))


def check_private(name, text):
    for pat in PRIVATE:
        m = re.search(pat, text, re.I)
        if m:
            die('%s: tells what is kept in the Story Guide\'s notes ("%s")' % (name, m.group(0)))


def main():
    known = corpus_words()
    pages = {}
    total = 0

    def read(path):
        nonlocal total
        meta, body = front(path)
        rel = os.path.relpath(path, DOCS)
        check_private(rel, body + ' ' + json.dumps(meta, ensure_ascii=False))
        check_names(rel, body, known)
        h = markdown(body)
        check_words(rel, body, h)
        total += len(WORD.findall(body))
        return meta, h

    meta, h = read(os.path.join(DOCS, 'home.md'))
    pages['home'] = dict(meta, html=h)

    chronicle = []
    for i, f in enumerate(sorted(glob.glob(os.path.join(DOCS, 'chronicle', '*.md'))), 1):
        meta, h = read(f)
        if not meta.get('title') or not meta.get('part'):
            die(f + ': a chapter needs title and part')
        slug = re.sub(r'^\d+-', '', os.path.basename(f)[:-3])
        chronicle.append(dict(meta, n=i, slug=slug, html=h))
    pages['chronicle'] = chronicle

    for kind in ('party', 'people'):
        rows = []
        for f in glob.glob(os.path.join(DOCS, kind, '*.md')):
            meta, h = read(f)
            if not meta.get('name'):
                die(f + ': no name')
            for c in meta.get('chapters', []) or []:
                if not 1 <= c <= len(chronicle):
                    die('%s: chapter %s does not exist' % (f, c))
            rows.append(dict(meta, slug=os.path.basename(f)[:-3], html=h))
        rows.sort(key=lambda r: (r.get('order', 99), r['name']))
        pages[kind] = rows

    if '--check-only' in sys.argv:
        print('build_docs: OK (check only) — %d words' % total)
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('// GENERATED by campaign/build/build_docs.py from campaign/docs/ — never edit by hand.\n')
        fh.write('window.NAADAG_DOCS = ' + json.dumps(pages, ensure_ascii=False, indent=1) + ';\n')
    print('build_docs: OK — home, %d chapters, %d in the party, %d people; %d words; names, private, links, words gated'
          % (len(chronicle), len(pages['party']), len(pages['people']), total))


if __name__ == '__main__':
    main()
