# sortilege-vtt-coyotecrow

A virtual tabletop for **Coyote & Crow** (Connor Alexander, Coyote & Crow LLC), generated from the
Titterpig corpus `titterpig-dsl-coyotecrow/0.5`: the core rulebook to read, the D12 dice, the
Icons and Legends, the six pregenerated characters, the introductory adventure *Encounter at
Station 54*, and live sessions for players on their own devices.

- `/` — the site: the book, the Icons, the pregens, the adventure, the dice, making a
  character, search. Writes nothing. *(M2)*
- `/gm/` — the Story Guide's table: panels over the saga, the map table (`gm/vtt.html`), the
  player's page (`gm/play.html`). *(M3)*

No build step for the pages; `data/` is generated:

```bash
bash build/build.sh
```

It parses every corpus file, writes `data/`, and gates the result both ways (every string the
corpus prints reaches the data as often as it is printed, and nothing in the data is not in the
corpus), then checks the shapes the site reads against counts taken from the raw corpus.

Local: the launch entries `vtt-coyotecrow` (8745) and `vtt-coyotecrow-worker` (8801). See
`PLAN.md` for the milestones, the decisions and the proof of each.
