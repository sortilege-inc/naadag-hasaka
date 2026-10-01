# Naadag Hasaka × sortilege-vtt-coyotecrow — plan and decision log

A **Coyote & Crow** saga played March–June 2023, in Cahokia in the year 710: the ten-day Seeing of
Grandmother Naadag, an elder of the Diné Republic who chose the day of her own death, and the journey
west her last request begins. Three sessions were recorded. Built as an **instance** of
`sortilege-vtt-coyotecrow` (`~/Sortilege/VTT/INSTANCES.md`, PLAYBOOK §4/§4b). *Naadag Hasaka* is Chahi
for *Crow Mesa* (the book's glossary: *Naadag*, crow; *Hasaka*, mesa).

**This repo depends on `sortilege-vtt-coyotecrow` only.** Every script under `campaign/` is its own;
nothing reads another campaign repo.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and proven.

- **here** — `sortilege-inc/naadag-hasaka` (**PUBLIC; LIVE since 2026-09-28** — P4): https://sortilege-inc.github.io/naadag-hasaka/, Worker https://naadag-hasaka.sortilege.workers.dev.
- **upstream** — `sortilege-inc/sortilege-vtt-coyotecrow` (private), remote `upstream`.

## What is on disk (read 2026-09-27, the Notion export 2026-09-28)

Two sources, both **kept outside the repo** (they carry the players' names). Since 2026-09-30 both live in
`../naadag-hasaka-support/archive/`, in Caul's layout (filed by that folder's `scripts/organize_archive.py`):
`recordings/` and `transcriptions/` (named `2023-03-10 - Coyote & Crow Session 1`, `2023-04-07 - … 2`,
`2023-05-05 - … 3`, and the undated `Coyote & Crow Notes`) and `notion-export/2026-09-28/{naadag-hasaka,
rpg-playlog}/`. The `~/Downloads/…` paths below are where they were first read. Re-import with
`python3 campaign/source/import_notion.py ../naadag-hasaka-support/archive/notion-export/2026-09-28/naadag-hasaka`
(re-run from the archive 2026-09-30: output identical).

- **The owner's Notion export** (added 2026-09-28), `~/Downloads/b6a4849d-…_ExportBlock-…/Private & Shared/`
  — **the authority** (owner, 2026-09-28: "the notion export is more authoritative"). 9 pages: the saga's
  page (characters, the RPG Playlog with every session's date, to-do, GM questions, keep-in-mind, setting
  and lore, rulings, ideas), a page each for Soova, Syn, Daatsu, Migatuka (empty) and Tika (the Story
  Guide's exchanges with the players), the Makokamit, *Gambling with Naasi* (house rules), a Rules
  Reference crib; 17 images: **four character sheets** (Soova, Daatsu, Tika, Wazawi), Soova's timeline
  and family tree, six pages of the book, icons.
- **The recordings**, `~/Downloads/2023 Naadag Hasaka/` (147 MB): the three sessions of *Good Death*
  (1/A 10 March, 1/B 7 April, 1/C 5 May 2023) and a spoken prep note.
- **The RPG Playlog's session pages** (a second Notion export, filed 2026-09-30, `rpg-playlog/`): Session
  Zero, 1/A–1/C, 2/A, both 2/Bs and 2/C, with *A Good Death — GM Notes* and images under 1/A, 2/A and 2/B.
  **Not yet read into the saga.**

| Folder | What it is | Words |
|---|---|---|
| *Coyote & Crow Session 1* | .m4a + auto-transcript: character introductions and the Story Guide's questions; the Seeing explained; Sign's vision and the ride; day 1 | 17,673 |
| *Coyote & Crow 2* | .m4a + transcript: recap; days 2–4 (Ninosh, the colleague, Wasawi in the forest, the uncles, the gifts, the feast, the life told with gaps, the speeches). **The transcript stops mid-sentence** before Grandmother's private meeting | 11,813 |
| *Coyote & Crow 3* | .m4a + transcript: recap (the box for the Diné Republic, the song map); Tika joins; kalera root defined; days 5–10 | 21,358 |
| *Coyote & Crow Notes* | .m4a + transcript: the Story Guide's spoken prep note for session 4 | 303 |

The transcripts are machine-made: two to ten speaker labels a session that do not map to people,
crosstalk and household talk interleaved, and every proper name spelled several ways. The session
dates are not stated; session 3 set the next game for "Friday the 19th".

**Four characters have sheets** in the Notion export (Soova, Daatsu, Tika, Wazawi) and are on the VTT's
sheet (M4). Syn and Migatuka have none; the few Ranks and Stats said aloud for them in play are in the
Story Guide's notes, marked as heard.

## Decisions

The owner declined a round of questions on 2026-09-27 and let the build go ahead; these are the
recommended defaults, taken autonomously and listed for audit. Each is a one-line change to reverse.

**P1 — (owner, 2026-09-28) the Notion export is the authority.** Names are spelled as it spells them —
Soova, Syn, Daatsu, Migatuka, Wazawi, Winks, kelera, Hoyohih, Loohok, Kii Das, Misyooyi — and where it and
the recordings disagree, it wins (the decision log lists each case). The recordings supply what Notion
does not have: the events of 1/A–1/C. *Superseded:* the transcript spellings chosen on 2026-09-27 (Suva,
Sign, Datsu, Makatooka, Wasawi, Wings, kalera), now only in the Overview's *Names* as search aids. A name
on a public page must be in `SAGA_NAMES` (`campaign/build/build_docs.py`) or printed in the book.

**P2 — Migatuka's lost child, and Soova's secret, are the Story Guide's only (autonomous, privacy — for
the owner's check).** Soova's origin (a Coyote City crime family, the long con, the false story of the
fire) is her player's secret Burden: the public pages tell the cover story, and her sheet on the Party
pane (shared with the table) leaves out *The Long Con* and the Secret Burden, which her player asked to
keep hidden (`HIDDEN` in `build_seed.py`; both are in the Story Guide's note on her). Migatuka's
miscarriage, her day-5 vision and the prep note's "oracle" are in the Story Guide's notes
on her (*Private: the lost child*) and in the Scenes prep, not on any public page. The chronicle tells
that she pushed past her usual limit on day 5 and was frightened by what she saw, and keeps the blanket
scene, which was played in front of everyone. Why: the prep note says she must keep it from the others,
and in session 3 the Story Guide checked with the table before discussing it. `build_docs.py` fails a
public page that mentions it. The prep note's other plans (the stowaway, "crime families", withdrawal,
the Coyote City cousin) are held back the same way.

**P3 — The chronicle is prose, one chapter per session (autonomous, content — the owner's register from
Fall of London, Physician and Banes).** No dice, rules or players' names; the transcript is the only
source; nothing is written that the recordings do not show. Unrecorded events (the private meeting that
set the task) get one line. What was table illustration rather than event is left out.

**P4 — (owner, 2026-09-28: "push and deploy") public and live.** `main` pushed to the public repo (this
publishes upstream's `data/`, the book text, and `campaign/pack/seed.json`, the Story Guide's notes, as
Banes of Beleriand does); Pages from `main`; the Worker `naadag-hasaka`. Redeploy the Worker
(`cd worker && npx wrangler deploy`) after any upstream change to `engine/ops.js` or the system's `ops.js`.

## Milestones

| # | What | Proof |
|---|---|---|
| **M1** | The fork | landed 2026-09-27 (`7a07cc7`): `main` = upstream `main` (`b7166d1`) + the instance commit. **Boundary proven by making it fail** in a throwaway clone: a fake upstream commit to `engine/config.js` and `index.html` merged without the driver → `CONFLICT (content): Merge conflict in engine/config.js`; with `merge.ours.driver true` → merged clean, the title stayed *Naadag Hasaka*, `index.html` took upstream's line |
| **M2** | The public pages — `campaign/docs/` → `campaign/build/build_docs.py` → `campaign/data/docs.js`; `campaign/site/site.js`, `campaign.css` | landed 2026-09-27: home, 3 chapters, 6 travellers, 6 people, 5,882 words. Gates: names, private, links, words both ways. **Each proven by a planted fault**: *Enosh* for Ninosh → `names neither the saga nor the books use — ['Enosh']`; "oracle" on Makatooka's page → `tells what is kept in the Story Guide's notes`; a converter that drops emphasis → `words differ … ['crow', 'hasaka', 'mesa']`; Choyan in chapter 4 → `chapter 4 does not exist`. Browser on 8754: tabs *Naadag Hasaka · The Chronicle · The Travellers · Dramatis Personae* ahead of the VTT's (books off); Sign's page with *Path of the Beaver* linking to the book's entry, which opens with the books closed; chapter pages with contents and turn links; the mesa/indigo tokens loaded after the system's; at 375 px no sideways scroll (scrollWidth 375 on a chapter and the party list). Only console error: Google Fonts blocked by the browser pane (upstream's font link) |
| **M3** | The Story Guide's material — `campaign/source/gm.md` + `prep-note.txt` → `campaign/build/build_seed.py` → `campaign/pack/seed.json` (`defaultCampaign.seed`) | landed 2026-09-27: overview 5, rulings 4, people 9, notes on the characters 6, places 4, threads 12, scenes 8 (6 played, 2 prepped), party 5; 3,174 words, every one in the pack. Gates: unique ids, every `about` a party member, the source's words re-read against the pack. **Proven by planted faults**: a parser that drops subsections → words differ; `about: Tikka` → not in the party; and the real clash it caught on first run (members and notes both `nh-pc-*`). Browser: after the gate, `seeded` 80 ids; nav *Inspector Party · Scenes Threads · Overview People Places · Icons Rules & Book Dice Log · Saga Settings* (no Adventure); Scenes grouped *Session 1–3, Next*; Party lists Suva … Tika with Archetype · Path · Motivation, Body/Mind/Soul "—"; Suva's sheet opens in the Inspector |
| **M4** | The Notion export and the characters' numbers — `campaign/source/import_notion.py` → `campaign/source/notion/` (9 pages, word for word, players' names removed); the four sheets typed into `campaign/source/sheets.json`, checked by `check_sheets.py`; the saga rebuilt on Notion's names and facts | landed 2026-09-28. **Import**: *9 pages; every word kept but the players' names*; the names are read from the export at run time and never written in the repo (`grep -riw` for each over `campaign/`, `engine/config.js`, `README.md` → 0); **proven by planting a fault** (redaction off → *a player's name survives*). **Sheets**: *check_sheets: OK — 136 checks over 4 sheets* (every Skill's Stat is the higher/lower of its two Related Stats from the corpus, Total = Rank + Stat, `*` Skills 0 at Rank 0, Gift/Burden kinds the book's); **proven by five planted faults** → 7 failures, exit 1. **Browser**, fresh storage, after the gate: 143 ids seeded, six travellers (four with pools: Soova 7/8/12, Daatsu 10/10/7, Tika 7/12/10, Wazawi 9/8/9); the VTT's own sheet computes **every one of 120 printed Totals** (Soova 29, Daatsu 28, Tika 35, Wazawi 28 rows) and does not show *The Long Con*; 0 console errors. Public: Syn's page in they/them; Dramatis Personae 8 |
| **M5** | Deploy — push, Pages, the Worker `naadag-hasaka` | **owner, 2026-09-28: "push and deploy"**. `main` pushed; Pages on from `main` (`.nojekyll` in place, HTTPS enforced) → https://sortilege-inc.github.io/naadag-hasaka/; Worker `naadag-hasaka` (version 8e8fabbf) → https://naadag-hasaka.sortilege.workers.dev, `ALLOWED_ORIGIN` the github.io origin: `GET /session/ABCD` from it → 200 `{"exists":false}`, from a foreign origin → 403 `origin not allowed`; `engine/config.js` names it |

## Decision log

| When | Kind | Decision | Why |
|---|---|---|---|
| 2026-09-28 | **owner** | **The Notion export is the authority** (P1). The saga rebuilt on it: names; **Syn is Tahood** ("not male or female") → they/them throughout, overriding the table's "she" (the book's own word, glossary *Tahood*); **Soova** married Hoyohih, Grandmother's **son** (not grandson), and her daughter **Kii Das** died in 708; **Grandmother's husband Misyooyi** died in 689 (the recording's "about fifteen years"); **the box goes to Oraibi**; **Tika** was hired as an escort at Yohipa's request, coordinating with Daatsu (1/C had the job come from a dice game — the chronicle keeps that he won, not what); **Tika's eyes** (plural), Motivation **Wealth**; **Migatuka** is Minak, worked in trauma care, her cat is **Winks**; **Daatsu** is Makokamit (the book's people, between Cahokia and the Paha); **Loohok** is 10 (Soova's tree says 8); **the stowaway** is seven, mute, autistic (the prep note said five) | Owner instruction |
| 2026-09-28 | autonomous, fidelity | **Chapter parts carry the session and its date** (*1/A Good Death, 10 March 2023*…), from the RPG Playlog: the recordings are 1/A, 1/B and 1/C (1/A: "we're at the 7th" = the next game, 7 April; 1/C: "Friday the 19th" = 2/A, 19 May). **2/A, 2/B and 2/C were played and are in no source**: Scenes has a card for each, marked played, with 2/A holding what was prepared for it | The Notion playlog |
| 2026-09-28 | autonomous, fidelity | **Zibizin is ungendered** ("partner", "parent"): no source gives Zibizin's gender | Pronouns from the record |
| 2026-09-28 | autonomous, scope | **Every Notion page is in the GM tabs word for word** (Overview: the saga's page, split at its headings; Behind the characters: the five character pages; Rules: *Gambling with Naasi* and the Rules Reference; Places: the Makokamit), gated both ways in `build_seed.py`. The ability texts pasted there (River's Flow, Walk The Black) are the book's and are kept as the page has them. **Images are not copied**: the sheets are transcribed, the timeline and family tree are written into the Story Guide's notes (*Grandmother's family*), the book pages are in `data/` | Physician's rule: every GM note in the GM section |
| 2026-09-28 | autonomous, sheets | **Sheets as printed**: typos kept (*Tinker*, *Noteriety*, *Secert*, *Rivers Flow*), each Gift/Burden mapped to the book's kind (*Spirit Connection* → Spirit World Connection, *Wealth* → Financial, *Addict* → Addiction, *Companion* → Companions, *Secert* → Secrets) with the printed name kept; blank fields (Soova's and Wazawi's Defenses and Initiative) left blank; unranked Skills left off, as the book's own Characters do. **Syn and Migatuka have no sheet** (Notion to-do: finish Migatuka's) and are identity-only members. Wazawi, a companion, is a member now that she has a sheet | Nothing added that the sheet does not print |
| 2026-09-27 | autonomous, method | **`main` is upstream's `main` plus the instance commit**, not a move-and-merge | The repo was empty: nothing to move, no unrelated histories |
| 2026-09-27 | autonomous, tool | Identity Jordan Peacock <jordan@sortilege.online>; `merge.ours.driver true`; `.gitattributes` (`merge=ours` on the instance-owned root files); `.gitignore` adds `!.claude/skills/`; `.nojekyll` | The instance boundary (INSTANCES.md) |
| 2026-09-27 | autonomous, tool | Title *Naadag Hasaka*; `storagePrefix`/`channel` `naadag-vtt`; Worker `naadag-hasaka`; launch entries `naadag` (8754) and `naadag-worker` (8804) in the repo's and `~/.claude/launch.json`, both ports free (`ss -ltn`, every launch file) | Per-instance values |
| 2026-09-27 | autonomous, config | **No published adventure:** `hidePanes: ['adventure']`, the Scenes arc keyed `saga` (upstream decision 22); the GM page opens on Scenes · Party · Inspector. `ownAdventure` (an L5R5e key) is not set: the Coyote & Crow VTT does not read it | The saga is its own adventure; Station 54 was never played |
| 2026-09-27 | autonomous, fidelity | **Chronicle facts left out as table illustration**: the Story Guide's anecdote about strangers in a mob bar (told to colour Sign's luck, not as an event); the transcript's "grandmother" as a name for the wrist device (unclear); who is legally responsible for the barge | Not events in the recording |
| 2026-09-27 | autonomous, fidelity | **Pronouns from the record**: Sign *she* (her player, sessions 1–2; the prep note); Tika *he*; Choyan unstated, so *they*; the attending healer and the colleague unnamed and ungendered | Owner rule: never infer from a name |
| 2026-09-27 | autonomous, fidelity | **Suva's daughter is dead** in the chronicle (Grandmother's and Suva's own words in sessions 2–3); session 1 once says she went missing with Zibizin. Recorded as OPEN on Zibizin's GM entry | The later sessions and Grandmother agree |
| 2026-09-27 | autonomous, fidelity | **Paths**: Suva *Path of the Snake* ("pack of the steak" in the transcript; OPEN), Sign *Beaver*, Datsu and Tika *Raccoon*, Wasawi *Fox*. Makatooka's Path was never said; Tika's Motivation was not heard clearly; both left blank | Only what the table said |
| 2026-09-27 | autonomous, scope | **Wasawi is a companion, not a party seat**: a page in The Travellers, not a member on the Party pane | Her player's own framing (Suva's companion) |
| 2026-09-27 | autonomous, scope | **The prep note is quoted word for word** in the Overview (`campaign/source/prep-note.txt`, byte-identical to the download: sha256 `47e09b9e3ae2f86b…` both); what it plans is in Scenes (*Next*) and Threads, tagged YOURS | The Story Guide's own words; no players' names in it (checked) |
| 2026-09-27 | autonomous, privacy | **No player's real name anywhere in the repo**: `grep -iw` for every name heard at the table over `campaign/`, `engine/config.js` and `README.md` → 0 | Personal data, not campaign material |
| 2026-09-27 | autonomous, look | **Mesa sandstone and crow indigo**: `campaign/site/campaign.css` re-points the VTT's tokens (`--teal` → red rock, `--clay` → indigo, `--night`, `--paper`, `--card`, `--line`) in both schemes; no art (the saga has none on disk) | An instance never edits upstream files |

## To add a session

Write `campaign/docs/chronicle/NN-<slug>.md` from its recording (front matter `title`, `part`), add any new
person under `campaign/docs/people/` (and to `SAGA_NAMES`), add new GM material to `campaign/source/gm.md`
under new ids (the seed never overwrites what the Story Guide changed in the tabs), then
`bash campaign/build/build.sh`.
