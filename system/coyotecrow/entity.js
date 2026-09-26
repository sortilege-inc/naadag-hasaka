// system/coyotecrow/entity.js — one entity, as the book holds it. Ported from
// sortilege-vtt-l5r5e (system/l5r5e/entity.js).
//
// Generic by design: an entity is rendered from its own fields and blocks, in the corpus's
// order, whatever it is — a Skill, an Ability, an Icon, a table, the Character ACTOR — so the
// renderer names almost nothing. Every string shown is the corpus's; the words added are
// labels: a property's name (the corpus's own) and a keyword's. A few shapes get a layout of
// their own because the book prints them so: a Stat Line as the Stats' grid (Aspect by
// Domain, read from the nine Stats themselves) beside the Derived Stats, and the rows of a
// character's Skills, Equipment and Gifts and Burdens as the book prints a line of them.
//
// In text: `^"Name"` is a reference and is shown as the name, linked when the corpus has it;
// **bold** and *italic* are the Markdown marks the conversion carries. The string in data/ is
// untouched.
window.CnCEntity = (function () {
  const { el, esc } = window.VttRender;
  const D = window.CnCData;
  const open = (id) => window.CnCOpenEntity && window.CnCOpenEntity(id);

  // ── text ───────────────────────────────────────────────────────────
  function inline(s, bookId) {
    let h = esc(s);
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<i>$2</i>');
    // ^"Name" (escaped by esc() to ^&quot;Name&quot;): the name, linked when the corpus has it
    h = h.replace(/\^&quot;(.+?)&quot;/g, (m, nm) => {
      const raw = nm.replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      const e = D.named(raw, bookId);
      const r = e ? null : D.recordNamed(raw)[0];
      const id = e ? e.id : r ? r.id : null;
      return id ? '<a class="ref" href="#" data-open="' + esc(id) + '">' + nm + '</a>' : '<span class="refname">' + nm + '</span>';
    });
    return h;
  }
  function wire(node) {
    node.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[data-open]');
      if (!a) return;
      ev.preventDefault();
      open(a.dataset.open);
    });
    return node;
  }
  // \n\n paragraphs, \n line breaks; nothing is added or reflowed
  function prose(text, cls, bookId) {
    if (text == null || text === '') return null;
    const wrap = el('div', { class: cls || 'prose' });
    String(text).split(/\n\s*\n/).forEach((p) => wrap.appendChild(el('p', { html: inline(p, bookId).replace(/\n/g, '<br>') })));
    return wire(wrap);
  }
  const span = (text, bookId, cls) => wire(el('span', { class: cls || null, html: inline(String(text), bookId) }));

  // A reference: a link when the corpus has the target (loaded, or listed in the records),
  // the printed name when it does not.
  function link(ref, bookId) {
    if (!ref) return null;
    const t = (ref.hash && D.entity(ref.hash)) || (ref.name && D.named(ref.name, bookId));
    const r = t ? null : (ref.hash && D.records().find((x) => x.id === ref.hash)) || (ref.name && D.recordNamed(ref.name)[0]);
    const bn = !t && !r && ref.hash ? D.blockNamed(ref.hash) : null;
    const label = ref.name || (t && t.name) || (r && r.name) || (bn && bn.name) || '';
    const id = t ? t.id : r ? r.id : null;
    if (!id) return el('span', { class: 'refname', title: bn ? kwLabel(bn.kw) : null }, [label]);
    return el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); open(id); } }, [label]);
  }

  // ── labels ─────────────────────────────────────────────────────────
  // a keyword as a label: SCHOOL_ABILITY → "School ability"
  const kwLabel = (kw) => kw.charAt(0) + kw.slice(1).toLowerCase().replace(/_/g, ' ');

  // ── arguments ──────────────────────────────────────────────────────
  function argNode(a, bookId) {
    if ('s' in a) return span(a.s, bookId);
    if ('c' in a) return link({ hash: a.h || null, name: a.c }, bookId);
    if ('h' in a) return link({ hash: a.h, name: null }, bookId);
    if ('i' in a) return el('span', { class: 'num' }, [String(a.i)]);
    if ('b' in a) return el('span', {}, [a.b ? 'yes' : 'no']);
    if ('w' in a) return el('span', { class: 'word' }, [a.w]);
    if ('l' in a) return el('span', { class: 'arglist' }, a.l.map((x, i) => [i ? ', ' : null, argNode(x, bookId)]));
    if ('d' in a) return nodes(a.d, bookId);
    return null;
  }
  const args = (list, bookId) => (list || []).map((a, i) => [i ? ' ' : null, argNode(a, bookId)]);

  // ── property values ────────────────────────────────────────────────
  function value(p, bookId) {
    switch (p.vk) {
      case 'ref': return link(p.ref, bookId);
      case 'list': {
        const items = p.items || [];
        if (!items.length) return p.of ? el('span', { class: 'muted small' }, ['list of ' + p.of]) : null;
        if (ROW[p.of] && items.every((it) => 'd' in it)) return el('ul', { class: 'items rows' }, items.map((it) => el('li', {}, [ROW[p.of](rowFields(it.d), bookId)])));
        return el('ul', { class: 'items' }, items.map((it) => el('li', {}, [argNode(it, bookId)])));
      }
      case 'def': return el('div', { class: 'def' }, [fields(p.fields, bookId), p.blocks ? nodes(p.blocks, bookId) : null]);
      case 'enum': return p.value !== undefined ? span(String(p.value), bookId) : el('span', { class: 'muted small' }, ['one of ' + (p.options || []).join(', ')]);
      case 'choice': return el('span', {}, ['choose ' + (p.pick || 1) + ': ', args(p.items, bookId)]);
      case 'tagged': return el('span', {}, [link({ name: p.name }, bookId), ' ', el('span', { class: 'tags' }, p.tags.map((t) => el('span', { class: 'tag' }, [String(D.arg(t))])))]);
      case 'block': return nodes(p.body, bookId);
      case 'name': return link({ name: p.name }, bookId);
      default: {
        const v = p.value !== undefined ? p.value : p.default;
        if (v === undefined) return el('span', { class: 'muted small decl' }, [[p.dtype || 'value', p.min != null ? 'min ' + p.min : null, p.max != null ? 'max ' + p.max : null, p.required ? 'required' : null].filter(Boolean).join(' ')]);
        if (typeof v === 'boolean') return el('span', {}, [v ? 'yes' : 'no']);
        if (typeof v === 'number') return el('span', { class: 'num' }, [String(v)]);
        return String(v).length > 90 ? prose(String(v), 'prose', bookId) : span(String(v), bookId);
      }
    }
  }
  // ── a row of a character's lists, as the book prints a line of them ─
  // A DEF item's fields by name; the words are the corpus's, the punctuation the page's.
  function rowFields(d) {
    const out = {};
    (d || []).forEach((f) => { if (f && f.name) out[f.name] = f; });
    return out;
  }
  const fv = (f) => (f ? (f.value !== undefined ? f.value : f.default) : undefined);
  const ROW = {
    // "Knowledge 4 (Folklore 6)"
    'Skill Rank': (f, bookId) => el('span', {}, [
      link({ name: fv(f.Skill) }, bookId), fv(f.Rank) != null ? ' ' + fv(f.Rank) : null,
      fv(f.Specialization) ? [' (', String(fv(f.Specialization)), fv(f['Specialization Rank']) != null ? ' ' + fv(f['Specialization Rank']) : null, ')'] : null,
    ]),
    // the line as printed, "Mag-Sling (+2, -1/+0/ +2)"; its effects read out beneath
    'Carried Item': (f, bookId) => el('span', {}, [
      fv(f.Printed) != null ? span(String(fv(f.Printed)), bookId) : link({ name: fv(f.Name) }, bookId),
      f.Effects && (f.Effects.items || []).length ? el('span', { class: 'effects' }, (f.Effects.items || []).map((x) => effect(rowFields(x.d), bookId))) : null,
    ]),
    // "Quirk: Dogged (1) — Anytime Jaya Fails …"
    'Held Gift or Burden': (f, bookId) => el('span', {}, [
      el('b', {}, [String(fv(f.Kind) || '')]), fv(f.Name) ? [': ', String(fv(f.Name))] : null,
      fv(f.Level) != null ? ' (' + fv(f.Level) + ')' : null,
      fv(f.Effect) ? [' — ', span(String(fv(f.Effect)), bookId)] : null,
    ]),
    'Icon Ability': (f, bookId) => el('span', {}, [el('b', {}, [String(fv(f.Name) || '')]), fv(f.Description) ? [' — ', span(String(fv(f.Description)), bookId)] : null]),
    'Item Effect': (f, bookId) => effect(f, bookId),
  };
  // one Item Effect: its Kind, its Value, what it Applies To and on what Condition
  function effect(f, bookId) {
    const to = f['Applies To'] && (f['Applies To'].items || []).map(D.arg);
    return el('span', { class: 'effect' }, [
      el('span', { class: 'effect-k' }, [String(fv(f.Kind) || '')]), ' ', String(fv(f.Value) == null ? '' : fv(f.Value)),
      to && to.length ? el('span', { class: 'muted' }, [' ' + to.join(', ')]) : null,
      fv(f.Condition) ? el('span', { class: 'muted' }, [' ' + fv(f.Condition)]) : null,
    ]);
  }

  function fieldRow(p, bookId) {
    if (p.vk === 'name' || p.vk === 'tagged') return el('div', { class: 'prop solo' }, [value(p, bookId)]);
    const v = value(p, bookId);
    return el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [p.name, p.default !== undefined && p.value === undefined ? el('span', { class: 'muted' }, [' (default)']) : null]), el('div', { class: 'prop-v' }, [v])]);
  }
  function fields(list, bookId) {
    if (!list || !list.length) return null;
    return el('div', { class: 'fields' }, list.map((f) => fieldRow(f, bookId)));
  }

  // ── blocks, generically ────────────────────────────────────────────
  function node(b, bookId, depth) {
    if (!b || typeof b !== 'object') return null;
    if ('ent' in b) {
      const e = D.entity(b.ent);
      return e ? el('div', { class: 'nested' }, [render(e, { depth: (depth || 0) + 1 })]) : null;
    }
    if ('rule' in b) return ruleLine(b.text, bookId);
    if ('num' in b) return el('div', { class: 'numrow' }, [el('span', { class: 'n' }, [String(b.num)]), el('span', {}, [args(b.args, bookId)]), b.body ? nodes(b.body, bookId, depth) : null]);
    if ('s' in b && !('kw' in b)) {
      if (b.body) return el('div', { class: 'section' }, [el('div', { class: 'sec-k' }, [span(b.s, bookId)]), nodes(b.body, bookId, depth)]);
      return el('div', { class: 'line' }, [span(b.s, bookId), b.args && b.args.length ? el('span', {}, [' → ', args(b.args, bookId)]) : null]);
    }
    if ('name' in b && 'vk' in b) return fieldRow(b, bookId);
    if (!('kw' in b)) return null;
    if (b.kw === 'CHOOSE' && !b.body) return chooseLine(b, bookId);
    if (b.kw === 'GUIDANCE' && b.body) return null;       // attached to what it concerns
    const label = el('span', { class: 'kw' }, [kwLabel(b.kw)]);
    const a = b.args && b.args.length ? args(b.args, bookId) : null;
    if (!b.body) {
      // one long string: a paragraph under its label; anything else inline
      const long = b.args && b.args.length === 1 && 's' in b.args[0] && b.args[0].s.length > 90;
      if (long) return el('div', { class: 'kwpara' }, [el('div', { class: 'prop-k' }, [kwLabel(b.kw)]), prose(b.args[0].s, 'prose', bookId)]);
      return el('div', { class: 'kwline' }, [label, a ? el('span', { class: 'kwargs' }, [a]) : null]);
    }
    return el('div', { class: 'kwblock' + (depth ? ' deep' : '') }, [
      el('div', { class: 'kwhead' }, [label, a ? el('span', { class: 'kwargs' }, [' ', a]) : null]),
      nodes(b.body, bookId, (depth || 0) + 1),
    ]);
  }
  function nodes(list, bookId, depth) {
    if (!list || !list.length) return null;
    return el('div', { class: 'nodes' }, list.map((b) => node(b, bookId, depth)));
  }

  // `CHOOSE 5 [a, b, …] INTEGER 1` — a pick, as the book states it: how many, of what, for what
  function chooseLine(b, bookId) {
    const n = b.args.find((a) => 'i' in a);
    const list = b.args.find((a) => 'l' in a);
    const tail = list ? b.args.slice(b.args.indexOf(list) + 1).filter((a) => 'i' in a || 's' in a) : [];
    return el('div', { class: 'kwline choose' }, [
      el('span', { class: 'kw' }, ['Choose ' + (n ? n.i : '')]), ' ',
      list ? el('span', { class: 'arglist' }, list.l.map((x, i) => [i ? ', ' : null, argNode(x, bookId)])) : null,
      tail.length ? el('span', { class: 'muted' }, [' (', args(tail, bookId), ' each)']) : null,
    ]);
  }

  // A RULES line: `slug "text"` shows its text; a bare slug is a rule id with no text. The line
  // is carried as the corpus prints it, so the string's escapes are undone here, in one pass —
  // `\n\n` is a paragraph break (spec §10), `\"` a quote, `\\` a backslash.
  function ruleText(t) {
    const m = /^\S+\s+"([\s\S]*)"$/.exec(t);
    return m ? m[1].replace(/\\(["\\n])/g, (x, c) => (c === 'n' ? '\n' : c)) : null;
  }
  function ruleLine(t, bookId) {
    const txt = ruleText(t);
    return txt ? el('div', { class: 'rule' }, [prose(txt, 'prose', bookId)]) : null;
  }
  function rules(list, bookId) {
    if (!list || !list.length) return null;
    const withText = list.filter((r) => ruleText(r.text));
    const bare = list.filter((r) => !ruleText(r.text));
    return el('div', { class: 'rules' }, [
      withText.map((r) => ruleLine(r.text, bookId)),
      bare.length ? el('details', { class: 'rule-ids' }, [el('summary', { class: 'muted small' }, [bare.length + ' rule id' + (bare.length === 1 ? '' : 's')]), el('div', { class: 'muted small mono' }, [bare.map((r) => r.text).join(' · ')])]) : null,
    ]);
  }

  // ── a printed table ────────────────────────────────────────────────
  function table(t, bookId) {
    if (!t) return null;
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
      el('thead', {}, [el('tr', {}, t.columns.map((c) => el('th', {}, [String(c)])))]),
      el('tbody', {}, t.rows.map((r) => el('tr', {}, r.map((c) => wire(el('td', { html: inline(String(c), bookId) })))))),
    ])]);
  }

  // ── a Stat Line: the nine Stats as the book's grid, and the Derived Stats ─
  // The grid is read from the Stats themselves (each declares its Aspect and Domain); a value is
  // the strip's string as printed — a range "1-2", a modified "6(8)", a dash.
  const DERIVED = [['Physical Defense', 'Mental Defense', 'Spiritual Defense'], ['Body', 'Mind', 'Soul']];
  function statGrid() {
    const stats = D.all().filter((e) => e.type === 'Stat');
    const aspects = [];
    const domains = [];
    stats.forEach((s) => {
      const a = D.text(s, 'Aspect');
      const d = D.text(s, 'Domain');
      if (a && aspects.indexOf(a) === -1) aspects.push(a);
      if (d && domains.indexOf(d) === -1) domains.push(d);
    });
    return { stats, aspects, domains, at: (a, d) => stats.find((s) => D.text(s, 'Aspect') === a && D.text(s, 'Domain') === d) || null };
  }
  function statStrip(e) {
    const sl = D.prop(e, 'Stat Line');
    if (!sl || sl.vk !== 'def' || !(sl.fields || []).some((f) => f.value !== undefined)) return null;
    const v = rowFields(sl.fields);
    const g = statGrid();
    const cell = (k, cls) => el('div', { class: 'stat' + (cls ? ' ' + cls : '') }, [
      el('div', { class: 'stat-k' }, [k]), el('div', { class: 'stat-v' }, [fv(v[k]) == null ? '—' : String(fv(v[k]))]),
    ]);
    return el('div', { class: 'statblock' }, [
      el('table', { class: 'statgrid' }, [
        el('thead', {}, [el('tr', {}, [el('th', {}, [''])].concat(g.domains.map((d) => el('th', {}, [d]))))]),
        el('tbody', {}, g.aspects.map((a) => el('tr', {}, [el('th', { scope: 'row' }, [a])].concat(g.domains.map((d) => {
          const s = g.at(a, d);
          return el('td', {}, [s ? cell(s.name) : null]);
        }))))),
      ]),
      el('div', { class: 'derived' }, DERIVED.map((row) => el('div', { class: 'stats' }, row.map((k) => cell(k, 'derived-stat'))))),
    ]);
  }
  const STRIPPED = ['Stat Line'];

  // ── errata beside what it corrects ─────────────────────────────────
  function corrections(e) {
    const list = D.correctionsFor(e.id);
    if (!list.length) return null;
    return el('div', { class: 'errata' }, list.map((c) => el('aside', { class: 'correction' }, [
      el('div', { class: 'guidance-k' }, [c.op === 'MODIFY' ? 'Errata' : 'Replaced', el('span', { class: 'muted small' }, [' · ' + D.label(c.book) + ' · ' + D.chapterTitle(D.chapter(c.book, c.file) || { file: c.file })])]),
      nodes(c.body, c.book, 1),
    ])));
  }
  function guidance(list, bookId) {
    return (list || []).map((g) => el('aside', { class: 'guidance' }, [
      el('div', { class: 'guidance-k' }, [g.name || 'Sidebar', g.topics && g.topics.length ? el('span', { class: 'muted small' }, [' · ' + g.topics.join(', ')]) : null]),
      prose(g.text, 'prose', bookId),
    ]));
  }

  // ── the entity ─────────────────────────────────────────────────────
  function subtitle(e) {
    const bits = [];
    if (e.form === 'ACTOR') bits.push('actor type' + (e.type ? ', a kind of ' + e.type : ''));
    else if (e.type) bits.push(e.type);
    if (e.applies && e.applies.length && !e.type) bits.push('for ' + e.applies.map((a) => a.name).join(', '));
    ['Type', 'Category', 'Class', 'Stat', 'Archetype', 'Nation'].forEach((k) => {
      const t = D.text(e, k);
      if (t && t !== e.type && bits.indexOf(t) === -1) bits.push(t);
    });
    const cr = D.text(e, 'Cost Rank');
    if (cr) bits.push('Cost Rank ' + cr);
    return bits;
  }

  function render(e, opts) {
    const o = opts || {};
    const bid = e.book;
    const box = el('article', { class: 'entity' + (e.form === 'ACTOR' ? ' actor' : '') + (e.type ? ' type-' + e.type.toLowerCase().replace(/\W+/g, '-') : '') + (o.depth ? ' depth' : '') });
    if (!o.bare) {
      const H = o.depth ? 'h4' : 'h3';
      box.appendChild(el(H, {}, [e.name, e.type ? el('span', { class: 'etype' }, [e.type]) : null]));
      const sub = subtitle(e);
      if (sub.length && !o.depth) box.appendChild(el('div', { class: 'muted small' }, [sub.join(' · '), ' · ', D.label(bid)]));
    }
    // this character's printing of an entity defined elsewhere (EXTENDS its same-named DEF)
    if (e.copyOf) {
      const c = e.copyOf;
      const go = (ev) => { ev.preventDefault(); D.ensure(c.book).then(() => open(c.hash)); };
      box.appendChild(el('div', { class: 'muted small copyof' }, ['As printed here; defined in ', el('a', { class: 'ref', href: '#', onclick: go }, [c.name]), ' (' + D.label(c.book) + ')']));
    }
    const strip = statStrip(e);
    if (strip) box.appendChild(strip);
    if (e.desc) box.appendChild(prose(e.desc, 'prose', bid));
    const props = (e.props || []).filter((p) => !(strip && STRIPPED.indexOf(p.name) !== -1));
    // the text-like properties read as paragraphs; the rest as fields
    const TEXTY = ['Description', 'Effect', 'Activation', 'Text', 'Definition', 'Key Role', 'Events', 'Meaning'];
    props.filter((p) => TEXTY.indexOf(p.name) !== -1 && typeof p.value === 'string').forEach((p) => {
      box.appendChild(el('div', { class: 'kwpara' }, [p.name === 'Description' ? null : el('div', { class: 'prop-k' }, [p.name]), prose(p.value, 'prose', bid)]));
    });
    const rest = props.filter((p) => !(TEXTY.indexOf(p.name) !== -1 && typeof p.value === 'string'));
    if (rest.length) box.appendChild(fields(rest, bid));
    if (e.table) box.appendChild(table(e.table, bid));
    const rl = rules(e.rules, bid);
    if (rl) box.appendChild(rl);
    const inBlocks = new Set();
    (e.blocks || []).forEach((b) => {
      if (b && 'ent' in b) inBlocks.add(b.ent);
    });
    // shallow: the entity's own text without the entries nested in it (a page lists them instead)
    const shown = o.shallow ? (e.blocks || []).filter((b) => !(b && 'ent' in b)) : e.blocks;
    if (shown && shown.length) box.appendChild(nodes(shown, bid, o.depth || 0));
    guidance(D.guidanceFor(e.id), bid).forEach((g) => box.appendChild(g));
    const er = corrections(e);
    if (er) box.appendChild(er);
    if (!o.noKids) {
      D.children(e.id).filter((k) => !inBlocks.has(k.id)).forEach((k) => box.appendChild(el('div', { class: 'nested' }, [render(k, { depth: (o.depth || 0) + 1 })])));
    }
    return box;
  }

  // A card for a grid: the name, what it is, the start of its text.
  function card(e, onclick, meta) {
    const text = e.desc || D.text(e, 'Description') || D.text(e, 'Effect') || D.kwArg(e, 'ACTIVATION') || '';
    return el('button', { class: 'card', type: 'button', onclick }, [
      el('div', { class: 'card-name' }, [e.name]),
      el('div', { class: 'card-meta muted small' }, [meta || subtitle(e).join(' · ')]),
      text ? wire(el('div', { class: 'card-text', html: inline(String(text).split(/\n\s*\n/)[0].slice(0, 280), e.book) })) : null,
    ]);
  }

  // ── lore: the Markdown the corpus carries, rendered ────────────────
  // headings, paragraphs, > blockquotes (read-aloud), - lists, | tables, ---; nothing else
  const slug = (x) => String(x).toLowerCase().replace(/[’'`]/g, '').replace(/&/g, ' ').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  function markdown(text, bookId) {
    const wrap = el('div', { class: 'lore prose' });
    const lines = String(text || '').split('\n');
    let i = 0;
    const para = [];
    const flush = () => {
      if (para.length) wrap.appendChild(el('p', { html: inline(para.join(' '), bookId) }));
      para.length = 0;
    };
    while (i < lines.length) {
      const ln = lines[i];
      let m;
      if (!ln.trim()) { flush(); i++; continue; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(ln))) {
        flush();
        const lvl = Math.min(6, m[1].length + 1);
        wrap.appendChild(el('h' + lvl, { id: 'lore-' + slug(m[2]), html: inline(m[2], bookId) }));
        i++;
        continue;
      }
      if (/^---+\s*$/.test(ln)) { flush(); wrap.appendChild(el('hr')); i++; continue; }
      if (/^>/.test(ln)) {
        flush();
        const q = [];
        while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
        const bq = el('blockquote', { class: 'read-aloud' });
        q.join('\n').split(/\n\s*\n/).forEach((p) => bq.appendChild(el('p', { html: inline(p.replace(/\n/g, ' '), bookId) })));
        wrap.appendChild(bq);
        continue;
      }
      if (/^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) {
        flush();
        const ordered = /^\s*\d+\.\s+/.test(ln);
        const list = el(ordered ? 'ol' : 'ul', { class: 'items' });
        while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
          list.appendChild(el('li', { html: inline(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''), bookId) }));
          i++;
        }
        wrap.appendChild(list);
        continue;
      }
      if (/^\|/.test(ln)) {
        flush();
        const rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = (r) => r.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
        const body = rows.filter((r) => !/^\|\s*:?-{2,}/.test(r));
        const head = body.shift();
        wrap.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
          el('thead', {}, [el('tr', {}, cells(head).map((c) => el('th', { html: inline(c, bookId) })))]),
          el('tbody', {}, body.map((r) => el('tr', {}, cells(r).map((c) => el('td', { html: inline(c, bookId) }))))),
        ])]));
        continue;
      }
      para.push(ln.trim());
      i++;
    }
    flush();
    return wire(wrap);
  }

  return { render, card, prose, inline, span, link, table, fields, value, nodes, node, markdown, statStrip, statGrid, subtitle, kwLabel, ruleText, guidance, wire, rowFields };
})();
