# Naadag Hasaka × sortilege-vtt-coyotecrow — plan and decision log

A **Coyote & Crow** saga played in spring 2023, in Cahokia in the year 710: the ten-day Seeing of
Grandmother Naadag, an elder of the Diné Republic who chose the day of her own death, and the journey
west her last request begins. Three sessions were recorded. Built as an **instance** of
`sortilege-vtt-coyotecrow` (`~/Sortilege/VTT/INSTANCES.md`, PLAYBOOK §4/§4b). *Naadag Hasaka* is Chahi
for *Crow Mesa* (the book's glossary: *Naadag*, crow; *Hasaka*, mesa).

**This repo depends on `sortilege-vtt-coyotecrow` only.** Every script under `campaign/` is its own;
nothing reads another campaign repo.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and proven.

- **here** — `sortilege-inc/naadag-hasaka` (**PUBLIC on GitHub, empty; nothing pushed** — P4).
- **upstream** — `sortilege-inc/sortilege-vtt-coyotecrow` (private), remote `upstream`.

## What is on disk (read 2026-09-27)

The only source is `~/Downloads/2023 Naadag Hasaka/` (147 MB), **kept outside the repo**: the
recordings and transcripts carry the players' names and the table's talk.

| Folder | What it is | Words |
|---|---|---|
| *Coyote & Crow Session 1* | .m4a + auto-transcript: character introductions and the Story Guide's questions; the Seeing explained; Sign's vision and the ride; day 1 | 17,673 |
| *Coyote & Crow 2* | .m4a + transcript: recap; days 2–4 (Ninosh, the colleague, Wasawi in the forest, the uncles, the gifts, the feast, the life told with gaps, the speeches). **The transcript stops mid-sentence** before Grandmother's private meeting | 11,813 |
| *Coyote & Crow 3* | .m4a + transcript: recap (the box for the Diné Republic, the song map); Tika joins; kalera root defined; days 5–10 | 21,358 |
| *Coyote & Crow Notes* | .m4a + transcript: the Story Guide's spoken prep note for session 4 | 303 |

The transcripts are machine-made: two to ten speaker labels a session that do not map to people,
crosstalk and household talk interleaved, and every proper name spelled several ways. The session
dates are not stated; session 3 set the next game for "Friday the 19th".

**No character numbers exist as a sheet.** A few Ranks and Stats were said aloud in play; they are
recorded in the Story Guide's notes on each character, marked as heard, and nothing is put on a sheet.

## Decisions

The owner declined a round of questions on 2026-09-27 and let the build go ahead; these are the
recommended defaults, taken autonomously and listed for audit. Each is a one-line change to reverse.

**P1 — Names: the spellings in the Overview's *Names still to confirm* (autonomous, content — for the
owner's check).** Suva, Sign, Datsu, Makatooka, Wasawi, Zibizin, Ninosh, *kalera root*; Tika, Yohipa
and Choyan as spelled out at the table; Grandmother Naadag and the setting's words as the book spells
them. A name used on a public page must be in `SAGA_NAMES` (`campaign/build/build_docs.py`) or printed in
the book, so a correction is a find-and-replace in `campaign/docs/` and `campaign/source/gm.md` plus
that one list.

**P2 — Makatooka's lost child is the Story Guide's only (autonomous, privacy — for the owner's
check).** Her miscarriage, her day-5 vision and the prep note's "oracle" are in the Story Guide's notes
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

**P4 — Local only (autonomous, publication).** Nothing is pushed: the GitHub repo is public, and the
first push publishes upstream's `data/` (the Coyote & Crow book text). Pages and the Worker deploy wait for
the owner.

## Milestones

| # | What | Proof |
|---|---|---|
| **M1** | The fork | landed 2026-09-27 (`7a07cc7`): `main` = upstream `main` (`b7166d1`) + the instance commit. **Boundary proven by making it fail** in a throwaway clone: a fake upstream commit to `engine/config.js` and `index.html` merged without the driver → `CONFLICT (content): Merge conflict in engine/config.js`; with `merge.ours.driver true` → merged clean, the title stayed *Naadag Hasaka*, `index.html` took upstream's line |
| **M2** | The public pages — `campaign/docs/` → `campaign/build/build_docs.py` → `campaign/data/docs.js`; `campaign/site/site.js`, `campaign.css` | landed 2026-09-27: home, 3 chapters, 6 travellers, 6 people, 5,882 words. Gates: names, private, links, words both ways. **Each proven by a planted fault**: *Enosh* for Ninosh → `names neither the saga nor the books use — ['Enosh']`; "oracle" on Makatooka's page → `tells what is kept in the Story Guide's notes`; a converter that drops emphasis → `words differ … ['crow', 'hasaka', 'mesa']`; Choyan in chapter 4 → `chapter 4 does not exist`. Browser on 8754: tabs *Naadag Hasaka · The Chronicle · The Travellers · Dramatis Personae* ahead of the VTT's (books off); Sign's page with *Path of the Beaver* linking to the book's entry, which opens with the books closed; chapter pages with contents and turn links; the mesa/indigo tokens loaded after the system's; at 375 px no sideways scroll (scrollWidth 375 on a chapter and the party list). Only console error: Google Fonts blocked by the browser pane (upstream's font link) |
| **M3** | The Story Guide's material — `campaign/source/gm.md` + `prep-note.txt` → `campaign/build/build_seed.py` → `campaign/pack/seed.json` (`defaultCampaign.seed`) | landed 2026-09-27: overview 5, rulings 4, people 9, notes on the characters 6, places 4, threads 12, scenes 8 (6 played, 2 prepped), party 5; 3,174 words, every one in the pack. Gates: unique ids, every `about` a party member, the source's words re-read against the pack. **Proven by planted faults**: a parser that drops subsections → words differ; `about: Tikka` → not in the party; and the real clash it caught on first run (members and notes both `nh-pc-*`). Browser: after the gate, `seeded` 80 ids; nav *Inspector Party · Scenes Threads · Overview People Places · Icons Rules & Book Dice Log · Saga Settings* (no Adventure); Scenes grouped *Session 1–3, Next*; Party lists Suva … Tika with Archetype · Path · Motivation, Body/Mind/Soul "—"; Suva's sheet opens in the Inspector |
| M4 | The characters' numbers | **waits on the owner**: no sheets exist; the Stats heard in play are in the notes |
| M5 | Deploy — push, Pages, the Worker `naadag-hasaka` | **waits on the owner** (P4) |

## Decision log

| When | Kind | Decision | Why |
|---|---|---|---|
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
