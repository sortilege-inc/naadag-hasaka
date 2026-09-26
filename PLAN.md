# sortilege-vtt-coyotecrow — plan and decision log

A virtual tabletop for **Coyote & Crow** (Connor Alexander, Coyote & Crow LLC), built on the
Titterpig corpus `titterpig-dsl-coyotecrow/0.5`. Its shape follows `PLAYBOOK.md` (in
`~/Sortilege/VTT/`, beside the VTT repos) and the L5R5e and VtM5e builds that applied it most
recently; they are read-only reference — nothing in them is modified here.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and
verified by the main session.

## Ground rules (inherited)

- The sibling repos are read-only reference. What is reused is the system-agnostic code only:
  `engine/*.js` (no game words), the generic DSL parser, the shape of the gate and of the
  build, the Worker. No other system's data, `system/` module, css, book map or namespace comes
  across. Every word of rules text this site shows is from `titterpig-dsl-coyotecrow/0.5`.
- `data/` is generated; regenerating is the only way to change it. Corpus gaps found while
  building are reported to `titterpig-dsl-coyotecrow/TODO.md`, never patched in the tool.
- Rules text is verbatim. The tool's own words are labels and connective prose only. A number
  the rules state only in prose is a named constant citing its sentence.
- The book calls the GM the **Story Guide** and a campaign a **saga**; the tool's own labels
  use the book's words.

## What is on disk (read 2026-09-26)

| Input | State |
|---|---|
| `~/Sortilege/VTT/sortilege-vtt-coyotecrow` | cloned empty 2026-09-26; remote `sortilege-inc/sortilege-vtt-coyotecrow` (**PRIVATE**); identity Jordan Peacock <jordan@sortilege.online> set per repo |
| `~/Sortilege/Titterpig/DSL/titterpig-dsl-coyotecrow/0.5` | 40 files, 1.3 MB of DSL, clean at `47f3b39`: 8 `.ttrpg`, 31 `.actor` (25 in `icons/`, 6 in `pregens/`), 1 `.arc`; its `./gates.sh` last run 2026-09-23: validator 40 files 0/0, coverage 519/519 |
| The art | **none.** No Coyote & Crow art exists on disk outside the PDF (`~/Sortilege/Titterpig/RAW/Coyote & Crow/`); see D4 |

**The parser** is L5R5e's (its five 0.5 extensions and `CHOOSE DISTINCT`) plus Daggerheart's
same-line `"label" "text"` row. The pilot read 40 of 40 files unchanged — and then the shape
gate found one construct no sibling corpus used, now the parser's sixth extension:

6. `^"Stat Line" #h ^"Stat Line" DEF { ^"Strength" STRING "2" … }` — a DEF-valued property that
   names its type (every Icon's and pregen's stat strip, 31 of them). Read as a reference, it
   left the strip's fifteen fields in a loose `DEF` block beside the property: every string
   still round-tripped (verify_data passed), the fields attached to nothing. `check_shape`'s
   "Stat Lines (a DEF value): data has 0, the corpus 31" is what caught it.

### The corpus, by what the tool needs

The BASE (`coyotecrow-0.5-core-base.ttrpg`, 0.5.3) is well typed: 37 types instantiated,
1,458 entities, every one of them hashed (the build writes no ids of its own).

| Need | In the corpus | Shape |
|---|---|---|
| The rules | *Rules of the Game*: the D12 System, Encounters, Damage/Death/Healing; 10 `Action`s, 7 `Damage Sub-Type`s, 5 `Effect`s, 4 `State`s, 3 `Rest`s, 3 `Range Band`s, 6 `Conditional Modifier`s; 25 `Table`s; 28 GUIDANCE sidebars | typed DEFs, nested as the book nests them |
| The dice | the D12 System's prose (*Dice Pool*, *Success Number*, criticals) — **no FACES or outcome ladder is declared** | read at M2 from the typed rules and the prose, each number a named constant citing its sentence |
| Character creation | *Crafting Your Hero*: *Steps to Creating a Character*, 22 `Motivation`s, 6 `Archetype`s, 15 `Path`s, 9 `Stat`s (Aspect × Domain grid), 28 `Skill`s (Related Stats, the asterisk), 27 `Ability`s, 11 `Gift or Burden` kinds with 3 `Gift or Burden Level`s, 7 `Derived Stat`s with their `Formula`, 71 `Equipment`; the printed sheet as 6 `Sheet Section`s | typed |
| Characters | `ACTOR "Icon"` (Stat Line, Skills as `Skill Rank`s, Abilities, Equipment as `Carried Item`s with `Item Effect`s, Special Abilities, Gifts and Burdens); `ACTOR "Pregenerated Character"` EXTENDS Icon; 41 Icons, 6 pregens | ACTOR instances |
| The adventure | `.arc` *Encounter at Station 54*: a `FLOW` of 6 `PHASE`s → 6 `SCENE`s, 22 `Read-Aloud`s, its tables | the table's module |
| The setting | 11 `Nation`s, 10 `Technology`s, 17 `Timeline Era`s, 9 `Faction`s, 12 `Location`s, 17 `Pastime`s, 6 `Saga Type`s; 465 `Glossary Entry`s (Chahi:English), 192 `Index Entry`s | typed |

## Decisions

**D1 — PROPOSED: declare the player character in the BASE.** The corpus declares `ACTOR "Icon"`
and `ACTOR "Pregenerated Character"` (EXTENDS Icon, adding Archetype and Nation) — and nothing a
player builds. The sheet is derived from an ACTOR's declarations (PLAYBOOK §1b), and the six
pregens already print two properties **no ACTOR declares**: `^"Path"` and `^"Motivation"` (6 of 6;
e.g. Jaya: Path "Snake", Motivation "Heroism"). Recommendation: as VtM5e's D1 and Daggerheart's
Character did — the conversion adds an `ACTOR "Character"` to the BASE declaring what *Crafting
Your Hero* and the printed sheet ask for (Name, Archetype, Path, Motivation, Nation, the nine
Stats, Skills as `Skill Rank`s, Abilities, Gifts and Burdens, Equipment, the Derived Stats), with
`Pregenerated Character` EXTENDS it; fixed upstream in `titterpig-dsl-coyotecrow`, never in the
tool. Trade-off: a BASE change and a corpus version bump now, versus a sheet at M4 that reads
fields no type declares. Needed by M4; M2–M3 do not wait on it.

**D2 — the books are the shelf; a book's chapters are its files** (autonomous, tool/method).
`build/build_data.py` maps each corpus file to its book by the file-name prefix
(`coyotecrow-0.5-<book>-…`, the name not the path — the corpus keeps Icons and pregens in
subfolders). One book today, `core`, 40 chapters, one data file (1.7 MB); a second book is one
line of `BOOKS`.

**D3 — PROPOSED: private for now; deployment deferred** (as L5R5e's D3). The GitHub repo is
private. Nothing in the repo hard-codes an origin; the Worker admits localhost and, until the
owner decides, only `sortilege-inc.github.io`; `engine/config.js` has `worker.deployed` empty.

**D4 — PROPOSED: the art.** The siblings copy their art from an owner site (L5R5e from Portents
& Fortunes); no Coyote & Crow site or asset folder exists. Options: none (text and CSS only), or
the owner names a source. Recommendation: none until the owner names one — the site does not
need art to work, and a D12 is drawn in CSS.

## Layout (the inherited three-layer shape; everything game-specific written here)

```
index.html               the site (M2)
build/                   the generators and their gates
data/                    GENERATED — window.COYOTECROW.books / .entities / .index / .records
engine/                  system-agnostic, copied whole from VtM5e (the newest engine: engine-level
                         GM panes, keepFocus, the §4b standards)
system/coyotecrow/       accessors, the entity renderer, the dice, the sheet, the creator, the
                         site's tabs; for the table: ops, the table adapter, panels
gm/                      the Story Guide's page, the table (vtt.html), the player's page (M3)
worker/                  the session rooms (Cloudflare Worker + Durable Object); not deployed
```

## Milestones

| # | Milestone | Proof required |
|---|---|---|
| M0 | Repo skeleton: `engine/*.js` and `worker/` from VtM5e, `build/parse_dsl.py` from L5R5e (+ Daggerheart's row), renamed; `engine/config.js`; `system/coyotecrow/ops.js`; launch entries (`vtt-coyotecrow` 8745, `vtt-coyotecrow-worker` 8800); this plan | **landed 2026-09-26** — `grep -rniE 'vtm\|vampire\|kindred\|l5r\|samurai\|troika'` over `engine worker/src build` matches only provenance comments ("Ported from sortilege-vtt-l5r5e"); the pilot parse reads 40 of 40 DSL files; `node` loads `engine/ops.js` + `system/coyotecrow/ops.js` (register, shared, playerView…) |
| M1 | `build/` generates `data/` from the corpus losslessly; `verify_data.py` both directions **and by count**; `check_shape.py` against counts scanned from the corpus; `build_layer.sh` with a Coyote & Crow fixture | **landed 2026-09-26** — `bash build/build.sh`: 40 corpus files → 1 book, 1,458 entities (0 ids written here), 1,105 records; `verify_data: 3260 strings (15160 occurrences) — 0 uncovered · 0 short · 0 unsourced`; `check_shape: OK (77 assertions)` — every typed set of the BASE by its own EXTENDS lines, both ACTORs and their fields, 31 Stat Lines / 405 fields, Skill Rank / Carried Item / Held Gift or Burden rows, 6 PHASEs, 6 SCENEs, 25 TABLEs, the GUIDANCE entries and DESCRIPTIONs; it failed first (Stat Lines 0 vs 31) and passed after parser extension 6; `node --check` every data file. `build_layer.sh build/fixtures/layer`: 15 strings 0/0/0, references and names resolve; a copy with a mistyped Icon hash and MODIFY name **fails** (exit 1) |
| M2 | The site: the book (outline, reader, sidebars, tables), the Icons, the pregens, the adventure (its Parts, read-aloud), the setting sets, the glossary and index, the D12 roller, search; the §4b standards (robots, books off by default, the /gm/ gate) | the browser, through the real controls |
| M3 | The Story Guide's page: Adventure (Station 54's six Parts as a module), Party, Inspector, Cast (Icons into a scene), Dice, Rules & Book, Log, Saga; the GM panes (Notes, Scenes, Threads); the table and the player's page wired | the browser, through the real controls |
| M4 | The character sheet derived from the player-character ACTOR (D1), the creator (*Steps to Creating a Character* walked over the typed sets), the live sheet (Body/Mind/Soul, Effects, States) and D12 Checks | the browser, through the real controls |
| M5 | Sessions proven with `wrangler dev` on 8800; deploy is the owner's step (D3) | two pages, two origins, one room |

One commit per milestone; each proven by the main session through the real controls
(PLAYBOOK §5) before the next begins.

## Decision log

| # | Decision | Why |
|---|---|---|
| 1 | `engine/` and `worker/` copied from VtM5e HEAD `91c233a`; the parser, the build (`build_data`, `verify_data`, `check_shape`'s helpers, `build_layer`) from L5R5e HEAD `312af2b`; Daggerheart's same-line row from `dfa54a4`. Taken by `git archive` of each HEAD, never the working trees | The owner named L5R5e or VtM5e. VtM5e's engine is the newer of the two (engine-level GM panes, `keepFocus`); L5R5e's build is the lossless generic dump (its decision 4), which needs no game words. `git archive` keeps another session's uncommitted work out |
| 2 | Local ports **8745 / 8800** | Every port in 8731–8744, 8748–8749, 8788–8799 is in a launch entry already; both checked free with `ss -ltn` |
| 3 | D2 above: one book, `core` | — |
| 4 | Parser extension 6 (the typed DEF-valued property) is written here, not back-ported to the siblings | Read-only reference; each sibling's corpus parses with its own copy |
| 5 | `check_shape` counts every typed set generically — one assertion per type, from the corpus's own `EXTENDS` lines (a same-named EXTENDS is a copy, not a type) — rather than a hand list of sets | 37 types, none named by hand; a new type in the BASE is checked without a code change |
| 6 | The scans read `icons/` and `pregens/` and only DSL files (never `sources.json` or the coverage manifest, which quote the corpus's names) | The first run of `check_shape` read `icons/` as a file |
| 7 | The layer fixture (`build/fixtures/layer/`) rewritten for this corpus: an Icon with a Skill Rank row, a MODIFY and a CONCERNS by name on *Athletics* | The inherited fixture pointed at L5R5e hashes; the gate must be proven against this corpus |
| 8 | GM-facing labels in `engine/config.js` say **Story Guide** and **saga** (the gate's title and text, the default campaign's name) | The book's own words |
| 9 | Not ported yet: Daggerheart's §4c GM workbench (sectioned nav, layout presets, the beat outline, NPC instances) | Not in the two named sources; a candidate for M3, when the GM page is built |
