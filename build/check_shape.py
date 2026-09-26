#!/usr/bin/env python3
"""
check_shape.py — the fields the site reads, asserted against the corpus's own counts.

verify_data.py proves every string arrives; it is blind to a string on the wrong field. This
checks the shapes system/coyotecrow/ will read — every typed set of the BASE, the two ACTORs
and the fields a sheet reads (the Stat Line's fifteen, Skill Ranks, Equipment, Gifts and
Burdens), the Icons and the pregens, the adventure's FLOW and SCENEs, the tables, the
sidebars — and every count is taken from a LINE SCAN of the corpus (a regex over the raw
files, sharing no code with the parser), never typed here.

    python3 build/check_shape.py [<path to titterpig-dsl-coyotecrow/0.5>]
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import BOOKS, DEFAULT_CORPUS  # noqa: E402
from verify_data import data_blobs  # noqa: E402

FAILS = []
N = [0]


def check(label, got, want):
    N[0] += 1
    if got != want:
        FAILS.append("%s: data has %r, the corpus %r" % (label, got, want))


def dsl_paths(corpus, glob_pat):
    """The corpus's DSL files matching the pattern, in every subfolder (icons/, pregens/) —
    never sources.json or the coverage manifest, which quote the corpus's own names."""
    return [p for p in glob.glob(os.path.join(corpus, "**", glob_pat), recursive=True)
            if os.path.isfile(p) and p.endswith((".ttrpg", ".actor", ".arc", ".frame", ".codex"))]


def scan(corpus, pattern, glob_pat="*"):
    """How many lines of the raw corpus files match — the independent count."""
    rx = re.compile(pattern)
    n = 0
    for p in dsl_paths(corpus, glob_pat):
        with open(p, encoding="utf-8") as fh:
            n += sum(1 for ln in fh if rx.search(ln))
    return n


def scan_text(corpus, pattern, glob_pat="*"):
    """How many matches over the raw file text — for a construct the corpus writes across lines."""
    rx = re.compile(pattern)
    return sum(len(rx.findall(open(p, encoding="utf-8").read())) for p in dsl_paths(corpus, glob_pat))


def main():
    corpus = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CORPUS
    books, others = data_blobs()
    E = {}
    for b in books:
        E.update(b["entities"])
    chapters = [c for b in books for c in b["book"]["chapters"]]
    index = next(o for o in others if isinstance(o, dict))
    records = next(o for o in others if isinstance(o, list))
    by_name = lambda n: [e for e in E.values() if e["name"] == n]
    typed = lambda t: [e for e in E.values() if e.get("type") == t]
    blocks = lambda e, kw: [b for b in e.get("blocks", []) if isinstance(b, dict) and b.get("kw") == kw]
    prop = lambda e, n: next((p for p in e.get("props", []) if p["name"] == n), None)

    def deep(test):
        """How many nodes anywhere in the book data pass `test` (every chapter's and entity's blocks, props, fields)."""
        n = 0
        stack = [c.get("blocks") for c in chapters] + [[e] for e in E.values()]
        while stack:
            x = stack.pop()
            if isinstance(x, list):
                stack.extend(x)
            elif isinstance(x, dict):
                if test(x):
                    n += 1
                for k, v in x.items():
                    if k not in ("children",) and isinstance(v, (list, dict)):
                        stack.append(v)
        return n

    def count_kw(nodes, kw):
        n = 0
        for x in nodes or []:
            if isinstance(x, dict):
                if x.get("kw") == kw:
                    n += 1
                n += count_kw(x.get("body"), kw)
        return n

    files = lambda ext: glob.glob(os.path.join(corpus, "**", "*." + ext), recursive=True)

    # ── the books and files ──
    check("books", len(books), len(BOOKS))
    check("chapters (every corpus file, subfolders too)", len(chapters),
          sum(len(files(x)) for x in ("ttrpg", "actor", "arc", "frame", "codex", "lore")))
    for ext in ("ttrpg", "actor", "arc"):
        check("%s chapters" % ext, sum(1 for c in chapters if c["kind"] == ext), len(files(ext)))
    check("every entity hashed in the corpus (no id written here)", sum(1 for e in E.values() if e.get("synthetic")), 0)

    # ── every typed set: an entity per `EXTENDS #h ^"Type"` line (a same-named EXTENDS is a copy) ──
    rx = re.compile(r'^\s*(?:#\S+ )?\^"((?:[^"\\]|\\.)*)" DEF \{\s*$|^\s*EXTENDS #\S+ \^"([^"]+)"\s*$')
    want = {}
    for p in files("ttrpg") + files("actor") + files("arc"):
        last = None
        for ln in open(p, encoding="utf-8"):
            m = rx.match(ln)
            if not m:
                continue
            if m.group(1) is not None:
                last = m.group(1)
            elif m.group(2) != last:
                want[m.group(2)] = want.get(m.group(2), 0) + 1
    for t in sorted(want):
        check("typed %r" % t, len(typed(t)), want[t])
    check("types met", len(want) >= 30, True)

    # ── the BASE: two ACTORs, and the fields a sheet reads ──
    base = next(c for c in chapters if c.get("container") == "BASE")
    actors = {e["name"]: e for e in E.values() if e["form"] == "ACTOR"}
    check("ACTORs declared", sorted(actors), sorted(re.findall(r'ACTOR "([^"]+)" DEF', open(os.path.join(corpus, base["file"]), encoding="utf-8").read())))
    icon = actors.get("Icon") or {}
    for f in ("Name", "Type", "Category", "Skill Check", "Stat Line", "Initiative", "Skills", "Abilities",
              "Equipment", "Special Abilities", "Gifts and Burdens", "Description"):
        check("ACTOR Icon declares %s" % f, prop(icon, f) is not None, True)
    pre = actors.get("Pregenerated Character") or {}
    check("Pregenerated Character EXTENDS Icon", pre.get("type"), "Icon")
    for f in ("Archetype", "Nation"):
        check("ACTOR Pregenerated Character declares %s" % f, prop(pre, f) is not None, True)
    stat_line = next((e for e in E.values() if e["name"] == "Stat Line" and e["file"] == base["file"]), {})
    check("Stat Line declares fifteen fields", len(stat_line.get("props", [])), 15)
    stat = next((e for e in E.values() if e["name"] == "Stat" and e["file"] == base["file"]), {})
    check("Stat Name ENUM (the nine)", len((prop(stat, "Name") or {}).get("options", [])), 9)

    # ── the Icons and pregens: what a sheet or a stat block reads, per character ──
    chars = typed("Icon") + typed("Pregenerated Character")
    check("characters in .actor files", sum(1 for e in chars if e["file"].endswith(".actor")),
          scan(corpus, r'^\s*EXTENDS #\S+ \^"(Icon|Pregenerated Character)"\s*$', "*.actor"))
    sl = [prop(e, "Stat Line") for e in chars]
    check("Stat Lines (a DEF value)", sum(1 for v in sl if v and v.get("vk") == "def"), scan(corpus, r'\^"Stat Line" #\S+ \^"Stat Line" DEF \{'))
    printed = [len(re.findall(r'\^"[^"]+" STRING "', m)) for p in dsl_paths(corpus, "*")
               for m in re.findall(r'\^"Stat Line" #\S+ \^"Stat Line" DEF \{([^}]*)\}', open(p, encoding="utf-8").read())]
    check("Stat Line fields", sum(len(v["fields"]) for v in sl if v and v.get("vk") == "def"), sum(printed))
    def items(e, name):
        v = prop(e, name)
        return (v or {}).get("items") or []
    check("Skill Rank rows", sum(len(items(e, "Skills")) for e in chars), scan_text(corpus, r'DEF \{ \^"Skill" STRING "'))
    check("Carried Item rows", sum(len(items(e, "Equipment")) for e in chars), scan_text(corpus, r'DEF \{ \^"Name" STRING "[^"]*"(?:  \^"Effects"|  \^"Printed"| \})'))
    check("Held Gift or Burden rows", sum(len(items(e, "Gifts and Burdens")) for e in chars), scan_text(corpus, r'DEF \{ \^"Kind" STRING "[^"]*"  \^"Name"'))
    check("pregens", len(typed("Pregenerated Character")), scan(corpus, r'^\s*EXTENDS #\S+ \^"Pregenerated Character"\s*$', "*.actor"))

    # ── the adventure ──
    arcs = [c for c in chapters if c["kind"] == "arc"]
    check("arc FLOW PHASEs", sum(count_kw(c["blocks"], "PHASE") for c in arcs), scan(corpus, r'^\s*PHASE \^', "*.arc"))
    check("arc SCENEs", sum(1 for e in E.values() if e["file"].endswith(".arc") and e["form"] == "SCENE")
          + sum(count_kw(c["blocks"], "SCENE") for c in arcs), scan(corpus, r'^\s*SCENE #', "*.arc"))

    # ── tables and sidebars ──
    check("TABLE blocks (a table, or its blocks where it prints no COLUMNS)",
          sum(1 for e in E.values() if e.get("table")) + deep(lambda x: x.get("kw") == "TABLE"), scan(corpus, r'^\s*TABLE \{'))
    check("GUIDANCE entries", sum(len(e.get("guidance", [])) for e in E.values()) + deep(lambda x: x.get("kw") == "ENTRY"), scan(corpus, r'^\s*ENTRY '))
    check("GUIDANCE entries that CONCERN something",
          sum(1 for e in E.values() for g in e.get("guidance", []) if g["concerns"]) + deep(lambda x: x.get("kw") == "CONCERNS"),
          scan(corpus, r'^\s*CONCERNS \['))
    check("DESCRIPTIONs", sum(1 for e in E.values() if "desc" in e) + deep(lambda x: x.get("kw") == "DESCRIPTION"), scan(corpus, r'^\s*DESCRIPTION "'))

    # ── records ──
    check("records carry every typed entity", sum(1 for r in records if r.get("type")), sum(1 for e in E.values() if e.get("type")))
    check("index counts entities", index["counts"]["entities"], len(E))

    print("check_shape: %s (%d assertions)" % ("OK" if not FAILS else "%d FAILED" % len(FAILS), N[0]))
    for f in FAILS:
        print("  " + f)
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
