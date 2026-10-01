#!/usr/bin/env python3
"""campaign/build/build_seed.py — the Story Guide's material → campaign/pack/seed.json.

Reads campaign/source/gm.md (its shape is described at its top) and campaign/source/prep-note.txt
(the recorded prep note, quoted word for word into the Overview), and writes a campaign pack whose
keys fill the GM tabs once (VttConfig.defaultCampaign.seed → engine/state.js seed):

  gm.overview · gm.rules · gm.people · gm.pc · gm.places   sections { id, title, text, sections, about }
  threads                                                   { id, title, text, open, sections }
  arc                                                       scenes { id, title, session, played, text, beats }
  party                                                     the six travellers on ACTOR "Character" (four from their sheets)

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


SHEETS = os.path.join(ROOT, 'campaign', 'source', 'sheets.json')
STAT_NAMES = ['Strength', 'Agility', 'Endurance', 'Intelligence', 'Perception', 'Wisdom', 'Spirit', 'Charisma', 'Will']


# What a sheet prints that its player asked to keep from the table (Soova's page in Notion: "I wasn't
# sure how to make parts hidden"). The Party pane is shared with the session, so these stay in the
# Story Guide's note on the character (gm.md) and off the shared sheet.
HIDDEN = {'Soova': {'specialized': {'The Long Con'}, 'held': {'Secrets'}}}


def character_from_sheet(sh):
    """a transcribed sheet (campaign/source/sheets.json, checked by check_sheets.py) as the fields of
    ACTOR "Character": what the sheet prints, nothing added; an unranked Skill is left out, as the
    book's own Characters leave it out"""
    ch = {'Name': sh['name']}
    for k in ('Age', 'Archetype', 'Path', 'Motivation', 'Other Identifiers', 'Background', 'Initiative'):
        if sh.get(k):
            ch[k] = sh[k]
    line = {k: str(sh['stats'][k]) for k in STAT_NAMES}
    line.update({k: v for k, v in sh['derived'].items() if v})
    ch['Stat Line'] = line
    hide = HIDDEN.get(sh['name'], {})
    spec = {r['base']: r for r in sh['specialized'] if r['name'] not in hide.get('specialized', ())}
    rows, used = [], set()
    for r in sh['skills']:
        if r['rank'] <= 0 and r['skill'] not in spec:
            continue
        row = {'Skill': r['skill'], 'Rank': r['rank']}
        if r['skill'] in spec:
            row['Specialization'] = spec[r['skill']]['name']
            row['Specialization Rank'] = spec[r['skill']]['rank']
            used.add(r['skill'])
        rows.append(row)
    if set(spec) - used:  # noqa: a hidden one is not in spec
        die('%s: a Specialized Skill on a base Skill the sheet does not list: %s' % (sh['name'], set(spec) - used))
    ch['Skills'] = rows
    if sh['Abilities']:
        ch['Abilities'] = list(sh['Abilities'])
    ch['Gifts and Burdens'] = [dict(h) for h in sh['held'] if h['Kind'] not in hide.get('held', ())]
    if not hide:
        ch['Notes'] = 'Gifts and Burdens as the sheet prints them: ' + ' / '.join(sh['Gifts and Burdens (printed)'])
    return ch


def party():
    """the travellers as members on ACTOR "Character": the four with a sheet in the Notion export from
    their transcriptions; Syn and Migatuka, who have none, from the fields their pages state"""
    sheets = {sh['name']: sh for sh in json.load(open(SHEETS, encoding='utf-8'))['sheets']}
    fields = {'name': 'Name', 'age': 'Age', 'archetype': 'Archetype', 'path': 'Path', 'motivation': 'Motivation', 'nation': 'Nation'}
    out = []
    for f in sorted(os.listdir(DOCS)):
        meta = {}
        text = open(os.path.join(DOCS, f), encoding='utf-8').read()
        for line in re.match(r'^---\n(.*?)\n---', text, re.S).group(1).splitlines():
            k, _, v = line.partition(':')
            meta[k.strip()] = v.strip()
        name = meta['name']
        if name in sheets:
            ch = character_from_sheet(sheets.pop(name))
            src = {'kind': 'saga', 'id': 'campaign/source/sheets.json#' + name}
            sl = ch['Stat Line']
            live = {k: int(sl[lbl]) for k, lbl in (('body', 'Body'), ('mind', 'Mind'), ('soul', 'Soul')) if str(sl.get(lbl, '')).isdigit()}
        else:
            ch = {fields[k]: meta[k] for k in fields if meta.get(k)}
            src, live = {'kind': 'saga', 'id': 'campaign/docs/party/' + f}, {}
        out.append((int(meta.get('order', 99)), {'id': 'nh-member-' + f[:-3], 'templateId': ACTOR_ID, 'name': name,
                    'source': src, 'character': ch, 'live': live, 'notes': ''}))
    if sheets:
        die('sheets with no party page: %s' % list(sheets))
    return [m for _, m in sorted(out, key=lambda x: x[0])]


# The Notion pages (campaign/source/notion/, import_notion.py), word for word: where each goes.
NOTION_DIR = os.path.join(ROOT, 'campaign', 'source', 'notion')
NOTION = [
    ('naadag-hasaka', 'overview', 'The Notion page, word for word', None),
    ('soova', 'pc', 'Soova — her Notion page, word for word', 'Soova'),
    ('syn', 'pc', 'Syn — their Notion page, word for word', 'Syn'),
    ('daatsu', 'pc', 'Daatsu — his Notion page, word for word', 'Daatsu'),
    ('migatuka', 'pc', 'Migatuka — her Notion page, word for word', 'Migatuka'),
    ('tika', 'pc', 'Tika — his Notion page, word for word', 'Tika'),
    ('makokamit', 'places', 'The Makokamit — the Notion page, word for word', None),
    ('gambling-with-naasi', 'rules', 'Gambling with Naasi — the Notion page, word for word', None),
    ('rules-reference', 'rules', 'Rules Reference — the Notion page, word for word', None),
]


# Each session's Notion page (the RPG Playlog), word for word, as a beat on the first scene of its session.
SESSION_PAGES = [('Session Zero', ['session-zero']), ('1/A', ['session-1a', 'session-1a-gm-notes']),
                 ('1/B', ['session-1b']), ('1/C', ['session-1c']), ('2/A', ['session-2a']),
                 ('2/B', ['session-2b-nakatoo-boys', 'session-2b-stabbing-westward']), ('2/C', ['session-2c'])]


def session_beats(arc):
    for key, slugs in SESSION_PAGES:
        scene = next((sc for sc in arc if sc['session'].startswith(key)), None)
        if scene is None:
            die('no scene for session ' + key)
        for slug in slugs:
            text = open(os.path.join(NOTION_DIR, slug + '.md'), encoding='utf-8').read()
            first = text.strip().splitlines()[0].lstrip('# ').strip()
            body = re.sub(r'^## (.+)$', r'**\1**', text, flags=re.M)
            scene['beats'].append({'id': 'nh-notion-' + slug, 'kind': 'note',
                                   'title': 'The Notion page, word for word: ' + first, 'text': unwrap_notion(body)})
    return [s for _, ss in SESSION_PAGES for s in ss]


def notion_sections():
    """each page as a section; a page with `## ` headings is split at them into subsections"""
    out = []
    for slug, pane, title, about in NOTION:
        text = open(os.path.join(NOTION_DIR, slug + '.md'), encoding='utf-8').read()
        parts = re.split(r'^## (.+)$', text, flags=re.M)
        s = {'id': 'nh-notion-' + slug, 'title': title, 'text': unwrap_notion(parts[0])}
        subs = [{'id': 'nh-notion-%s-%d' % (slug, i // 2 + 1), 'title': parts[i].strip(), 'text': unwrap_notion(parts[i + 1])}
                for i in range(1, len(parts), 2)]
        if subs:
            s['sections'] = subs
        if about:
            s['about'] = [about]
        out.append((pane, s))
    return out


def unwrap_notion(t):
    """one Notion block per line already: keep lines, separate the non-list ones as paragraphs"""
    lines = [l.rstrip() for l in t.strip().splitlines() if l.strip()]
    out = []
    for l in lines:
        if out and out[-1].startswith('- ') and l.startswith('- '):
            out[-1] += '\n' + l
        else:
            out.append(l)
    return '\n\n'.join(out)


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
    for pane, sec in notion_sections():
        gm[pane].append(sec)
    session_slugs = session_beats(arc)
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
    names = {m['name'] for m in members}
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
    for slug, *_ in NOTION:
        src += '\n' + open(os.path.join(NOTION_DIR, slug + '.md'), encoding='utf-8').read().replace('## ', '')
        src += '\n' + [t for sl, _, t, _ in NOTION if sl == slug][0]
    for slug in session_slugs:
        text = open(os.path.join(NOTION_DIR, slug + '.md'), encoding='utf-8').read()
        src += '\n' + text.replace('## ', '') + '\nThe Notion page, word for word: ' + text.strip().splitlines()[0].lstrip('# ').strip()
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
