// system/coyotecrow/data.js — accessors over the generated corpus (window.COYOTECROW from
// data/*.js). Ported from sortilege-vtt-l5r5e (system/l5r5e/data.js), whose build this repo
// shares; the lore graph and the L5R lists are left out, the Coyote & Crow lists added.
// This is the only file that knows the data's shape; the reader, the panels, the dice, the
// sheet and the creator ask here.
//
// Three things about this corpus the accessors carry for everyone else:
//
//   * The data is a lossless dump (build_data.py): an entity's named fields (desc, props,
//     rules, table…) plus `blocks`, every other node in corpus order — a keyword as
//     {kw, args, body}, a numbered row as {num, args, body}, a string as {s}, a nested entity
//     as {ent}. An argument is {s} string, {c} caret name, {h} hash, {i} integer, {b} bool,
//     {w} bare word, {l} list. `arg()` reads one as a plain value.
//   * Books load on demand (engine/data.js). `records` (data/records.js) lists every typed
//     entity, technique and codex node with its book, so a list view never loads a book; a
//     detail view calls `ensure(book)` first.
//   * Some things the corpus prints APART from what they concern, and are joined here at load:
//     GUIDANCE sidebars (CONCERNS a hash), MODIFYs (an instance's house rules, naming a target),
//     and the .arc's scenes (read into modules below).
window.CnCData = (function () {
  const EMPTY = { books: {}, entities: {}, loaded: {}, index: { books: [], counts: {} }, records: [] };
  const T = () => window.COYOTECROW || EMPTY;
  const Data = () => window.VttData;

  const index = () => T().index || { books: [], counts: {} };
  const books = () => (index().books || []).slice();
  const indexBook = (id) => (index().books || []).find((b) => b.id === id) || null;
  const book = (id) => T().books[id] || null;
  const entity = (id) => T().entities[id] || null;
  const records = () => T().records || [];
  const loaded = (id) => !!book(id);

  // ── loading ────────────────────────────────────────────────────────
  // Every loaded book re-indexes what joins across books (sidebars, corrections, names).
  let indexedFor = '';
  // The errata come with every book (97 KB), so a correction always shows beside its target — and
  // so does an instance's campaign layer (build/build_layer.py), whose house rules are corrections
  // of the same kind: loaded only on demand, a house rule would appear beside its rule or not
  // depending on what the page happened to have loaded first.
  const ALWAYS = books().filter((b) => b.kind === 'errata' || b.kind === 'campaign').map((b) => b.id);
  function ensure(ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter((x) => x && indexBook(x));
    if (list.length) ALWAYS.forEach((x) => list.indexOf(x) === -1 && list.push(x));
    return Data().ready(list).then(() => reindex());
  }
  const ensureAll = () => ensure(books().map((b) => b.id));
  const coreFirst = (ids) => ensure(['core'].concat(ids || []));

  // ── arguments and values ───────────────────────────────────────────
  function arg(a) {
    if (a == null) return null;
    if ('s' in a) return a.s;
    if ('c' in a) return a.c;
    if ('i' in a) return a.i;
    if ('b' in a) return a.b;
    if ('w' in a) return a.w;
    if ('l' in a) return a.l.map(arg);
    if ('h' in a) return a.h;
    return null;
  }
  const argText = (a) => (a && ('s' in a || 'c' in a || 'i' in a) ? String(arg(a)) : null);

  function prop(e, name) {
    return (e && (e.props || []).find((p) => p.name === name)) || null;
  }
  // A property's value: the value it is given, else its declared DEFAULT; a list as plain
  // values; a DEF as its property list; a reference as {hash, name}.
  function pval(p) {
    if (!p) return undefined;
    if (p.vk === 'scalar' || p.vk === 'enum') return p.value !== undefined ? p.value : p.default;
    if (p.vk === 'list') return (p.items || []).map(arg);
    if (p.vk === 'ref') return p.ref;
    return p;
  }
  const val = (e, name) => pval(prop(e, name));
  const text = (e, name) => {
    const v = val(e, name);
    return typeof v === 'string' ? v : null;
  };
  const num = (e, name) => {
    const v = val(e, name);
    return typeof v === 'number' ? v : null;
  };
  const blocks = (e, kw) => ((e && e.blocks) || []).filter((b) => b && b.kw === kw);
  const block = (e, kw) => blocks(e, kw)[0] || null;
  // the string a keyword carries: `ACTIVATION "…"`, `RANK 3`
  const kwArg = (e, kw) => {
    const b = block(e, kw);
    return b && b.args && b.args.length ? arg(b.args[0]) : null;
  };
  // A DEF-valued property's fields as {name: value}: a Clan's `Clan Ring Bonus`, a Family's
  // `Skill Increases`. A CHOOSE inside it is returned as {choose: n, of: [names], value}.
  function defFields(p) {
    const out = { fields: {}, choose: [] };
    if (!p || p.vk !== 'def') return out;
    (p.fields || []).forEach((f) => (out.fields[f.name] = pval(f)));
    (p.blocks || []).forEach((b) => {
      if (b.kw !== 'CHOOSE') return;
      const n = b.args.find((a) => 'i' in a);
      const list = b.args.find((a) => 'l' in a);
      const tail = b.args.slice(b.args.indexOf(list) + 1).find((a) => 'i' in a);
      out.choose.push({ choose: n ? n.i : 1, of: list ? list.l.map(arg) : [], value: tail ? tail.i : null });
    });
    return out;
  }

  // ── the tree ───────────────────────────────────────────────────────
  function children(id) {
    const e = entity(id);
    return e ? (e.children || []).map(entity).filter(Boolean) : [];
  }
  function ancestors(id) {
    const out = [];
    let e = entity(id);
    while (e && e.parent) {
      e = entity(e.parent);
      if (e) out.unshift(e);
    }
    return out;
  }
  const top = (bid) => ((book(bid) || {}).entities || []).map(entity).filter(Boolean);
  function all(bookIds) {
    const ids = bookIds && bookIds.length ? bookIds : books().map((b) => b.id);
    const out = [];
    ids.forEach((bid) => {
      const stack = ((book(bid) || {}).entities || []).slice();
      while (stack.length) {
        const e = entity(stack.shift());
        if (!e) continue;
        out.push(e);
        stack.unshift.apply(stack, e.children || []);
      }
    });
    return out;
  }
  const byType = (type, bookIds) => all(bookIds).filter((e) => e.type === type);
  const applies = (e, name) => (e.applies || []).some((a) => a.name === name);

  // A type's declaration: the ACTOR (or DEF) of that name. `declared(type)` walks its EXTENDS
  // chain, root first, so ACTOR "Samurai" reads Entity's Name and Rings, then its own fields.
  function declaration(typeName) {
    const hit = all(['core']).find((e) => e.name === typeName && (e.form === 'ACTOR' || !e.type) && (e.props || []).length);
    return hit || all().find((e) => e.name === typeName && e.form === 'ACTOR') || null;
  }
  function declared(typeName) {
    const chain = [];
    let d = declaration(typeName);
    while (d) {
      chain.unshift(d);
      d = d.type ? declaration(d.type) : null;
      if (d && chain.indexOf(d) !== -1) break;
    }
    const seen = {};
    const props = [];
    chain.forEach((c) => (c.props || []).forEach((p) => {
      if (seen[p.name] != null) props[seen[p.name]] = p;   // a subtype redeclares (Peasant's Rings)
      else {
        seen[p.name] = props.length;
        props.push(p);
      }
    }));
    return { chain, props };
  }

  // ── names → entities ───────────────────────────────────────────────
  // `^"Initiative"` inside a string, a CURRICULUM's `^"Striking as Earth"`: resolved by name,
  // preferring the book the reader is in, then the core, then any loaded book.
  let byName = {};
  function reindexNames() {
    byName = {};
    Object.keys(T().entities).forEach((h) => {
      const e = T().entities[h];
      (byName[e.name] = byName[e.name] || []).push(e);
    });
  }
  function named(name, preferBook) {
    const hits = byName[name] || [];
    if (!hits.length) return null;
    return hits.find((e) => e.book === preferBook && e.form !== 'ENTITY')
      || hits.find((e) => e.book === 'core' && e.form !== 'ENTITY')
      || hits.find((e) => e.form !== 'ENTITY') || hits[0];
  }
  const recordNamed = (name) => records().filter((r) => r.name === name);

  // ── joined across books: sidebars, corrections ─────────────────────
  let guidance = {};      // concerned hash → [ {name, id, topics, text, book, file} ]
  let looseGuidance = {}; // file → [ entries that concern nothing ]
  let corrections = {};   // target hash → [ {op, book, file, name, props, blocks} ]
  function walkBlocks(list, fn) {
    (list || []).forEach((b) => {
      if (!b || typeof b !== 'object') return;
      fn(b);
      if (b.body) walkBlocks(b.body, fn);
    });
  }
  function guidanceEntry(e, book, file) {
    const g = { name: null, id: null, topics: [], text: null, concerns: [], book, file };
    (e.args || []).forEach((a) => {
      if ('c' in a) g.name = a.c;
      if ('h' in a) g.id = a.h;
    });
    (e.body || []).forEach((y) => {
      if (y.kw === 'CONCERNS') g.concerns = (y.args[0] ? y.args[0].l || [] : []).map((a) => ({ hash: a.h || null, name: a.c || null }));
      else if (y.kw === 'TOPICS') g.topics = (y.args[0] ? y.args[0].l || [] : []).map(arg);
      else if (y.kw === 'TEXT') g.text = y.args[0] ? y.args[0].s : null;
    });
    return g;
  }
  function reindex() {
    const key = Object.keys(T().loaded || {}).sort().join('|');
    if (key === indexedFor) return;
    indexedFor = key;
    reindexNames();
    guidance = {};
    looseGuidance = {};
    corrections = {};
    blockNames = {};
    Object.keys(T().books).forEach((bid) => {
      const b = T().books[bid];
      (b.chapters || []).forEach((c) => {
        const visit = (list) => walkBlocks(list, (x) => {
          if (x.kw === 'GUIDANCE') (x.body || []).forEach((en) => {
            if (en.kw !== 'ENTRY') return;
            const g = guidanceEntry(en, bid, c.file);
            if (g.concerns.length) g.concerns.forEach((r) => {
              const target = (r.hash && entity(r.hash)) || named(r.name, bid);
              const k = target ? target.id : '?' + r.name;
              (guidance[k] = guidance[k] || []).push(g);
            });
            else (looseGuidance[c.file] = looseGuidance[c.file] || []).push(g);
          });
        });
        visit(c.blocks);
        // a block that names itself and carries a hash — an arc's `LOCATION ^"…" #h { … }`,
        // `SCENE ^"…" #h` — is what a bare `#h` elsewhere in the file points at
        walkBlocks(c.blocks, (x) => {
          const h = (x.args || []).find((a) => 'h' in a && !('c' in a));
          const nm = (x.args || []).find((a) => 'c' in a);
          if (h && nm && x.body && !blockNames[h.h]) blockNames[h.h] = { name: nm.c, kw: x.kw, book: bid, file: c.file };
        });
        (c.blocks || []).forEach((x) => {
          if (x.kw !== 'MODIFY' && x.kw !== 'OVERRIDE') return;
          const h = (x.args.find((a) => 'h' in a) || {}).h;
          const nm = (x.args.find((a) => 'c' in a) || {}).c;
          (corrections[h || '?' + nm] = corrections[h || '?' + nm] || []).push({ op: x.kw, book: bid, file: c.file, name: nm, target: h, body: x.body || [] });
        });
      });
    });
    Object.keys(T().entities).forEach((h) => {
      const e = T().entities[h];
      (e.guidance || []).forEach((g) => (guidance[h] = guidance[h] || []).push(Object.assign({ book: e.book, file: e.file }, g)));
    });
    modulesCache = null;
  }
  let blockNames = {};
  const blockNamed = (h) => blockNames[h] || null;
  const guidanceFor = (id) => guidance[id] || [];
  const guidanceLoose = (file) => looseGuidance[file] || [];
  const correctionsFor = (id) => corrections[id] || [];
  const allCorrections = () => corrections;
  // A property a MODIFY sets or introduces on an entity — an erratum's corrected number, or an
  // instance's house rule (`MODIFY ^"Portentous Birth" { PROPERTIES { ^"Off-Approach Reroll
  // Dice" INTEGER 1 } }`), which the sheet then honours. The last loaded wins; a target the
  // corpus leaves unhashed is matched by its name, as the pages resolve that name.
  function modified(e, name) {
    if (!e) return undefined;
    const list = (corrections[e.id] || []).concat(named(e.name, e.book) === e ? corrections['?' + e.name] || [] : []);
    let out;
    list.forEach((c) => (c.body || []).forEach((b) => {
      if (b.kw === 'PROPERTIES') (b.body || []).forEach((q) => { if (q.name === name) out = pval(q); });
      if (b.kw === 'SET' && b.args && b.args.length > 1 && b.args[0].c === name) out = arg(b.args[b.args.length - 1]);
    }));
    return out;
  }

  // ── a book's outline: chapters, then the entity tree ───────────────
  // A chapter's title is its NAME (a lore chapter's H1, without the "# "); a file with none
  // is known by its file name.
  function chapterTitle(c) {
    if (c.name) return c.kind === 'lore' ? c.name.replace(/^#\s+/, '') : c.name;
    // an .actor file has no container, so no NAME: it is known by the one entry it holds
    const only = c.roots && c.roots.length === 1 ? entity(c.roots[0]) : null;
    if (only) return only.name;
    return c.file.replace(/^(?:.*\/)?coyotecrow-0\.5-/, '').replace(/\.[a-z]+$/, '');
  }
  // In a list, the part of the title after the system's name the chapter files open with
  // ("Coyote & Crow - Rules of the Game" → "Rules of the Game"); the chapter's own page keeps
  // the whole title.
  function shortTitle(c) {
    return chapterTitle(c).replace(/^Coyote & Crow - /, '');
  }
  const chapters = (bid) => ((book(bid) || {}).chapters || []);
  const chapter = (bid, file) => chapters(bid).find((c) => c.file === file) || null;

  // ── the adventures: each .arc read into a module ───────────────────
  // Two shapes: PARTS { PART n "title" { SCENES [names] DESCRIPTION … } } (14 arcs), or a
  // FLOW of PHASEs whose SCENE_REFs point at SCENE blocks (Dark Tides, The Lost Writer). A
  // PART with no SCENES list is one scene itself (The Topaz Championship prints nine). A
  // scene id is the module id and the scene's own hash, or its part and place.
  let modulesCache = null;
  const moduleId = (file) => file.replace(/^(?:.*\/)?coyotecrow-0\.5-(?:core-)?/, '').replace(/\.arc$/, '');
  function kwText(body, kw) {
    const b = (body || []).find((x) => x.kw === kw);
    return b && b.args[0] ? arg(b.args[0]) : null;
  }
  function kwList(body, kw) {
    const b = (body || []).find((x) => x.kw === kw);
    return b && b.args[0] && b.args[0].l ? b.args[0].l.map(arg) : [];
  }
  function sceneBlock(x, mid) {
    const name = (x.args.find((a) => 'c' in a) || {}).c;
    const h = (x.args.find((a) => 'h' in a) || {}).h;
    return { id: mid + '/' + (h || name), hash: h, name, desc: kwText(x.body, 'DESCRIPTION'), type: kwText(x.body, 'TYPE'), block: x };
  }
  function readModule(bid, c) {
    const mid = moduleId(c.file);
    const top = c.blocks || [];
    const m = {
      id: mid, book: bid, file: c.file, name: c.name || mid,
      desc: kwText(top, 'DESCRIPTION'), summary: kwText(top, 'SUMMARY'), tone: kwText(top, 'TONE'),
      setting: kwText(top, 'SETTING'), players: kwText(top, 'PLAYER_COUNT'), themes: kwList(top, 'THEMES'),
      phases: [], scenes: [], blocks: top,
    };
    const parts = top.find((x) => x.kw === 'PARTS');
    const flow = top.find((x) => x.kw === 'FLOW');
    const sceneBlocks = top.filter((x) => x.kw === 'SCENE').map((x) => sceneBlock(x, mid));
    if (parts) {
      (parts.body || []).filter((p) => p.kw === 'PART').forEach((p) => {
        const n = (p.args.find((a) => 'i' in a) || {}).i;
        const title = (p.args.find((a) => 's' in a) || {}).s;
        const names = kwList(p.body, 'SCENES');
        const ph = { name: title, n, desc: kwText(p.body, 'DESCRIPTION'), block: p, scenes: [] };
        if (names.length) names.forEach((nm, i) => {
          const s = { id: mid + '/' + n + '.' + (i + 1), name: nm, part: ph, index: i + 1 };
          ph.scenes.push(s.id);
          m.scenes.push(s);
        });
        else {
          const s = { id: mid + '/' + n, name: title, desc: ph.desc, part: ph, whole: true };
          ph.scenes.push(s.id);
          m.scenes.push(s);
        }
        m.phases.push(ph);
      });
    }
    if (flow) {
      (flow.body || []).filter((p) => p.kw === 'PHASE').forEach((p, i) => {
        const ph = { name: (p.args.find((a) => 'c' in a) || {}).c, n: i + 1, desc: kwText(p.body, 'DESCRIPTION'), pacing: kwText(p.body, 'PACING'), block: p, scenes: [] };
        (p.body || []).filter((x) => x.kw === 'SCENE_REF').forEach((x) => {
          const h = (x.args.find((a) => 'h' in a) || {}).h;
          const s = sceneBlocks.find((sb) => sb.hash === h);
          if (s && ph.scenes.indexOf(s.id) === -1) ph.scenes.push(s.id);
        });
        m.phases.push(ph);
      });
    }
    sceneBlocks.forEach((s) => {
      m.scenes.push(s);
      if (!m.phases.some((ph) => ph.scenes.indexOf(s.id) !== -1)) {
        let loose = m.phases.find((ph) => ph.loose);
        if (!loose) m.phases.push((loose = { name: null, loose: true, scenes: [] }));
        loose.scenes.push(s.id);
      }
    });
    // the adventure's narrative: the lore file of the same name, or the book's lore whose title
    // names the adventure ("… Bestiary & The Lost Writer" for "The Lost Writer in the City of…")
    const short = String(m.name).split(/ in | — |: /)[0];
    const lores = chapters(bid).filter((x) => x.kind === 'lore');
    m.lore = lores.find((x) => sameStem(x.file, c.file)) || lores.find((x) => x.file.indexOf(mid) !== -1)
      || lores.find((x) => (x.name || '').indexOf(short) !== -1) || null;
    return m;
  }
  const sameStem = (a, b) => a.replace(/\.[a-z]+$/, '') === b.replace(/\.[a-z]+$/, '');
  // Every module in the index (a book with an .arc chapter) — known before its book loads.
  function moduleList() {
    const out = [];
    books().forEach((b) => (b.chapters || []).forEach((c) => {
      if (c.kind === 'arc') out.push({ id: moduleId(c.file), book: b.id, file: c.file, name: c.name || moduleId(c.file) });
    }));
    return out;
  }
  function module(mid) {
    if (!modulesCache) modulesCache = {};
    if (modulesCache[mid]) return modulesCache[mid];
    const ref = moduleList().find((m) => m.id === mid);
    if (!ref || !book(ref.book)) return null;
    const c = chapter(ref.book, ref.file);
    return (modulesCache[mid] = readModule(ref.book, c));
  }
  const scene = (mid, sid) => {
    const m = module(mid);
    return m ? m.scenes.find((s) => s.id === sid) || null : null;
  };

  // ── the game's own lists ───────────────────────────────────────────
  // Every list is a type the BASE declares, read off data/records.js — no book need load.
  const recordsOf = (test) => records().filter(test);
  const typed = (t) => recordsOf((r) => r.type === t);
  // an Icon or Legend — not a pregen (Pregenerated Character EXTENDS Character, not Icon)
  const icons = () => typed('Icon');
  // a published character — not an archived sheet of one (`Version Of`, which the sheet gathers)
  const pregens = () => recordsOf((r) => r.type === 'Pregenerated Character' && !r.versionOf);
  const versionsOf = (id) => recordsOf((r) => r.versionOf === id);

  // ── search ─────────────────────────────────────────────────────────
  function stringsOf(x, out) {
    if (x == null) return out;
    if (typeof x === 'string') out.push(x);
    else if (Array.isArray(x)) x.forEach((y) => stringsOf(y, out));
    else if (typeof x === 'object') Object.keys(x).forEach((k) => {
      if (k === 'id' || k === 'hash' || k === 'h' || k === 'children' || k === 'parent' || k === 'ent' || k === 'rule' || k === 'file' || k === 'book' || k === 'typeHash' || k === 'vk' || k === 'kw' || k === 'w') return;
      stringsOf(x[k], out);
    });
    return out;
  }
  const cache = new Map();
  function searchText(e) {
    let t = cache.get(e.id);
    if (t === undefined) {
      t = stringsOf([e.name, e.desc, e.props, e.rules, e.table, e.blocks, e.guidance], []).join('\n');
      cache.set(e.id, t);
    }
    return t;
  }
  function search(query, bookIds, limit) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = [];
    all(bookIds).forEach((e) => {
      const inName = e.name.toLowerCase().indexOf(q) !== -1;
      if (inName || searchText(e).toLowerCase().indexOf(q) !== -1) hits.push({ e, score: inName ? 0 : 1 });
    });
    hits.sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name));
    return hits.slice(0, limit || 200).map((h) => h.e);
  }
  function excerpt(e, query, n) {
    const t = searchText(e);
    const i = t.toLowerCase().indexOf(String(query).toLowerCase());
    if (i < 0) return null;
    const a = Math.max(0, i - (n || 60));
    const b = Math.min(t.length, i + String(query).length + (n || 60));
    return (a ? '…' : '') + t.slice(a, b).replace(/\n+/g, ' ') + (b < t.length ? '…' : '');
  }

  const label = (bid) => (indexBook(bid) || {}).label || bid;

  return {
    T, index, books, indexBook, book, entity, records, loaded, ensure, ensureAll, coreFirst,
    arg, argText, prop, pval, val, text, num, blocks, block, kwArg, defFields,
    children, ancestors, top, all, byType, applies, declaration, declared, named, recordNamed,
    guidanceFor, guidanceLoose, correctionsFor, modified, blockNamed, allCorrections, reindex,
    chapterTitle, shortTitle, chapters, chapter, moduleList, module, scene, moduleId,
    typed, icons, pregens, versionsOf,
    search, excerpt, label,
  };
})();
