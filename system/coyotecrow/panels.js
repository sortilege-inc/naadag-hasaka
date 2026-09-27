// system/coyotecrow/panels.js — the Story Guide's panels: Adventure, Party, Inspector, Icons,
// Dice, Rules & Book, Log, Saga. Registered into the engine's registry; the shell (engine/app.js)
// decides where they show. Every word of rules text shown comes from the corpus. Ported in shape
// from sortilege-vtt-l5r5e (system/l5r5e/panels.js); the per-copy tracking of a scene's cast is
// sortilege-vtt-daggerheart's workbench (instances keyed by iid).
(function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.CnCData;
  const E = window.CnCEntity;
  const Dice = window.CnCDice;
  const Sheet = window.CnCSheet;
  const State = window.VttState;
  const Bus = window.VttBus;
  const Panels = window.VttPanels;
  const Sys = () => window.VttSystem;
  const S = () => State.state;
  const G = () => window.VttGmText;

  // a link inside any rendered entity opens it in the Inspector here, loading its book first
  window.CnCOpenEntity = (id) => {
    const r = D.entity(id) || D.records().find((x) => x.id === id);
    if (!r) return;
    D.ensure(r.book).then(() => Panels.select({ kind: 'entity', id }));
  };
  const editing = (c) => document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName) && c.contains(document.activeElement);
  const mid = () => Sys().moduleId();
  const progress = (sceneId) => ((S().progress || {})[mid()] || {})[sceneId] || { done: false, notes: '' };
  function goTo(sceneId) {
    State.commit('setCurrentScene', [mid(), sceneId]);
    Bus.emit('scene:changed', { moduleId: mid(), sceneId });
  }
  const openTable = (sid) => window.open(window.VttConfig.pages.table + '?scene=' + encodeURIComponent(sid), (window.VttConfig.channel || 'vtt') + '-table');

  // ── Adventure: the published adventure's Parts ─────────────────────
  function renderAdventure(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const pick = el('select', { class: 'scope', 'aria-label': 'The adventure in play' }, [el('option', { value: '' }, ['— no published adventure: the saga’s own scenes —'])].concat(
        D.moduleList().map((m) => el('option', { value: m.id, selected: m.id === mid() || null }, [m.name]))));
      pick.addEventListener('change', () => { State.commit('setCampaign', [{ modules: pick.value ? [pick.value] : [] }]); draw(); });
      container.appendChild(pick);
      const m = Sys().module();
      if (mid() === Sys().SAGA) return container.appendChild(el('div', { class: 'empty' }, ['No published adventure in play. The Scenes pane holds the saga’s own.']));
      if (!m) return container.appendChild(el('div', { class: 'muted loading' }, ['Opening the adventure…']));
      const own = Sys().scenes().filter((s) => !s.own);
      const cur = Sys().currentSceneId();
      const done = own.filter((s) => progress(s.id).done).length;
      container.appendChild(el('h4', {}, [m.name, el('span', { class: 'muted small' }, [' · ' + done + ' of ' + own.length + ' Parts done'])]));
      const list = el('div', { class: 'scene-list' });
      m.phases.forEach((ph) => ph.scenes.forEach((sid) => {
        const s = m.scenes.find((x) => x.id === sid);
        const st = progress(sid);
        const n = Sys().castEntries(sid).length;
        list.appendChild(el('div', { class: 'scene-row' + (cur === sid ? ' current' : '') + (st.done ? ' done' : '') }, [
          el('input', { type: 'checkbox', checked: st.done || null, title: 'Done', 'aria-label': 'Done: ' + s.name, onchange: (ev) => State.commit('setSceneDone', [m.id, sid, ev.target.checked]) }),
          el('button', { class: 'scene-link', type: 'button', onclick: () => goTo(sid) }, [s.name]),
          n ? el('span', { class: 'muted small' }, [n + ' in it']) : null,
        ]));
      }));
      container.appendChild(list);
      const s = Sys().scene(cur);
      if (s && !s.own) container.appendChild(sceneSection(m, s));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    ctx.on('scene:changed', draw);
    draw();
  }
  function sceneSection(m, s) {
    const st = progress(s.id);
    return el('section', { class: 'scene' }, [
      el('h4', {}, ['This Part']),
      el('div', { class: 'chiprow tight' }, [
        button('Open on the table', () => openTable(s.id), 'tiny'),
        el('a', { class: 'btn ghost tiny', href: './#adventures/' + encodeURIComponent(m.id) + '/' + encodeURIComponent(s.id), target: '_blank' }, ['Its text in the reader']),
      ]),
      castBlock(s.id),
      el('div', { class: 'prop-k' }, ['Story Guide’s notes', el('span', { class: 'muted' }, [' · never sent to players'])]),
      el('textarea', { class: 'text', rows: 4, placeholder: 'What happens here…', 'aria-label': 'Notes on this Part', oninput: debounce((ev) => State.commit('setSceneNotes', [m.id, s.id, ev.target.value]), 400) }, [st.notes || '']),
      el('div', { class: 'paper' }, [el('h3', {}, [s.name]), s.block ? E.nodes(s.block.body, m.book) : null]),
    ]);
  }
  // who is in a scene: a chip per copy, the Icons the scene prints, and a search that adds any Icon
  function castBlock(sid) {
    const here = Sys().castEntries(sid);
    const printed = Sys().namedCast(sid);
    const hits = el('div', { class: 'gm-cast-hits' });
    const find = el('input', { type: 'search', class: 'text', placeholder: '+ an Icon', 'aria-label': 'Put an Icon in this scene' });
    find.addEventListener('input', debounce(() => {
      const q = find.value.trim().toLowerCase();
      hits.innerHTML = '';
      if (q.length < 2) return;
      D.icons().filter((r) => r.name.toLowerCase().indexOf(q) !== -1).slice(0, 8)
        .forEach((r) => hits.appendChild(button('+ ' + r.name, () => Sys().addToScene(sid, r.id, 1), 'ghost tiny')));
    }, 150));
    return el('div', { class: 'gm-cast' }, [
      el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['In it'])].concat(here.map((c) => el('span', { class: 'chip' }, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: c.id, iid: c.iid, label: Sys().instLabel(c) }) }, [Sys().instLabel(c)]),
        el('button', { class: 'ref tiny', type: 'button', title: 'take out', 'aria-label': 'Take ' + Sys().instLabel(c) + ' out', onclick: () => Sys().removeFromScene(sid, c.iid) }, ['×']),
      ]))).concat([find])),
      hits,
      printed.length ? el('div', { class: 'chiprow tight' }, [el('span', { class: 'prop-k' }, ['Printed here'])].concat(printed.map((e) => button('+ ' + e.name, () => Sys().addToScene(sid, e.id, 1), 'ghost tiny')))) : null,
    ]);
  }

  // ── Party ──────────────────────────────────────────────────────────
  function characterLoader(label, cls) {
    const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true, multiple: true });
    file.addEventListener('change', () => {
      const files = Array.from(file.files || []);
      Promise.all(files.map((f) => f.text().then((text) => Sys().readCharacter(JSON.parse(text), f.name))))
        .then((members) => {
          members.forEach((m) => State.commit('addPartyMember', [m]));
          if (members.length) Panels.select({ kind: 'party', id: members[members.length - 1].id });
        })
        .catch((e) => alert(e.message))
        .finally(() => (file.value = ''));
    });
    return el('span', {}, [button(label, () => file.click(), cls), file]);
  }
  function pregenPicker() {
    const sel = el('select', { class: 'scope', 'aria-label': 'Add a sample Character' }, [el('option', { value: '' }, ['add a sample Character…'])].concat(
      D.pregens().map((r) => el('option', { value: r.id }, [r.name + ((r.fields || {}).Archetype ? ' · ' + r.fields.Archetype : '')]))));
    sel.addEventListener('change', () => {
      const r = D.pregens().find((x) => x.id === sel.value);
      sel.value = '';
      if (!r) return;
      D.ensure(r.book).then(() => {
        const m = Sheet.memberFromEntity(D.entity(r.id));
        State.commit('addPartyMember', [m]);
        Panels.select({ kind: 'party', id: m.id });
      });
    });
    return sel;
  }
  let making = false;
  function renderParty(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const party = S().party || [];
      container.appendChild(el('div', { class: 'chiprow' }, [characterLoader('Load character file(s)…', ''), pregenPicker(),
        button(making ? 'Close the creator' : 'Make a Character…', () => { making = !making; draw(); }, 'ghost')]));
      if (making) {
        const box = el('div', { class: 'paper party-maker' });
        container.appendChild(box);
        window.CnCCreator.render(box, null, null, { embedded: true, doneLabel: 'Add them to the party', onDone: (m) => { State.commit('addPartyMember', [m]); making = false; Panels.select({ kind: 'party', id: m.id }); draw(); } });
      }
      if (!party.length) container.appendChild(el('div', { class: 'empty' }, ['No one in the party yet.']));
      party.forEach((m) => container.appendChild(el('div', { class: 'member' }, [
        el('button', { class: 'card', type: 'button', onclick: () => Panels.select({ kind: 'party', id: m.id }) }, [
          el('div', { class: 'card-name' }, [m.name]),
          el('div', { class: 'card-meta muted small' }, [Sys().memberSubtitle(m)]),
          el('div', { class: 'card-text' }, [Sheet.tokenText(m)]),
        ]),
        el('div', { class: 'member-ops' }, [
          button('file', () => Sys().downloadCharacter(m), 'ghost tiny'),
          button('remove', () => { if (confirm('Remove ' + m.name + ' from the party?')) State.commit('removePartyMember', [m.id]); }, 'ghost tiny'),
        ]),
      ])));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    draw();
  }

  // ── Inspector ──────────────────────────────────────────────────────
  // An Icon: its copy's damage and Effects / States when opened from a scene's cast, a roller preset
  // from its own Skills, the Story Guide's notes about it, and its entry.
  const conditionNames = () => D.all().filter((e) => e.type === 'Effect' || e.type === 'State').map((e) => ({ name: e.name, type: e.type }));
  function copyTracker(e, sel) {
    const key = sel.iid || e.id;
    const dmg = Object.assign({}, (S().npcState || {})[key] || {});
    const setDmg = (k, v) => State.commit('setNpcState', [key, Object.assign({}, dmg, { [k]: Math.max(0, v) })]);
    const cond = ((S().npcConditions || {})[key] || []).slice();
    const toggle = (n) => State.commit('setNpcConditions', [key, cond.indexOf(n) === -1 ? cond.concat([n]) : cond.filter((x) => x !== n)]);
    return el('div', { class: 'copy-tracker paper' }, [
      el('div', { class: 'inst-name' }, [sel.label || e.name]),
      el('div', { class: 'pools' }, Sheet.pools(e, dmg).map((p) => el('div', { class: 'track pool-' + p.key }, [
        el('span', { class: 'track-k' }, [p.label]),
        p.max == null ? el('span', {}, [p.text]) : [
          button('−', () => setDmg(p.key, (dmg[p.key] || 0) + 1), 'ghost tiny'),
          el('b', { class: 'pool-v' }, [p.text]),
          button('+', () => setDmg(p.key, (dmg[p.key] || 0) - 1), 'ghost tiny'),
        ],
      ]))),
      el('div', { class: 'chiprow tight conds' }, conditionNames().map((c) => el('label', { class: 'chip' + (cond.indexOf(c.name) !== -1 ? ' on' : ''), title: c.type }, [
        el('input', { type: 'checkbox', checked: cond.indexOf(c.name) !== -1 || null, onchange: () => toggle(c.name) }), ' ', c.name,
      ]))),
      el('div', { class: 'muted small' }, ['Effects and States are shared with the players; the damage is yours.']),
    ]);
  }
  const iconRollers = {};
  function iconRoller(e) {
    if (iconRollers[e.id]) return iconRollers[e.id];
    const r = Dice.roller({ label: e.name, onResolve: (res) => State.commit('appendLog', [Dice.logEntry(res, 'Story Guide · ' + e.name)]) });
    iconRollers[e.id] = r;
    return r;
  }
  function renderInspector(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const sel = Panels.selection();
      if (!sel) return container.appendChild(el('div', { class: 'empty' }, ['Nothing selected. Click a name anywhere — a scene’s cast, a Skill, a rule.']));
      if (sel.kind === 'entity') {
        const e = D.entity(sel.id);
        if (!e) return container.appendChild(el('div', { class: 'empty' }, ['Not loaded: ' + sel.id]));
        const cur = Sys().currentSceneId();
        const sc = Sys().scene(cur);
        const isIcon = e.type === 'Icon' || e.type === 'Pregenerated Character';
        container.appendChild(el('div', { class: 'chiprow tight' }, [
          sc && isIcon ? button('Put in ' + sc.name, () => Sys().addToScene(cur, e.id, 1), 'tiny') : null,
          el('a', { class: 'btn ghost tiny', href: './#book/' + encodeURIComponent(e.book) + '/' + encodeURIComponent(e.id), target: '_blank' }, ['In the reader']),
        ]));
        if (isIcon && sel.iid) container.appendChild(copyTracker(e, sel));
        const line = Sheet.plain(D.prop(e, 'Stat Line'));
        if (line) {
          const r = iconRoller(e);
          const skills = Sheet.plain(D.prop(e, 'Skills')) || [];
          container.appendChild(el('div', { class: 'inspector-roll' }, [
            el('div', { class: 'chiprow tight' }, skills.map((s) => {
              const pl = Sheet.skillPool(line, s.Skill, s.Rank || 0);
              return button(s.Skill + ' ' + (s.Rank || 0) + (pl.pool != null ? ' · ' + pl.pool : ''), () => r.set({ pool: pl.pool != null ? pl.pool : s.Rank || 0, label: (sel.label || e.name) + ' · ' + s.Skill }), 'ghost tiny');
            })),
            r,
          ]));
        }
        const mine = G() && G().aboutSections && G().aboutSections('people', e.id, draw);
        if (mine) container.appendChild(mine);
        container.appendChild(el('div', { class: 'paper' }, [E.render(e)]));
      } else if (sel.kind === 'party') {
        const m = (S().party || []).find((x) => x.id === sel.id);
        if (!m) return container.appendChild(el('div', { class: 'empty' }, ['That Character is no longer in the party.']));
        container.appendChild(Sys().liveSheet(m));
        container.appendChild(el('div', { class: 'prop-k' }, ['Story Guide’s notes', el('span', { class: 'muted' }, [' · never sent to players'])]));
        container.appendChild(el('textarea', { class: 'text', rows: 3, 'aria-label': 'Notes on ' + m.name, oninput: debounce((ev) => State.commit('setPartyNotes', [m.id, ev.target.value]), 400) }, [m.notes || '']));
        const mine = G() && G().aboutSections && G().aboutSections('pc', m.name, draw);
        if (mine) container.appendChild(mine);
      } else container.appendChild(el('div', { class: 'empty' }, ['Nothing to show for ' + sel.kind + '.']));
    };
    ctx.on('select', draw);
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    draw();
  }

  // ── Icons: every Icon and Legend, to open or put in the running scene ─
  function renderIcons(container, ctx) {
    let q = '';
    const draw = () => {
      container.innerHTML = '';
      const cur = Sys().currentSceneId();
      const sc = Sys().scene(cur);
      const search = el('input', { type: 'search', class: 'search', placeholder: 'Find an Icon…', value: q, 'aria-label': 'Find an Icon' });
      const list = el('div');
      const drawList = () => {
        list.innerHTML = '';
        const all = D.icons().filter((r) => !q || r.name.toLowerCase().indexOf(q) !== -1);
        list.appendChild(el('div', { class: 'muted small' }, [all.length + ' Icons' + (sc ? ' · + puts one in ' + sc.name : '')]));
        list.appendChild(el('ul', { class: 'items toc' }, all.map((r) => el('li', {}, [
          el('button', { class: 'ref', type: 'button', onclick: () => window.CnCOpenEntity(r.id) }, [r.name]),
          (r.fields || {}).Type ? el('span', { class: 'muted small' }, [' · ' + r.fields.Type]) : null,
          sc ? el('button', { class: 'ref tiny', type: 'button', title: 'put in ' + sc.name, 'aria-label': 'Put ' + r.name + ' in ' + sc.name, onclick: () => Sys().addToScene(cur, r.id, 1) }, ['+']) : null,
        ]))));
      };
      search.addEventListener('input', debounce(() => { q = search.value.trim().toLowerCase(); drawList(); }, 150));
      container.appendChild(search);
      container.appendChild(list);
      drawList();
    };
    ctx.on('scene:changed', draw);
    draw();
  }

  // ── Dice ───────────────────────────────────────────────────────────
  let gmRoller = null;
  function renderDice(container, ctx) {
    container.innerHTML = '';
    if (!gmRoller) gmRoller = Dice.roller({ label: 'Story Guide', onResolve: (r) => State.commit('appendLog', [Dice.logEntry(r, 'Story Guide')]) });
    container.appendChild(gmRoller);
    container.appendChild(el('div', { class: 'muted small' }, ['The Story Guide’s own Check; a Character’s is on their sheet, an Icon’s in the Inspector.']));
    // what moves a Success Number, from the corpus
    const mods = D.all().filter((e) => e.type === 'Conditional Modifier');
    if (mods.length) {
      container.appendChild(el('h4', {}, ['Conditional Modifiers']));
      mods.forEach((e) => container.appendChild(el('details', { class: 'gm-sub' }, [el('summary', {}, [e.name]), E.render(e, { bare: true })])));
    }
  }

  // ── Rules & Book ───────────────────────────────────────────────────
  function renderRules(container, ctx) {
    container.innerHTML = '';
    const input = el('input', { type: 'search', class: 'search', placeholder: 'Search the book… ( / )', autocomplete: 'off', 'aria-label': 'Search the book' });
    const results = el('div', { class: 'results' });
    const ids = D.books().map((b) => b.id);
    const run = debounce(() => {
      results.innerHTML = '';
      const q = input.value.trim();
      if (q.length < 2) return;
      D.ensure(ids).then(() => {
        results.innerHTML = '';
        const hits = D.search(q, ids, 120);
        if (!hits.length) return results.appendChild(el('div', { class: 'empty' }, ['Nothing matches.']));
        results.appendChild(el('div', { class: 'muted small' }, [hits.length + (hits.length === 1 ? ' result' : ' results')]));
        hits.forEach((e) => results.appendChild(el('div', { class: 'hit' }, [
          el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name]),
          e.type ? el('span', { class: 'etype' }, [e.type]) : null,
          (() => { const ex = D.excerpt(e, q, 60); return ex ? el('div', { class: 'muted small' }, [ex]) : null; })(),
        ])));
      });
    }, 200);
    input.addEventListener('input', run);
    container.appendChild(el('div', { class: 'search-row' }, [input]));
    container.appendChild(results);
    // the play-time rules a Story Guide reaches for: Actions, Effects, States, Rests, Damage Sub-Types
    const TYPES = ['Action', 'Effect', 'State', 'Rest', 'Damage Sub-Type', 'Range Band'];
    TYPES.forEach((t) => {
      const list = D.all().filter((e) => e.type === t);
      if (!list.length) return;
      container.appendChild(el('details', { class: 'gm-sub' }, [el('summary', {}, [t + 's', el('span', { class: 'muted small' }, [' · ' + list.length])]),
        el('ul', { class: 'items toc' }, list.map((e) => el('li', {}, [el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name])])))]));
    });
    container.focusSearch = () => input.focus();
  }

  // ── Log ────────────────────────────────────────────────────────────
  function renderLog(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const log = (S().log || []).slice().reverse();
      if (!log.length) return container.appendChild(el('div', { class: 'empty' }, ['Nothing logged yet.']));
      log.forEach((x) => container.appendChild(Dice.logLine(x)));
    };
    ctx.on('state:changed', draw);
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Saga: the campaign, its party, its packs ───────────────────────
  function renderSaga(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const c = S().campaign;
      container.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Saga']), el('div', { class: 'prop-v' }, [el('input', { type: 'text', value: c.name || '', class: 'text', 'aria-label': 'Saga name', onchange: (ev) => State.commit('setCampaign', [{ name: ev.target.value }]) })])]));
      const m = mid() !== Sys().SAGA && D.moduleList().find((x) => x.id === mid());
      container.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Adventure']), el('div', { class: 'prop-v' }, [m ? m.name : '—'])]));
      const party = S().party || [];
      container.appendChild(el('h4', {}, ['The party', el('span', { class: 'muted small' }, [' · saved in the pack'])]));
      container.appendChild(party.length ? el('ul', { class: 'items' }, party.map((p) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'party', id: p.id }) }, [p.name]),
        el('span', { class: 'muted small' }, [' · ' + Sys().memberSubtitle(p)]),
      ]))) : el('div', { class: 'empty' }, ['No one yet.']));
      const list = State.listCampaigns();
      container.appendChild(el('h4', {}, ['Sagas in this browser']));
      container.appendChild(el('ul', { class: 'items' }, list.map((row) => el('li', {}, [
        row.id === State.id ? el('b', {}, [row.name || row.id]) : el('button', { class: 'ref', type: 'button', onclick: () => { State.switchTo(row.id); location.reload(); } }, [row.name || row.id]),
        row.id !== State.id ? button('remove', () => { if (confirm('Remove "' + row.name + '" from this browser? Save its pack first if you want it back.')) { State.remove(row.id); draw(); } }, 'ghost tiny') : null,
      ]))));
      const file = el('input', { type: 'file', accept: 'application/json', hidden: true, onchange: (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        f.text().then((txt) => { try { State.importPack(JSON.parse(txt)); location.reload(); } catch (e) { alert(e.message); } });
      } });
      container.appendChild(el('div', { class: 'chiprow' }, [
        button('New saga', () => { const n = prompt('Saga name'); if (n) { State.create(n, { campaign: { modules: [], books: [] } }); location.reload(); } }),
        button('Save pack (download)', () => State.downloadPack()),
        button('Restore pack…', () => file.click(), 'ghost'),
        file,
      ]));
      container.appendChild(el('p', { class: 'muted small' }, ['A pack is the saga as an instance: the party, the scenes, every note and roll, as JSON. Keep packs with the saga; this browser is a cache.']));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    draw();
  }

  Panels.register('adventure', { label: 'Adventure', render: renderAdventure });
  Panels.register('party', { label: 'Party', render: renderParty });
  Panels.register('inspector', { label: 'Inspector', render: renderInspector });
  Panels.register('icons', { label: 'Icons', render: renderIcons });
  Panels.register('dice', { label: 'Dice', render: renderDice });
  Panels.register('rules', { label: 'Rules & Book', render: renderRules });
  Panels.register('log', { label: 'Log', render: renderLog });
  Panels.register('campaign', { label: 'Saga', render: renderSaga });

  // the book loads with the page (one book: the types, the dice, the adventure)
  D.ensure(D.books().map((b) => b.id)).then(() => Bus.emit('state:remote', { loaded: true }, { local: true }));
  window.CnCPanels = { goTo, characterLoader, castBlock };
})();
