#!/usr/bin/env python3
"""campaign/build/build_seed.py — the Story Guide's material → campaign/pack/seed.json.

Reads campaign/source/gm.md (its shape is described at its top) and campaign/source/prep-note.txt
(the recorded prep note, quoted word for word into the Overview), and writes a campaign pack whose
keys fill the GM tabs once (VttConfig.defaultCampaign.seed → engine/state.js seed):

  gm.overview · gm.rules · gm.people · gm.pc · gm.places   sections { id, title, text, sections, about }
  threads                                                   { id, title, text, open, sections }
  arc                                                       scenes { id, title, session, played, text, beats }
  party                                                     the five characters on ACTOR "Character"

Gated, exit non-zero on any failure: every entry has a stable id and ids are unique; every word of
gm.md's body and of the prep note reaches the pack as often as it is written (an independent re-read
of the pack's text against the sources); every `about` names a party member.

Usage: python3 campaign/build/build_seed.py
"""
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'campaign', 'source', 'gm.md')
NOTE = os.path.join(ROOT, 'campaign', 'source', 'prep-note.txt')
OUT = os.path.join(ROOT, 'campaign', 'pack', 'seed.json')
DOCS = os.path.join(ROOT, 'campaign', 'docs', 'party')
ACTOR_ID = '#cnc5Character000001'   # system/coyotecrow/sheet.js
PANES = ('overview', 'rules', 'people', 'pc', 'places', 'threads', 'arc')


def die(msg):
    print('build_seed: FAIL — ' + msg, file=sys.stderr)
    sys.exit(1)


def unwrap(text):
    """gm-text renders a newline inside a block as a line break: join wrapped lines, keeping list
    items and quote lines as the units they are"""
    blocks = []
    for block in re.split(r'\n\s*\n', text.strip()):
        units = []
        for line in block.splitlines():
            line = line.rstrip()
            if not line:
                continue
            if re.match(r'^(- |>)', line) or not units:
                units.append(line)
            else:
                units[-1] += ' ' + line.strip()
        if units:
            blocks.append('\n'.join(units))
    return '\n\n'.join(blocks)


def parse(text, note):
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = text.replace('{{PREP_NOTE}}', note)
    panes, pane, entry, sub = {}, None, None, None
    for line in text.splitlines():
        m = re.match(r'^(#{1,3}) (.+)$', line)
        if m:
            depth, title = len(m.group(1)), m.group(2).strip()
            if depth == 1:
                if title not in PANES:
                    die('unknown pane "%s"' % title)
                pane = panes.setdefault(title, [])
                entry = sub = None
            elif depth == 2:
                entry = {'title': title, 'meta': {}, 'lines': [], 'subs': []}
                pane.append(entry)
                sub = None
            else:
                sub = {'title': title, 'lines': []}
                entry['subs'].append(sub)
            continue
        m = re.match(r'^@ (\w+): (.*)$', line)
        if m and entry is not None and sub is None and not entry['lines']:
            entry['meta'][m.group(1)] = m.group(2).strip()
            continue
        if sub is not None:
            sub['lines'].append(line)
        elif entry is not None:
            entry['lines'].append(line)
        elif line.strip():
            die('text outside an entry: ' + line[:60])
    return panes


def body(lines):
    return unwrap('\n'.join(lines))


def section(e, pid):
    eid = e['meta'].get('id') or die('%s: "%s" has no @ id' % (pid, e['title']))
    s = {'id': 'nh-' + eid, 'title': e['title'], 'text': body(e['lines'])}
    if e['subs']:
        s['sections'] = [{'id': 'nh-%s-%d' % (eid, i + 1), 'title': x['title'], 'text': body(x['lines'])} for i, x in enumerate(e['subs'])]
    if e['meta'].get('about'):
        s['about'] = [a.strip() for a in e['meta']['about'].split(',')]
    return s


def party():
    """the five characters as members on ACTOR "Character": the fields their pages state, nothing else
    (no Stat Line: the recordings do not give one — campaign/PLAN.md)"""
    fields = {'name': 'Name', 'age': 'Age', 'archetype': 'Archetype', 'path': 'Path', 'motivation': 'Motivation', 'nation': 'Nation'}
    out = []
    for f in sorted(os.listdir(DOCS)):
        meta = {}
        text = open(os.path.join(DOCS, f), encoding='utf-8').read()
        for line in re.match(r'^---\n(.*?)\n---', text, re.S).group(1).splitlines():
            k, _, v = line.partition(':')
            meta[k.strip()] = v.strip()
        if meta.get('companion'):
            continue   # Wasawi is Suva's companion, not a seat at the table
        ch = {fields[k]: (meta[k]) for k in fields if meta.get(k)}
        slug = f[:-3]
        out.append((int(meta.get('order', 99)), {'id': 'nh-member-' + slug, 'templateId': ACTOR_ID, 'name': ch['Name'],
                    'source': {'kind': 'saga', 'id': 'campaign/docs/party/' + f}, 'character': ch, 'live': {}, 'notes': ''}))
    return [m for _, m in sorted(out, key=lambda x: x[0])]


WORD = re.compile(r"[A-Za-zÀ-ÿ0-9’'][\w’'-]*")


def words(t):
    return Counter(w.lower() for w in WORD.findall(t))


def main():
    note = open(NOTE, encoding='utf-8').read()
    note_text = re.sub(r'^\[Speaker \d+\]\s*', '', note).strip()
    panes = parse(open(SRC, encoding='utf-8').read(), note_text)

    gm = {k: [section(e, k) for e in panes.get(k, [])] for k in ('overview', 'rules', 'people', 'pc', 'places')}
    threads = []
    for e in panes.get('threads', []):
        t = section(e, 'threads')
        t['open'] = e['meta'].get('open', 'true') != 'false'
        threads.append(t)
    arc = []
    for e in panes.get('arc', []):
        s = section(e, 'arc')
        s['session'] = e['meta'].get('session') or die('scene "%s" has no session' % e['title'])
        s['played'] = e['meta'].get('played') == 'true'
        s['beats'] = [dict(x, kind='note') for x in s.pop('sections', [])]
        arc.append(s)
    members = party()
    pack = {'kind': 'sortilege-vtt-campaign', 'version': 1, 'gm': gm, 'threads': threads, 'arc': arc, 'party': members}

    # ── gates ──
    ids = []
    def collect(v):
        if isinstance(v, dict):
            if 'id' in v and isinstance(v['id'], str):
                ids.append(v['id'])
            for x in v.values():
                collect(x)
        elif isinstance(v, list):
            for x in v:
                collect(x)
    collect({'gm': gm, 'threads': threads, 'arc': arc, 'party': members})
    dup = [i for i, n in Counter(ids).items() if n > 1]
    if dup:
        die('ids used twice: %s' % dup)
    names = {m['name'] for m in members} | {'Wasawi'}
    for s in gm['pc'] + gm['people']:
        for a in s.get('about', []):
            if a not in names:
                die('"%s" is about "%s", who is not in the party' % (s['title'], a))

    # every word of the source reaches the pack: re-read gm.md and the note independently of parse()
    src = re.sub(r'<!--.*?-->', '', open(SRC, encoding='utf-8').read(), flags=re.S)
    src = re.sub(r'^@ \w+: .*$', '', src, flags=re.M).replace('{{PREP_NOTE}}', note_text)
    src = re.sub(r'^# \w+$', '', src, flags=re.M)
    got = []
    def text_of(v):
        if isinstance(v, dict):
            for k in ('title', 'text'):
                if isinstance(v.get(k), str):
                    got.append(v[k])
            for k in ('sections', 'beats'):
                for x in v.get(k, []) or []:
                    text_of(x)
    for k in gm:
        for s in gm[k]:
            text_of(s)
    for s in threads + arc:
        text_of(s)
    a, b = words(src), words('\n'.join(got))
    if a != b:
        diff = {w: (a[w], b[w]) for w in set(a) | set(b) if a[w] != b[w]}
        die('words differ between gm.md and the pack (source, pack): %s' % dict(list(diff.items())[:10]))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(pack, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print('build_seed: OK — overview %d, rules %d, people %d, pc %d, places %d, threads %d, scenes %d, party %d; %d words, every one in the pack'
          % (len(gm['overview']), len(gm['rules']), len(gm['people']), len(gm['pc']), len(gm['places']), len(threads), len(arc), len(members), sum(a.values())))


if __name__ == '__main__':
    main()
