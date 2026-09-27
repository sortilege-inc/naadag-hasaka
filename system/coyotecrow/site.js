// system/coyotecrow/site.js — what Coyote & Crow puts on the site: the book, and the game's
// own lists across it — the Icons and Legends, the six pregenerated Characters, the options a
// Character is made from (Paths, Archetypes, Motivations, Stats, Skills, Abilities, Gifts and
// Burdens), the Equipment, the adventure, the Chahi glossary — the D12 dice, and search. Every
// word shown comes from titterpig-dsl-coyotecrow/0.5 through data/; this file decides only what
// is listed where. The book reader and its outline are ported from sortilege-vtt-l5r5e.
window.VttSiteTabs = (function () {
  const { el, debounce } = window.VttRender;
  const D = window.CnCData;
  const E = window.CnCEntity;
  const Dice = window.CnCDice;
  const Site = () => window.VttSite;

  // a link inside any rendered entity opens it in the reader, loading its book first
  window.CnCOpenEntity = (id) => {
    const e = D.entity(id);
    const r = e || D.records().find((x) => x.id === id);
    if (r) Site().go('book', [r.book, id]);
  };

  const page = (container) => {
    const p = el('div', { class: 'page' });
    container.appendChild(p);
    return p;
  };
  const loading = (p, what) => p.appendChild(el('div', { class: 'muted loading' }, ['Opening ' + what + '…']));
  function after(p, ids, fn) {
    const note = loading(p, Array.isArray(ids) ? ids.map(D.label).join(', ') : D.label(ids));
    D.ensure(ids).then(() => { note.remove(); fn(); }).catch((e) => {
      console.error(e);
      p.appendChild(el('div', { class: 'empty' }, ['Could not show this: ' + e.message]));
    });
  }
  // `campaign` is an instance's own layer (build/build_layer.py) — its homebrew, shelved first.
  const KIND_ORDER = { campaign: -1, book: 0, adventure: 1 };
  const KIND_LABEL = { campaign: 'This saga', book: 'Rules and setting', adventure: 'The books' };
  const openRow = (r) => el('a', { class: 'ref', href: '#book/' + encodeURIComponent(r.book) + '/' + encodeURIComponent(r.id) }, [r.name]);
  const uniq = (xs) => Array.from(new Set(xs.filter((x) => x != null && x !== ''))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

  // ── the book ───────────────────────────────────────────────────────
  function renderShelf(container, ctx) {
    const p = page(container);
    const idx = D.index();
    p.appendChild(el('div', { class: 'masthead' }, [
      el('h1', {}, ['The book']),
      el('p', { class: 'muted' }, ['Generated from its corpus: ' + idx.counts.entities.toLocaleString() + ' entries out of ' + idx.counts.files + ' files. Open it.']),
    ]));
    const groups = {};
    D.books().forEach((b) => (groups[b.kind] = groups[b.kind] || []).push(b));
    Object.keys(groups).sort((a, b) => (KIND_ORDER[a] || 0) - (KIND_ORDER[b] || 0)).forEach((k) => {
      p.appendChild(el('h2', { class: 'shelf-h' }, [KIND_LABEL[k] || k]));
      p.appendChild(el('div', { class: 'shelf' }, groups[k].map((b) => el('a', { class: 'shelf-book', href: ctx.href('book', [b.id]) }, [
        el('div', { class: 'shelf-title' }, [b.label]),
        el('div', { class: 'muted small' }, [b.counts.chapters + ' chapters · ' + b.counts.entities.toLocaleString() + ' entries · ' + Math.round(b.bytes / 1024) + ' KB']),
      ]))));
    });
  }

  function chapterLink(bid, c, ctx, active) {
    return el('a', { class: 'ref' + (active ? ' active' : ''), href: ctx.href('book', [bid, 'ch:' + c.file]) }, [D.shortTitle(c), el('span', { class: 'kindtag' }, [c.kind])]);
  }
  function tree(bid, list, ctx, openId) {
    return el('ul', { class: 'toc' }, list.map((e) => {
      const kids = D.children(e.id);
      const a = el('a', { class: 'ref' + (e.id === openId ? ' active' : ''), href: ctx.href('book', [bid, e.id]) }, [e.name]);
      if (!kids.length) return el('li', {}, [a]);
      const open = openId && (e.id === openId || D.ancestors(openId).some((x) => x.id === e.id));
      return el('li', {}, [el('details', { open: open || null }, [el('summary', {}, [a]), tree(bid, kids, ctx, openId)])]);
    }));
  }
  // The outline groups the chapters the way the book is bound: its sections, then the Icons,
  // the adventure and its pregens, then the types the corpus declares.
  function chapterGroups(bid) {
    const cs = D.chapters(bid);
    const g = [
      { label: 'The book', test: (c) => c.kind === 'ttrpg' && c.page != null },
      { label: 'Icons and Legends', test: (c) => /^icons\//.test(c.file) },
      { label: 'The adventure', test: (c) => c.kind === 'arc' },
      { label: 'Sample Characters', test: (c) => /^pregens\//.test(c.file) },
      { label: 'Types and vocabulary', test: (c) => c.kind === 'ttrpg' && c.page == null },
    ];
    const seen = new Set();
    const out = g.map((x) => ({ label: x.label, chapters: cs.filter((c) => !seen.has(c) && x.test(c) && seen.add(c)) }));
    const rest = cs.filter((c) => !seen.has(c));
    if (rest.length) out.push({ label: 'Other', chapters: rest });
    return out.filter((x) => x.chapters.length);
  }

  function renderBook(container, path, ctx) {
    const bid = path[0] && D.indexBook(path[0]) ? path[0] : D.books().length === 1 ? D.books()[0].id : null;
    if (!bid) return renderShelf(container, ctx);
    const p = page(container);
    const meta = D.indexBook(bid);
    after(p, bid, () => {
      const target = path[0] === bid ? path[1] || null : null;
      const chFile = target && target.indexOf('ch:') === 0 ? target.slice(3) : null;
      const e = target && !chFile ? D.entity(target) : null;
      const openCh = chFile || (e ? e.file : null);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('book', [bid]) }, [meta.label]),
        e ? D.ancestors(e.id).map((a) => [' › ', el('a', { href: ctx.href('book', [bid, a.id]) }, [a.name])]) : null]));
      const q = el('input', { type: 'search', class: 'search', placeholder: 'Search the book…' });
      const results = el('div', { class: 'results' });
      q.addEventListener('input', debounce(() => showHits(results, q.value.trim(), [bid], ctx), 250));
      const toc = el('div', { class: 'site-toc' }, [q, results].concat(chapterGroups(bid).map((grp) => el('div', { class: 'toc-group' }, [
        el('div', { class: 'toc-phase' }, [grp.label]),
        el('ul', { class: 'toc chapters' }, grp.chapters.map((c) => {
          const roots = (c.roots || []).map(D.entity).filter(Boolean);
          const here = c.file === openCh;
          // a chapter of one entry opens on that entry
          const kids = roots.length === 1 ? D.children(roots[0].id) : roots;
          return el('li', {}, [kids.length
            ? el('details', { open: here || null }, [el('summary', {}, [chapterLink(bid, c, ctx, chFile === c.file)]), tree(bid, kids, ctx, e ? e.id : null)])
            : chapterLink(bid, c, ctx, chFile === c.file)]);
        })),
      ]))));
      let body;
      if (e) body = entryPage(e, ctx);
      else if (chFile) body = chapterPage(bid, D.chapter(bid, chFile), ctx);
      else body = bookFront(bid, meta, ctx);
      p.appendChild(el('div', { class: 'reader' }, [toc, el('div', { class: 'site-reader' }, [body])]));
    });
  }

  // An entry with a large subtree (a chapter, a section banner) shows its own text and a
  // contents list of what it holds; a small one shows everything beneath it in place.
  const WHOLE_UP_TO = 40;
  function descendants(e) {
    let n = 0;
    const stack = (e.children || []).slice();
    while (stack.length && n <= WHOLE_UP_TO) {
      const k = D.entity(stack.pop());
      if (!k) continue;
      n++;
      stack.push.apply(stack, k.children || []);
    }
    return n;
  }
  function entryPage(e, ctx) {
    if (descendants(e) <= WHOLE_UP_TO) return E.render(e);
    const kids = D.children(e.id);
    return el('div', {}, [
      E.render(e, { noKids: true, shallow: true }),
      kids.length ? el('div', { class: 'contents' }, [
        el('h4', {}, ['In this section']),
        el('ul', { class: 'items' }, kids.map((x) => el('li', {}, [el('a', { class: 'ref', href: ctx.href('book', [e.book, x.id]) }, [x.name]), x.type ? el('span', { class: 'etype' }, [x.type]) : null]))),
      ]) : null,
    ]);
  }

  function bookFront(bid, meta, ctx) {
    const mods = D.moduleList().filter((m) => m.book === bid);
    return el('div', {}, [
      el('h2', {}, [meta.label]),
      mods.length ? el('p', {}, ['The adventure: ', mods.map((m, i) => [i ? ', ' : null, ctx.isOpen('adventures')
        ? el('a', { class: 'ref', href: ctx.href('adventures', [m.id]) }, [m.name]) : m.name])]) : null,
      chapterGroups(bid).map((grp) => [
        el('h4', {}, [grp.label]),
        el('ul', { class: 'items' }, grp.chapters.map((c) => el('li', {}, [chapterLink(bid, c, ctx), c.page ? el('span', { class: 'muted small' }, [' · from page ' + c.page]) : null]))),
      ]),
    ]);
  }

  // A chapter: its own top-level blocks (an arc's FLOW and SCENEs) and its entities in order.
  function chapterPage(bid, c, ctx) {
    if (!c) return el('div', { class: 'empty' }, ['No such chapter.']);
    const roots = (c.roots || []).map(D.entity).filter(Boolean);
    // a chapter of one entry is that entry
    if (roots.length === 1 && !(c.blocks || []).some((b) => !('ent' in b))) return entryPage(roots[0], ctx);
    const loose = D.guidanceLoose(c.file);
    const top = (c.blocks || []).filter((b) => !('ent' in b));
    return el('div', {}, [
      el('h2', {}, [D.chapterTitle(c)]),
      el('div', { class: 'muted small' }, [c.file + (c.page ? ' · from page ' + c.page : '')]),
      c.kind === 'arc' && ctx.isOpen('adventures') ? el('p', {}, [el('a', { class: 'btn ghost', href: ctx.href('adventures', [D.moduleId(c.file)]) }, ['Open it as an adventure →'])]) : null,
      top.length ? E.nodes(top, bid) : null,
      E.guidance(loose, bid),
      roots.length ? el('div', { class: 'contents' }, [
        el('h4', {}, ['In this chapter']),
        el('ul', { class: 'items' }, roots.map((x) => el('li', {}, [el('a', { class: 'ref', href: ctx.href('book', [bid, x.id]) }, [x.name]), x.type ? el('span', { class: 'etype' }, [x.type]) : null]))),
      ]) : null,
    ]);
  }

  function showHits(results, term, bookIds, ctx) {
    results.innerHTML = '';
    if (term.length < 2) return;
    const hits = D.search(term, bookIds, 2000);
    const shown = hits.slice(0, 80);
    results.appendChild(el('div', { class: 'muted small' }, [hits.length + ' hits' + (hits.length > shown.length ? ' — the first ' + shown.length : '')]));
    shown.forEach((h) => {
      const ex = D.excerpt(h, term, 60);
      results.appendChild(el('div', { class: 'hit' }, [
        el('a', { class: 'ref', href: ctx.href('book', [h.book, h.id]) }, [h.name]),
        h.type ? el('span', { class: 'etype' }, [h.type]) : null,
        ex ? el('div', { class: 'muted small' }, [ex]) : null,
      ]));
    });
  }

  // ── a filterable list over records ─────────────────────────────────
  function recordList(p, rows, opts) {
    const state = opts.state;
    const q = el('input', { type: 'search', class: 'search', placeholder: opts.placeholder, value: state.q || '' });
    const filters = (opts.filters || []).map((f) => {
      const sel = el('select', { class: 'scope' });
      sel.appendChild(el('option', { value: '' }, [f.all]));
      f.values(rows).forEach((v) => sel.appendChild(el('option', { value: v, selected: state[f.key] === v || null }, [f.label ? f.label(v) : String(v)])));
      sel.addEventListener('change', () => { state[f.key] = sel.value; draw(); });
      return sel;
    });
    const count = el('span', { class: 'muted small' });
    const out = el('div', {});
    function draw() {
      const t = (state.q || '').toLowerCase();
      const hit = rows.filter((r) => (!t || opts.text(r).toLowerCase().indexOf(t) !== -1) && (opts.filters || []).every((f) => !state[f.key] || String(f.get(r)) === state[f.key]));
      count.textContent = hit.length + ' of ' + rows.length;
      out.innerHTML = '';
      out.appendChild(opts.draw(hit));
    }
    q.addEventListener('input', debounce(() => { state.q = q.value.trim(); draw(); }, 150));
    p.appendChild(el('div', { class: 'chiprow filters' }, [q].concat(filters, [count])));
    p.appendChild(out);
    draw();
  }

  // ── a list with its entry beside it: the Icons, the pregens, the options ─
  // path[0] is the open entry's id; the list is records (no book needed to draw it), the entry
  // loads its book.
  function listAndEntry(p, rows, path, ctx, tabId, groupOf) {
    const id = path[0] && rows.some((r) => r.id === path[0]) ? path[0] : null;
    const groups = {};
    const order = [];
    rows.forEach((r) => {
      const g = groupOf ? groupOf(r) : '';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(r);
    });
    const toc = el('div', { class: 'site-toc' }, order.map((g) => el('div', { class: 'toc-group' }, [
      g ? el('div', { class: 'toc-phase' }, [g]) : null,
      el('ul', { class: 'toc' }, groups[g].map((r) => el('li', { class: r.depth ? 'sub' : null }, [el('a', { class: 'ref' + (r.id === id ? ' active' : ''), href: ctx.href(tabId, [r.id]) }, [r.name]),
        (r.fields || {}).Type ? el('span', { class: 'kindtag' }, [(r.fields || {}).Type]) : null]))),
    ])));
    const body = el('div', { class: 'site-reader' });
    p.appendChild(el('div', { class: 'reader' }, [toc, body]));
    const r = rows.find((x) => x.id === id) || rows[0];
    if (!r) return;
    after(body, r.book, () => {
      const e = D.entity(r.id);
      if (e) body.appendChild(E.render(e));
    });
  }

  // ── the Icons and Legends ──────────────────────────────────────────
  // Grouped as the book prints them: each entry of the chapter, its sub-entries beneath it
  // (People of Cahokia's Children, Elders…), the Legends one by one.
  function renderIcons(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Icons and Legends']));
    const all = D.icons();
    const tops = all.filter((r) => !r.under || !all.some((x) => x.name === r.under));
    const rows = [];
    tops.forEach((t) => {
      rows.push(t);
      all.filter((r) => r.under === t.name && r !== t).forEach((r) => rows.push(Object.assign({ depth: 1 }, r)));
    });
    p.appendChild(el('p', { class: 'muted' }, [all.length + ' entries of the corpus’s ', el('code', {}, ['Icon']), ' type — the people, animals and Legends of the Icons and Legends chapter, and the characters of the adventure.']));
    // grouped by where the book prints them: the Icons and Legends chapter, or the adventure
    const mods = D.moduleList();
    listAndEntry(p, rows, path, ctx, 'icons', (r) => (r.kind === 'arc' && mods.length ? 'In ' + mods[0].name : 'Icons and Legends'));
  }

  // ── the pregenerated Characters ────────────────────────────────────
  function renderPregens(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Sample Characters']));
    const rows = D.pregens();
    p.appendChild(el('p', { class: 'muted' }, [rows.length + ' Characters printed with ', el('i', {}, [D.moduleList().map((m) => m.name).join(', ')]), ', each an instance of the corpus’s ', el('code', {}, ['Character']), ' type.']));
    listAndEntry(p, rows, path, ctx, 'characters', null);
  }

  // ── what a Character is made from ──────────────────────────────────
  // Each set is a type the BASE declares, in the order Steps to Creating a Character takes them.
  const OPTIONS = [
    { type: 'Motivation', label: 'Motivations' },
    { type: 'Archetype', label: 'Archetypes' },
    { type: 'Path', label: 'Paths' },
    { type: 'Gift or Burden', label: 'Gifts and Burdens' },
    { type: 'Stat', label: 'Stats' },
    { type: 'Skill', label: 'Skills' },
    { type: 'Ability', label: 'Abilities', group: (r) => r.under },
    { type: 'Derived Stat', label: 'Derived Stats' },
  ];
  function renderOptions(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Character options']));
    const rows = [];
    OPTIONS.forEach((o) => D.typed(o.type).forEach((r) => rows.push(Object.assign({ _group: o.group ? o.label + ' · ' + o.group(r) : o.label }, r))));
    p.appendChild(el('p', { class: 'muted' }, ['The sets ', el('i', {}, ['Steps to Creating a Character']), ' draws on, in its order.']));
    listAndEntry(p, rows, path, ctx, 'options', (r) => r._group);
  }

  // ── Equipment ──────────────────────────────────────────────────────
  const eqState = { q: '' };
  function renderEquipment(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Equipment']));
    after(p, 'core', () => {
      const rows = D.typed('Equipment').map((r) => {
        const e = D.entity(r.id);
        return Object.assign({ cls: (r.fields || {}).Class || r.under || '', cost: (r.fields || {})['Cost Rank'] || '', printed: D.text(e, 'Printed') || '' }, r);
      });
      recordList(p, rows, {
        state: eqState, placeholder: 'Find an item…',
        text: (r) => r.name + ' ' + r.cls + ' ' + r.printed,
        filters: [
          { key: 'cls', all: 'Every class', values: (rs) => uniq(rs.map((r) => r.cls)), get: (r) => r.cls },
          { key: 'cost', all: 'Every Cost Rank', values: (rs) => uniq(rs.map((r) => r.cost)), label: (v) => 'Cost Rank ' + v, get: (r) => r.cost },
        ],
        draw: (hit) => el('div', { class: 'table-wrap' }, [el('table', { class: 'printed list' }, [
          el('thead', {}, [el('tr', {}, [el('th', {}, ['Item']), el('th', {}, ['Class']), el('th', {}, ['Cost Rank']), el('th', {}, ['Notes'])])]),
          el('tbody', {}, hit.map((r) => el('tr', {}, [
            el('td', {}, [openRow(r)]), el('td', {}, [r.cls]), el('td', {}, [r.cost]), el('td', { class: 'small' }, [r.printed ? E.span(r.printed, r.book) : '']),
          ]))),
        ])]),
      });
    });
  }

  // ── the adventure ──────────────────────────────────────────────────
  function renderAdventures(container, path, ctx) {
    const p = page(container);
    const mods = D.moduleList();
    const ref = (path[0] && mods.find((m) => m.id === path[0])) || (mods.length === 1 ? mods[0] : null);
    if (!ref) {
      p.appendChild(el('h1', {}, ['Adventures']));
      p.appendChild(el('div', { class: 'shelf' }, mods.map((m) => el('a', { class: 'shelf-book', href: ctx.href('adventures', [m.id]) }, [el('div', { class: 'shelf-title' }, [m.name])]))));
      return;
    }
    after(p, ref.book, () => {
      const m = D.module(ref.id);
      const sid = path[0] === ref.id ? path[1] || null : null;
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('adventures', [m.id]) }, [m.name])]));
      // a phase of one scene of the same name (this adventure's Parts) is shown once, as the scene
      const single = (ph) => ph.scenes.length === 1 && (m.scenes.find((x) => x.id === ph.scenes[0]) || {}).name === ph.name;
      const toc = el('div', { class: 'site-toc' }, [el('ul', { class: 'toc' }, m.phases.map((ph) => el('li', {}, [
        single(ph) ? null : el('div', { class: 'toc-phase' }, [ph.name || 'Other scenes']),
        el('ul', { class: 'toc' }, ph.scenes.map((id) => {
          const s = m.scenes.find((x) => x.id === id);
          return el('li', {}, [el('a', { class: 'ref' + (sid === id ? ' active' : ''), href: ctx.href('adventures', [m.id, id]) }, [s.name])]);
        })),
      ])))]);
      const s = sid && m.scenes.find((x) => x.id === sid);
      p.appendChild(el('div', { class: 'reader' }, [toc, el('div', { class: 'site-reader' }, [s ? scenePage(m, s) : moduleFront(m, ctx)])]));
    });
  }
  function moduleFront(m, ctx) {
    const skip = new Set(['FLOW', 'SCENE', 'PARTS', 'DESCRIPTION', 'DEPENDS_ON']);
    const pregens = D.pregens();
    return el('div', {}, [
      el('h2', {}, [m.name]),
      E.prose(m.desc, 'prose', m.book),
      E.nodes(m.blocks.filter((b) => !skip.has(b.kw)), m.book),
      el('h4', {}, ['The Parts']),
      el('ol', { class: 'items' }, m.phases.map((ph) => el('li', {}, [ph.scenes.map((id, i) => {
        const s = m.scenes.find((x) => x.id === id);
        return [i ? ', ' : null, el('a', { class: 'ref', href: ctx.href('adventures', [m.id, id]) }, [s.name])];
      })]))),
      pregens.length ? el('p', {}, ['Its six sample Characters: ', pregens.map((r, i) => [i ? ', ' : null, el('a', { class: 'ref', href: ctx.href('characters', [r.id]) }, [r.name])])]) : null,
    ]);
  }
  function scenePage(m, s) {
    return el('div', {}, [
      el('h2', {}, [s.name]),
      s.block ? E.nodes(s.block.body, m.book) : null,
    ]);
  }

  // ── the Chahi glossary ─────────────────────────────────────────────
  const glossState = { q: '' };
  function renderGlossary(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Chahi : English']));
    after(p, 'core', () => {
      const rows = D.typed('Glossary Entry').map((r) => {
        const e = D.entity(r.id);
        return Object.assign({ term: D.text(e, 'Term') || r.name, def: D.text(e, 'Definition') || '' }, r);
      });
      recordList(p, rows, {
        state: glossState, placeholder: 'A Chahi word, or an English one…',
        text: (r) => r.term + ' ' + r.def,
        filters: [{ key: 'letter', all: 'Every letter', values: (rs) => uniq(rs.map((r) => r.term.charAt(0).toUpperCase())), get: (r) => r.term.charAt(0).toUpperCase() }],
        draw: (hit) => el('dl', { class: 'glossary' }, hit.map((r) => [el('dt', {}, [r.term]), el('dd', {}, [E.span(r.def, r.book)])])),
      });
    });
  }

  // ── the dice ───────────────────────────────────────────────────────
  function renderDice(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['The D12 System']));
    after(p, 'core', () => {
      const log = el('div', { class: 'roll-log' });
      p.appendChild(Dice.roller({ onResolve: (r) => log.prepend(Dice.logLine(Dice.logEntry(r, 'You'))) }));
      p.appendChild(log);
      p.appendChild(el('p', { class: 'muted small' }, ['After the roll, ▲ and ▼ move a Standard die: first with Legendary Rank, then with Focus (a point of Mind each). A 1 is a Fail and cannot move. Each 12 then rolls a Critical die, and each Critical 12 another.']));
      const rules = Dice.rulesEntity();
      if (rules) p.appendChild(E.render(rules));
    });
  }

  // ── search everywhere ──────────────────────────────────────────────
  const searchState = { q: '' };
  function renderSearch(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Search the book']));
    const results = el('div', { class: 'results' });
    const q = el('input', { type: 'search', class: 'search wide', placeholder: 'A rule, an Icon, a word…', value: searchState.q });
    const ids = D.books().map((b) => b.id);
    const run = () => {
      results.innerHTML = '';
      if (searchState.q.length < 2) return;
      D.ensure(ids).then(() => showHits(results, searchState.q, ids, ctx));
    };
    q.addEventListener('input', debounce(() => { searchState.q = q.value.trim(); run(); }, 300));
    p.appendChild(el('div', { class: 'chiprow' }, [q]));
    p.appendChild(results);
    if (searchState.q) run();
    setTimeout(() => q.focus(), 0);
  }

  // `books: true` marks the book's own text — closed on the public site by default (PLAYBOOK §4b.4)
  const tabs = [
    { id: 'book', label: 'The book', render: renderBook, books: true },
    { id: 'icons', label: 'Icons & Legends', render: renderIcons },
    { id: 'characters', label: 'Characters', render: renderPregens },
    { id: 'options', label: 'Character options', render: renderOptions },
    { id: 'equipment', label: 'Equipment', render: renderEquipment },
    { id: 'adventures', label: 'Adventure', render: renderAdventures, books: true },
    { id: 'glossary', label: 'Glossary', render: renderGlossary },
    { id: 'dice', label: 'Dice', render: renderDice },
    { id: 'search', label: 'Search', render: renderSearch, books: true },
  ];
  // the creator adds its tab when it is loaded; it is not the books' text, so it stays with them off
  if (window.CnCCreator) tabs.splice(3, 0, { id: 'create', label: 'Make a Character', render: (main, path, ctx) => window.CnCCreator.render(page(main), path, ctx) });
  return tabs;
})();
