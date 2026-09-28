#!/usr/bin/env python3
"""campaign/source/check_sheets.py — the transcribed character sheets against their own arithmetic and
the book.

sheets.json was typed by hand from images, so each row is checked another way:
  - every Skill row: its Stat is one of the Skill's two Related Stats (the corpus's Skill entries), and
    is the higher of them at Rank 1+, the lower at Rank 0 — read from the sheet's own Stats block;
  - Total = Rank + Stat, except a Skill that Requires Rank ("*") at Rank 0, whose Total is 0;
  - a Specialized row's Stat is the higher Related Stat of its base Skill, Total = Rank + Stat;
  - Gift and Burden kinds are the book's own (the corpus's Gift or Burden entries).
A row that fails is either a typing slip here or the printed sheet's own; either way it is reported
(exit 1) and nothing is written.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.expanduser('~/Sortilege/Titterpig/DSL/titterpig-dsl-coyotecrow/0.5/coyotecrow-0.5-core-crafting-your-hero.ttrpg')
# Printed sheets that disagree with themselves, as the owner's sheet prints them (kept, reported as known).
KNOWN = set()


def corpus():
    text = open(CORPUS, encoding='utf-8').read()
    skills, kinds = {}, set()
    for m in re.finditer(r'EXTENDS #cnc5Skill000000001 \^"Skill"\s*PROPERTIES \{(.*?)\n\s*\}', text, re.S):
        body = m.group(1)
        name = re.search(r'\^"Name" STRING "([^"]+)"', body).group(1)
        rel = re.findall(r'"([^"]+)"', re.search(r'\^"Related Stats" LIST OF STRING \[([^\]]*)\]', body).group(1))
        req = re.search(r'\^"Requires Rank" BOOLEAN (true|false)', body)
        skills[name] = (rel, bool(req and req.group(1) == 'true'))
    for m in re.finditer(r'EXTENDS #\w+ \^"Gift or Burden"\s*PROPERTIES \{.*?\^"Name" STRING "([^"]+)"', text, re.S):
        kinds.add(m.group(1))
    return skills, kinds


def main():
    skills, kinds = corpus()
    if len(skills) != 28:
        sys.exit('check_sheets: FAIL — read %d Skills from the corpus, expected 28' % len(skills))
    data = json.load(open(os.path.join(HERE, 'sheets.json'), encoding='utf-8'))
    bad, n = [], 0
    for s in data['sheets']:
        st = s['stats']
        for r in s['skills']:
            n += 1
            rel, req = skills[r['skill']]
            vals = [st[x] for x in rel]
            want = max(vals) if r['rank'] > 0 else min(vals)
            total = 0 if (req and r['rank'] == 0) else r['rank'] + r['stat']
            if r['stat'] != want:
                bad.append('%s %s: Stat %s, the sheet\'s %s give %s' % (s['name'], r['skill'], r['stat'], '/'.join(rel), want))
            if r['total'] != total:
                bad.append('%s %s: Total %s, Rank %s + Stat %s makes %s' % (s['name'], r['skill'], r['total'], r['rank'], r['stat'], total))
        for r in s['specialized']:
            n += 1
            rel, _ = skills[r['base']]
            want = max(st[x] for x in rel)
            if r['stat'] != want or r['total'] != r['rank'] + r['stat']:
                bad.append('%s %s (%s): Stat %s Rank %s Total %s; the higher of %s is %s' % (s['name'], r['name'], r['base'], r['stat'], r['rank'], r['total'], '/'.join(rel), want))
        for h in s['held']:
            n += 1
            if h['Kind'] not in kinds:
                bad.append('%s: "%s" is not a kind of Gift or Burden in the book (%s)' % (s['name'], h['Kind'], ', '.join(sorted(kinds))))
    new = [b for b in bad if b not in KNOWN]
    for b in bad:
        print(('  known: ' if b in KNOWN else '  ') + b)
    if new:
        sys.exit('check_sheets: FAIL — %d of %d checks' % (len(new), n))
    print('check_sheets: OK — %d checks over %d sheets%s' % (n, len(data['sheets']), (', %d printed as the sheet has it' % len(bad)) if bad else ''))


if __name__ == '__main__':
    main()
