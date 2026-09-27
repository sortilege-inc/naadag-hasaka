# Naadag Hasaka

A **Coyote & Crow** saga played in 2023: a ten-day Seeing in Cahokia for Grandmother Naadag, an elder
of the Diné Republic who has chosen the day of her own death, and the journey west that her last
request sets in motion. *Naadag Hasaka* is Chahi for *Crow Mesa*.

This repo is an **instance** of [`sortilege-vtt-coyotecrow`](https://github.com/sortilege-inc/sortilege-vtt-coyotecrow):
the VTT owns the root (the site at `/`, the Story Guide's table at `/gm/`, the player's page, the
engine, the generated book data); the saga owns `campaign/` and a few per-deployment root files
(`.gitattributes`, `merge=ours`).

```bash
git config merge.ours.driver true        # once per clone — the fork boundary needs it
git fetch upstream && git merge upstream/main   # pull the VTT; a merge, never a rebase
bash campaign/build/build.sh             # rebuild the saga's pages and the Story Guide's seed
```

Local: the launch entries `naadag` (8754) and `naadag-worker` (8804). The plan, the decisions and
the proof of each step are in `campaign/PLAN.md`.
