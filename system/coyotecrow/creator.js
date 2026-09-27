// system/coyotecrow/creator.js — Make a Character: the book's Steps to Creating a Character walked in
// its own order, each step with the book's text for it (verbatim, from the corpus) and the controls
// the step asks for. The rules are chargen.js's; this file draws them. What leaves is a character
// file in the shape of `ACTOR "Character"` (sheet.js reads and writes it), which the table imports.
//
// Three homes, one creator: the site's tab (steps are routes, #create/<step>), the player's page
// (Sys.makeCharacter — the character takes its seat), and the Story Guide's Party panel. The draft is
// a per-browser convenience (localStorage), never state anyone else sees.
//
// Typing keeps its box (PLAYBOOK §2): every edit redraws the step, and the redraw gives the focused
// field back — found by its place among the step's fields, with its caret.
window.CnCCreator = (function () {
  const { el, button } = window.VttRender;
  const D = window.CnCData;
  const E = window.CnCEntity;
  const C = window.CnCChargen;
  const Sheet = () => window.CnCSheet;
  const CFG = window.VttConfig || {};
  const KEY = (CFG.storagePrefix || 'sortilege-vtt') + ':creator:draft';

  // the book's fourteen steps (Steps to Creating a Character), in its order; `sections` are the
  // corpus entries whose text the step shows. The labels are the tool's short names for them.
  const STEPS = [
    { id: 'motivation', label: 'Motivation', sections: ['Motivations'] },
    { id: 'archetype', label: 'Archetype', sections: ['Archetypes'] },
    { id: 'identifiers', label: 'Age and Other Identifiers', sections: ['Other Identifiers'] },
    { id: 'path', label: 'Path', sections: ['Paths'] },
    { id: 'points', label: 'Character Points', sections: ['Character Points'] },
    { id: 'gifts', label: 'Gifts and Burdens', sections: ['Gifts and Burdens'] },
    { id: 'stats', label: 'Stats', sections: ['Stats', 'Generating Your Initial Stats'] },
    { id: 'skills', label: 'Skills', sections: ['Skills', 'Purchasing Skills During Character Creation'] },
    { id: 'ability', label: 'Ability', sections: ['Abilities'] },
    { id: 'equipment', label: 'Equipment', sections: ['Starting Equipment'] },
    { id: 'derived', label: 'Derived Stats', sections: ['Derived Stats', 'Defense Values', 'Body, Mind and Soul'] },
    { id: 'background', label: 'Background', sections: ['Background'] },
    { id: 'goals', label: 'Goals', sections: ['Initial Goals'] },
    { id: 'name', label: 'Name', sections: ['Names (and Naming Conventions)'] },
    { id: 'done', label: 'Your Character', sections: [] },
  ];
  const sectionEntity = (name) => D.all().find((e) => e.name === name && !e.type) || null;

  // ── the draft ──────────────────────────────────────────────────────
  function loadDraft() {
    try { const x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x) return Object.assign(C.blank(), x); } catch (e) { /* storage off */ }
    return C.blank();
  }
  function saveDraft(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* this page only */ } }
  // an embedded creator's step outlives a redraw of the panel or page around it
  let embeddedStep = null;

  // ── focus kept across a redraw ─────────────────────────────────────
  const FIELDS = 'input, select, textarea';
  function focusMark(root) {
    const a = document.activeElement;
    if (!a || !root.contains(a) || !a.matches(FIELDS)) return null;
    const i = Array.from(root.querySelectorAll(FIELDS)).indexOf(a);
    let caret = null;
    try { caret = a.type === 'number' ? null : [a.selectionStart, a.selectionEnd]; } catch (e) { caret = null; }
    return { i, caret, number: a.type === 'number' };
  }
  function focusRestore(root, mark) {
    if (!mark || mark.i < 0) return;
    const x = root.querySelectorAll(FIELDS)[mark.i];
    if (!x) return;
    x.focus();
    try {
      if (mark.caret) x.setSelectionRange(mark.caret[0], mark.caret[1]);
      else if (mark.number) { const v = x.value; x.value = ''; x.value = v; }
    } catch (e) { /* not a text field */ }
  }

  // ── small controls ─────────────────────────────────────────────────
  const field = (label, control, note) => el('label', { class: 'cr-field' }, [el('span', { class: 'field-k' }, [label]), control, note ? el('span', { class: 'muted small' }, [note]) : null]);
  const textIn = (value, oninput, attrs) => el('input', Object.assign({ type: 'text', class: 'text', value: value || '', oninput: (ev) => oninput(ev.target.value) }, attrs || {}));
  const area = (value, oninput, attrs) => el('textarea', Object.assign({ class: 'text', rows: 5, oninput: (ev) => oninput(ev.target.value) }, attrs || {}), [value || '']);
  const select = (value, options, onchange, attrs) => el('select', Object.assign({ class: 'scope', onchange: (ev) => onchange(ev.target.value) }, attrs || {}),
    options.map((o) => el('option', { value: o.value, selected: String(o.value) === String(value) || null }, [o.label])));
  const stepper = (value, min, max, set, label) => el('span', { class: 'cr-stepper' }, [
    button('−', () => set(Math.max(min, value - 1)), 'ghost tiny'),
    el('b', { class: 'num', 'aria-label': label }, [String(value)]),
    button('+', () => set(Math.min(max, value + 1)), 'ghost tiny'),
  ]);
  const pick = (chosen, e, onpick, extra) => el('div', { class: 'cr-pick' + (chosen ? ' on' : '') }, [
    el('button', { class: 'cr-pick-head', type: 'button', 'aria-pressed': chosen ? 'true' : 'false', onclick: onpick }, [el('span', { class: 'cr-radio' }, [chosen ? '●' : '○']), ' ', e.name]),
    extra || null,
    el('details', { class: 'cr-more' }, [el('summary', { class: 'muted small' }, ['Read it']), E.render(e, { bare: true })]),
  ]);

  // ── the creator ────────────────────────────────────────────────────
  // opts: { route: the site's step routing (ctx.href), embedded: steps as buttons, onDone(member) }
  function render(container, path, ctx, opts) {
    const o = opts || {};
    const root = el('div', { class: 'creator' });
    container.appendChild(root);
    let draft = loadDraft();
    let step = (path && path[0] && STEPS.some((s) => s.id === path[0])) ? path[0] : (o.embedded && embeddedStep) || 'motivation';
    const site = !!(ctx && ctx.href) && !o.embedded;
    const go = (id) => { if (site) ctx.go('create', [id]); else { step = embeddedStep = id; draw(); root.scrollIntoView({ block: 'start' }); } };
    const set = (patch) => { draft = Object.assign({}, draft, patch); saveDraft(draft); draw(); };
    D.ensure(D.books().map((b) => b.id)).then(draw);

    function draw() {
      const mark = focusMark(root);
      root.innerHTML = '';
      if (!D.all().length) { root.appendChild(el('div', { class: 'muted loading' }, ['Opening the book…'])); return; }
      const R = C.rules();
      if (R.missing.length) root.appendChild(el('div', { class: 'empty' }, ['The corpus no longer states: ' + R.missing.join('; ')]));
      const res = C.compute(draft);
      const i = STEPS.findIndex((s) => s.id === step);
      const cur = STEPS[i];
      const probs = (id) => res.errors.filter((x) => x.step === id).length;
      // the steps, as the book numbers them
      root.appendChild(el('ol', { class: 'steps' }, STEPS.map((s, k) => el('li', { class: (s.id === step ? 'on' : '') + (probs(s.id) ? ' bad' : '') }, [
        site ? el('a', { href: ctx.href('create', [s.id]) }, [s.label]) : el('button', { type: 'button', class: 'ref', onclick: () => go(s.id) }, [s.label]),
      ]))));
      // the points, always in view
      const p = res.points;
      root.appendChild(el('div', { class: 'cr-points' }, [
        el('span', {}, ['Gifts and Burdens ', el('b', { class: p.gb.left < 0 ? 'over' : '' }, [String(p.gb.left)]), ' left']),
        el('span', {}, ['Stats ', el('b', { class: p.stats.left < 0 ? 'over' : '' }, [String(p.stats.left)]), ' of ' + p.stats.pool]),
        el('span', {}, ['Skills ', el('b', { class: p.skills.left < 0 ? 'over' : '' }, [String(p.skills.left)]), ' of ' + p.skills.pool]),
        el('span', {}, ['Wealth Rank ', el('b', {}, [String(res.wealth)])]),
        button('Start over', () => { if (confirm('Clear this Character and start over?')) { draft = C.blank(); saveDraft(draft); go('motivation'); draw(); } }, 'ghost tiny'),
      ]));
      const body = el('section', { class: 'cr-step' }, [el('h2', {}, [(i + 1) + '. ' + cur.label])]);
      root.appendChild(body);
      // the book's own words for the step
      cur.sections.map(sectionEntity).filter(Boolean).forEach((e, k) => body.appendChild(el('details', { class: 'cr-book', open: k === 0 && step !== 'done' ? true : null }, [
        el('summary', {}, ['The book: ', e.name]), E.render(e, { bare: true, noKids: true, shallow: true }),
      ])));
      STEP_VIEWS[step](body, res, R);
      const mine = res.errors.filter((x) => x.step === step).concat(res.notes.filter((x) => x.step === step));
      if (mine.length) body.appendChild(el('ul', { class: 'cr-probs' }, mine.map((x) => el('li', { class: res.errors.indexOf(x) !== -1 ? 'bad' : 'note' }, [x.text]))));
      root.appendChild(el('div', { class: 'chiprow cr-nav' }, [
        i > 0 ? button('← ' + STEPS[i - 1].label, () => go(STEPS[i - 1].id), 'ghost') : null,
        i < STEPS.length - 1 ? button(STEPS[i + 1].label + ' →', () => go(STEPS[i + 1].id)) : null,
      ]));
      focusRestore(root, mark);
    }

    // ── each step ────────────────────────────────────────────────────
    const STEP_VIEWS = {
      motivation: (b) => {
        b.appendChild(el('div', { class: 'cr-picks' }, C.motivations().map((e) => pick(draft.motivation === e.name, e, () => set({ motivation: e.name })))));
      },
      archetype: (b) => {
        b.appendChild(el('div', { class: 'cr-picks' }, C.rules().archetypes.map((a) => {
          const e = D.entity(a.id);
          const chosen = draft.archetype === a.name;
          const extra = el('div', { class: 'small' }, [
            el('div', {}, ['+' + a.bonus + ' ' + a.stat + ' · a free Rank in ' + a.options.map((x) => x.label).join(' or ')]),
            chosen && a.options.length > 1 ? field('The free Rank', select(draft.archetypeSkill || 0, a.options.map((x, k) => ({ value: k, label: x.label })), (v) => set({ archetypeSkill: +v }), { 'aria-label': 'The free Rank' })) : null,
            chosen && (a.options[draft.archetypeSkill || 0] || {}).spec ? field('Name the Specialized ' + a.options[draft.archetypeSkill || 0].skill + ' Skill', textIn(draft.archetypeSpec, (v) => set({ archetypeSpec: v }), { 'aria-label': 'The Specialized Skill', list: 'cr-spec-' + a.options[draft.archetypeSkill || 0].skill.replace(/\W/g, '') }), 'it takes the free Rank') : null,
          ]);
          return pick(chosen, e, () => set({ archetype: a.name, archetypeSkill: 0 }), extra);
        })));
        specLists(b);
      },
      identifiers: (b) => {
        b.appendChild(field('Age', textIn(draft.age, (v) => set({ age: v }), { 'aria-label': 'Age' })));
        b.appendChild(field('Other Identifiers', area(draft.identifiers, (v) => set({ identifiers: v }), { rows: 3, 'aria-label': 'Other Identifiers' }), 'tribe, gender, sexuality, anything else'));
        b.appendChild(field('Nation', select(draft.nation, [{ value: '', label: '—' }].concat(C.nations().map((e) => ({ value: e.name, label: e.name }))), (v) => set({ nation: v }), { 'aria-label': 'Nation' })));
      },
      path: (b) => {
        b.appendChild(el('div', { class: 'cr-picks' }, C.rules().paths.map((pth) => pick(draft.path === pth.name, D.entity(pth.id), () => set({ path: pth.name, ability: '' }),
          el('div', { class: 'small' }, ['+1 ' + pth.stats.join(', +1 ') + ' · an Ability of ' + pth.stats.join(' or ')])))));
      },
      points: (b, res, R) => {
        b.appendChild(el('div', { class: 'cr-pools' }, [['Gifts and Burdens', R.points.gb], ['Stats', R.points.stats], ['Skills and Skill Ranks', R.points.skills]].map(([k, v]) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [k]), el('div', { class: 'stat-v' }, [String(v)])]))));
      },
      gifts: (b, res) => {
        const kinds = C.giftKinds();
        const rows = draft.gb || [];
        const upd = (k, patch) => { const l = rows.map((x) => Object.assign({}, x)); Object.assign(l[k], patch); set({ gb: l }); };
        rows.forEach((g, k) => {
          const kind = kinds.find((x) => x.name === g.kind) || kinds[0];
          b.appendChild(el('div', { class: 'cr-gb' }, [
            el('div', { class: 'chiprow tight' }, [
              select(g.kind, kinds.map((x) => ({ value: x.name, label: x.name })), (v) => upd(k, { kind: v }), { 'aria-label': 'Which' }),
              select(g.takenAs, kind.as.map((x) => ({ value: x, label: 'as a ' + x })), (v) => upd(k, { takenAs: v }), { 'aria-label': 'Taken as' }),
              select(g.level, kind.levels.map((x) => ({ value: x, label: 'Level ' + x })), (v) => upd(k, { level: +v }), { 'aria-label': 'Level' }),
              el('span', { class: 'muted small' }, [g.takenAs === 'Burden' ? '+' + g.level + ' points' : '−' + g.level + ' points']),
              button('Remove', () => set({ gb: rows.filter((_, j) => j !== k) }), 'ghost tiny'),
            ]),
            field('What it is', textIn(g.name, (v) => upd(k, { name: v }), { 'aria-label': 'What it is', placeholder: 'e.g. my little sister' })),
            field('What it does at the table', textIn(g.effect, (v) => upd(k, { effect: v }), { 'aria-label': 'What it does', placeholder: 'e.g. −1 SN on Checks with…' })),
            el('details', { class: 'cr-more' }, [el('summary', { class: 'muted small' }, ['Read ' + kind.name]), E.render(D.entity(kind.id), { bare: true })]),
          ]));
        });
        b.appendChild(el('div', { class: 'chiprow' }, [button('+ A Gift or Burden', () => set({ gb: rows.concat([{ kind: kinds[0].name, takenAs: 'Gift', level: 1, name: '', effect: '' }]) }), '')]));
        const p = res.points.gb;
        b.appendChild(el('p', {}, [p.gifts + ' in Gifts, ' + p.burdens + ' from Burdens: ', el('b', {}, [p.left + ' left']), '.']));
        // the box keeps what is typed (a redraw never rewrites it under the cursor); the rules clamp it
        if (p.left > 0) b.appendChild(field('Of the ' + p.left + ' left, to Stats', el('input', { type: 'number', class: 'numin', min: '0', max: String(p.left), value: String(draft.gbToStats || 0), 'aria-label': 'Points to Stats', oninput: (ev) => set({ gbToStats: Math.max(0, parseInt(ev.target.value, 10) || 0) }) }),
          (draft.gbToStats || 0) > p.left ? 'only ' + p.left + ' are left: ' + p.left + ' go to Stats, none to Skills' : 'the rest go to Skills'));
      },
      stats: (b, res, R) => {
        const g = E.statGrid();
        const arch = C.archetype(draft.archetype);
        const pth = C.path(draft.path);
        b.appendChild(el('table', { class: 'statgrid cr-stats' }, [
          el('thead', {}, [el('tr', {}, [el('th', {}, [''])].concat(g.domains.map((d) => el('th', {}, [d]))))]),
          el('tbody', {}, g.aspects.map((a) => el('tr', {}, [el('th', { scope: 'row' }, [a])].concat(g.domains.map((d) => {
            const s = g.at(a, d);
            if (!s) return el('td');
            const v = draft.stats[s.name] || R.statMin;
            const bonus = [arch && arch.stat === s.name ? '+' + arch.bonus + ' ' + arch.name : null, pth && pth.stats.indexOf(s.name) !== -1 ? '+1 ' + pth.name : null].filter(Boolean);
            return el('td', {}, [el('div', { class: 'stat cr-stat' }, [
              el('div', { class: 'stat-k' }, [s.name]),
              stepper(v, R.statMin, R.statMax, (n) => set({ stats: Object.assign({}, draft.stats, { [s.name]: n }) }), s.name),
              el('div', { class: 'muted small' }, ['cost ' + R.statCost[v] + (bonus.length ? ' · ' + bonus.join(', ') : '')]),
              el('div', { class: 'stat-v' }, ['= ' + res.final[s.name]]),
            ])]);
          }))))),
        ]));
      },
      skills: (b, res, R) => {
        const list = C.skillList();
        const arch = C.archetype(draft.archetype);
        const opt = arch && arch.options[draft.archetypeSkill || 0];
        b.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'printed cr-skills' }, [
          el('thead', {}, [el('tr', {}, ['General Skill', 'Related Stats', 'Rank', 'Cost', 'Final', 'Pool'].map((h) => el('th', {}, [h])))]),
          el('tbody', {}, list.map((k) => {
            const v = (draft.skills || {})[k.name] || 0;
            const fin = res.ranks[k.name] || 0;
            const pl = Sheet().skillPool(stringify(res.final), k.name, fin);
            return el('tr', {}, [
              el('td', {}, [k.name, k.needsRank ? '*' : '']),
              el('td', { class: 'muted small' }, [k.related.join(', ')]),
              el('td', {}, [stepper(v, 0, R.skillMax, (n) => set({ skills: Object.assign({}, draft.skills, { [k.name]: n }) }), k.name + ' Rank')]),
              el('td', { class: 'num' }, [v ? String(R.skillCost.general[v]) : '']),
              el('td', { class: 'num' }, [String(fin), opt && !opt.spec && opt.skill === k.name ? el('span', { class: 'muted small' }, [' +1 ' + arch.name]) : null]),
              el('td', { class: 'num' }, [pl.pool == null ? '—' : String(pl.pool)]),
            ]);
          })),
        ])]));
        // Specialized Skills: a General Skill, a name, a Rank above the General Rank
        b.appendChild(el('h4', {}, ['Specialized Skills']));
        const specs = draft.specs || [];
        const upd = (k, patch) => { const l = specs.map((x) => Object.assign({}, x)); Object.assign(l[k], patch); set({ specs: l }); };
        specs.forEach((s, k) => b.appendChild(el('div', { class: 'chiprow tight cr-spec' }, [
          select(s.skill, list.map((x) => ({ value: x.name, label: x.name })), (v) => upd(k, { skill: v }), { 'aria-label': 'General Skill' }),
          textIn(s.name, (v) => upd(k, { name: v }), { 'aria-label': 'Specialized Skill', placeholder: 'e.g. Knives', list: 'cr-spec-' + String(s.skill).replace(/\W/g, '') }),
          select(s.rank, [2, 3, 4, 5, 6].filter((r) => R.skillCost.special[r] != null).map((r) => ({ value: r, label: 'Rank ' + r + ' · ' + R.skillCost.special[r] })), (v) => upd(k, { rank: +v }), { 'aria-label': 'Rank' }),
          button('Remove', () => set({ specs: specs.filter((_, j) => j !== k) }), 'ghost tiny'),
        ])));
        b.appendChild(el('div', { class: 'chiprow' }, [button('+ A Specialized Skill', () => set({ specs: specs.concat([{ skill: list[0].name, name: '', rank: 2 }]) }), '')]));
        specLists(b);
      },
      ability: (b) => {
        const pth = C.path(draft.path);
        if (!pth) { b.appendChild(el('div', { class: 'empty' }, ['Choose a Path first: the Ability is from one of its Related Stats.'])); return; }
        pth.stats.forEach((s) => {
          b.appendChild(el('h4', {}, [s + ' Abilities']));
          b.appendChild(el('div', { class: 'cr-picks' }, C.abilitiesFor([s]).map((e) => pick(draft.ability === e.name, e, () => set({ ability: e.name }), el('div', { class: 'small' }, [D.text(e, 'Summary') || D.text(e, 'Activation') || ''])))));
        });
      },
      equipment: (b, res, R) => {
        b.appendChild(el('p', {}, ['Wealth Rank ', el('b', {}, [String(res.wealth)]), ' — the baseline: any items below it, ' + R.gear.equal + ' at it, ' + R.gear.above + ' at ' + (res.wealth + R.gear.aboveBy) + '.']));
        const have = draft.equipment || [];
        const groups = {};
        C.equipment().forEach((e) => { const k = D.text(e, 'Class') || 'Other'; (groups[k] = groups[k] || []).push(e); });
        Object.keys(groups).forEach((k) => b.appendChild(el('details', { class: 'cr-eq', open: groups[k].some((e) => have.indexOf(e.name) !== -1) || null }, [
          el('summary', {}, [k, el('span', { class: 'muted small' }, [' · ' + groups[k].filter((e) => have.indexOf(e.name) !== -1).length + ' chosen'])]),
          el('ul', { class: 'items rows' }, groups[k].map((e) => el('li', {}, [el('label', {}, [
            el('input', { type: 'checkbox', checked: have.indexOf(e.name) !== -1 || null, onchange: (ev) => set({ equipment: ev.target.checked ? have.concat([e.name]) : have.filter((x) => x !== e.name) }) }),
            ' ', e.name, el('span', { class: 'muted small' }, [' · Cost Rank ' + (D.text(e, 'Cost Rank') || '—') + (D.text(e, 'Printed') ? ' · ' + D.text(e, 'Printed') : '')]),
          ])]))),
        ])));
      },
      derived: (b, res, R) => {
        b.appendChild(el('table', { class: 'printed' }, [
          el('thead', {}, [el('tr', {}, ['Derived Stat', 'Formula', 'Value'].map((h) => el('th', {}, [h])))]),
          el('tbody', {}, R.derived.map((x) => el('tr', {}, [el('td', {}, [x.name]), el('td', { class: 'small' }, [x.formula || x.parts.join(' + ')]), el('td', { class: 'num' }, [res.derived[x.name].text])]))),
        ]));
        b.appendChild(el('p', { class: 'muted small' }, ['A value in brackets is with your armor, as the book prints it: 6(7).']));
      },
      background: (b) => b.appendChild(field('Background', area(draft.background, (v) => set({ background: v }), { rows: 10, 'aria-label': 'Background' }))),
      goals: (b, res, R) => {
        for (let k = 0; k < R.goals.short; k++) b.appendChild(field('Short-Term Goal ' + (k + 1), textIn((draft.short || [])[k], (v) => { const l = (draft.short || []).slice(); l[k] = v; set({ short: l }); }, { 'aria-label': 'Short-Term Goal ' + (k + 1) })));
        b.appendChild(field('Long-Term Goal', textIn(draft.long, (v) => set({ long: v }), { 'aria-label': 'Long-Term Goal' })));
      },
      name: (b) => b.appendChild(field('Name(s)', textIn(draft.name, (v) => set({ name: v }), { 'aria-label': 'Name' }))),
      done: (b, res) => {
        if (res.todo.length) b.appendChild(el('ul', { class: 'cr-probs' }, res.todo.map((x) => el('li', { class: 'bad' }, ['Still to choose: ' + x.text + ' ', button('go', () => go(x.step), 'ghost tiny')]))));
        if (res.errors.length) b.appendChild(el('ul', { class: 'cr-probs' }, res.errors.map((x) => el('li', { class: 'bad' }, [x.text, ' ', button(STEPS.find((s) => s.id === x.step).label, () => go(x.step), 'ghost tiny')]))));
        if (res.notes.length) b.appendChild(el('ul', { class: 'cr-probs' }, res.notes.map((x) => el('li', { class: 'note' }, [x.text, ' ', button(STEPS.find((s) => s.id === x.step).label, () => go(x.step), 'ghost tiny')]))));
        const m = Sheet().memberFromCharacter(res.character);
        b.appendChild(el('div', { class: 'chiprow' }, [
          button('Save the character file', () => Sheet().downloadMember(m), res.ok ? 'primary' : ''),
          o.onDone ? button(o.doneLabel || 'Take them to the table', () => { if (!res.ok && !confirm('There are still problems. Take them to the table anyway?')) return; embeddedStep = null; o.onDone(Sheet().memberFromCharacter(res.character)); }, res.ok ? 'primary' : '') : null,
        ]));
        b.appendChild(Sheet().live(m, { preview: true }));
      },
    };
    // the Specializations each General Skill lists, offered as suggestions to a name field
    function specLists(b) {
      C.skillList().filter((k) => k.specs.length).forEach((k) => b.appendChild(el('datalist', { id: 'cr-spec-' + k.name.replace(/\W/g, '') }, k.specs.map((s) => el('option', { value: s })))));
    }
    const stringify = (o) => { const x = {}; Object.keys(o).forEach((k) => (x[k] = String(o[k]))); return x; };
    draw();
    return root;
  }

  return { render, STEPS };
})();
