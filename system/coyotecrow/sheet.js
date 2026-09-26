// system/coyotecrow/sheet.js — a Character's live sheet, derived from the corpus's `ACTOR
// "Character"` (BASE 0.5.4, the owner's D1) at runtime: every field the ACTOR declares is shown,
// the ones the printed sheet lays out as a grid laid out so — the nine Stats by Aspect and Domain,
// the Derived Stats, Body / Mind / Soul as tracks against their current values, all 28 General
// Skills with the Dice Pool the book's rule gives each. The tool's words are labels only.
//
// A member is { id, templateId: the Character ACTOR's hash, name, source, character, live }:
// `character` holds the ACTOR's fields by their own names, as the corpus prints them (a Stat Line's
// values stay strings — "6(7)"); `live` is what changes at the table: { body, mind, soul } current.
//
//   The Skill rule (Rules of the Game › Creating Dice Pools), each clause a named constant:
//   SKILL_TRAINED  "If the Character has at least 1 Rank in a Skill, then the Player uses the
//                   higher of the two Related Stats."
//   SKILL_UNTRAINED "If the Character has a 0 Rank in a Skill then they use the lower of the two
//                   Related Stats."
//   SKILL_ASTERISK "If the Skill has an asterisk (*), the Character cannot use the Skill at Rank 0."
//   FOCUS          "the Player may spend any number of points from Mind to adjust the value of
//                   any die" — the Mind a roll spends on Focus comes off the Mind track.
window.CnCSheet = (function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.CnCData;
  const E = window.CnCEntity;
  const Dice = window.CnCDice;
  const State = () => window.VttState;
  const S = () => State().state;

  const ACTOR = 'Character';
  const ACTOR_ID = '#cnc5Character000001';
  const POOLS = [['body', 'Body'], ['mind', 'Mind'], ['soul', 'Soul']];
  const STATS = ['Strength', 'Agility', 'Endurance', 'Intelligence', 'Perception', 'Wisdom', 'Spirit', 'Charisma', 'Will'];
  // what the sheet lays out itself; every other declared field is listed as a field
  const LAID_OUT = ['Name', 'Stat Line', 'Skills', 'Abilities', 'Gifts and Burdens', 'Equipment', 'Body (current)', 'Mind (current)', 'Soul (current)'];

  // ── a DSL property's value as plain data (a list of DEF rows as objects) ──
  function plain(p) {
    if (!p) return undefined;
    if (p.vk === 'def') { const o = {}; (p.fields || []).forEach((f) => (o[f.name] = plain(f))); return o; }
    if (p.vk === 'list') return (p.items || []).map((it) => ('d' in it ? rowOf(it.d) : D.arg(it)));
    return D.pval(p);
  }
  function rowOf(d) {
    const o = {};
    (d || []).forEach((f) => { if (f && f.name) o[f.name] = plain(f); });
    return o;
  }
  const int = (v) => (/^\s*\d+\s*$/.test(String(v == null ? '' : v)) ? parseInt(v, 10) : null);

  // a published character (a pregen) as a member: its fields by name, its pools full
  function memberFromEntity(e) {
    const character = {};
    (e.props || []).forEach((p) => (character[p.name] = plain(p)));
    const m = { id: State().genId('pc'), templateId: ACTOR_ID, name: character.Name || e.name, source: { kind: 'pregen', id: e.id }, character, live: {}, notes: '' };
    POOLS.forEach(([k, label]) => { const max = int((character['Stat Line'] || {})[label]); if (max != null) m.live[k] = max; });
    return m;
  }

  // Body / Mind / Soul for a member, or for an Icon (its damage taken, the Story Guide's own)
  function pools(x, damage) {
    const isEntity = !!(x && x.props);
    const line = isEntity ? plain(D.prop(x, 'Stat Line')) || {} : (x.character || {})['Stat Line'] || {};
    return POOLS.map(([k, label]) => {
      const max = int(line[label]);
      const cur = isEntity ? (max == null ? null : Math.max(0, max - ((damage || {})[k] || 0))) : ((x.live || {})[k] != null ? x.live[k] : max);
      return { key: k, label, max, cur, text: max == null ? String(line[label] == null ? '—' : line[label]) : cur + '/' + max };
    });
  }
  const tokenText = (m) => pools(m).map((p) => p.label + ' ' + p.text).join(' · ');
  const sentence = (ch) => [ch.Archetype, ch.Path, ch.Motivation].filter(Boolean).join(' · ');

  // ── the Skill rule ─────────────────────────────────────────────────
  const skillEntities = () => D.all().filter((e) => e.type === 'Skill');
  // the dice a Skill gives: its Rank plus the higher Related Stat — the lower at Rank 0, none for an
  // asterisked Skill at Rank 0. A Stat printed as a range or a modified value ("6(8)") is not a
  // single number, so the pool is left for the player to set.
  function skillPool(stats, skillName, rank) {
    const sk = skillEntities().find((e) => e.name === skillName);
    const related = sk ? [].concat(D.val(sk, 'Related Stats') || []) : [];
    const values = related.map((n) => int(stats[n])).filter((v) => v != null);
    const needsRank = sk ? !!D.val(sk, 'Requires Rank') : false;
    if (!rank && needsRank) return { pool: null, why: skillName + ' cannot be used at Rank 0', related, needsRank };
    if (values.length !== related.length || !values.length) return { pool: null, why: 'Related Stats not numbers', related, needsRank };
    const stat = rank ? Math.max.apply(null, values) : Math.min.apply(null, values);
    const which = related[values.indexOf(stat)];
    return { pool: (rank || 0) + stat, stat: which, statValue: stat, related, needsRank };
  }

  // ── the live sheet ─────────────────────────────────────────────────
  const rollers = {};
  function live(m, opts) {
    const o = opts || {};
    const ch = m.character || {};
    const stats = ch['Stat Line'] || {};
    const box = el('div', { class: 'sheet live' });
    const setLive = (patch, why) => {
      State().commit('setPartyLive', [m.id, patch]);
      if (why) State().commit('appendLog', [{ kind: 'event', who: m.name, memberId: m.id, summary: why, at: Date.now() }]);
    };
    box.appendChild(el('div', { class: 'sheet-head' }, [
      el('div', { class: 'sheet-name' }, [m.name]),
      el('div', { class: 'muted small' }, [sentence(ch) || '—']),
    ]));
    // the Stats grid and the Derived Stats, drawn as the reader draws a Stat Line
    const fake = { props: [{ name: 'Stat Line', vk: 'def', fields: Object.keys(stats).map((k) => ({ name: k, value: stats[k], vk: 'scalar' })) }] };
    const strip = E.statStrip(fake);
    if (strip) box.appendChild(strip);
    // Body, Mind, Soul: current against the Stat Line's value
    box.appendChild(el('div', { class: 'pools' }, pools(m).map((p) => el('div', { class: 'track pool-' + p.key }, [
      el('span', { class: 'track-k' }, [p.label]),
      p.max == null ? el('span', {}, [p.text]) : [
        button('−', () => setLive({ [p.key]: Math.max(0, p.cur - 1) }, p.label + ' ' + p.cur + ' → ' + Math.max(0, p.cur - 1)), 'ghost tiny'),
        el('b', { class: 'pool-v' }, [p.cur + ' / ' + p.max]),
        button('+', () => setLive({ [p.key]: Math.min(p.max, p.cur + 1) }, p.label + ' ' + p.cur + ' → ' + Math.min(p.max, p.cur + 1)), 'ghost tiny'),
      ],
    ]))));
    // the roller, preset by a Skill; Focus spends Mind from the track
    const mind = pools(m).find((p) => p.key === 'mind');
    let r = rollers[m.id];
    if (!r) {
      r = rollers[m.id] = Dice.roller({
        legendary: ch['Legendary Ranks'] || 0, mind: mind && mind.cur != null ? mind.cur : 0,
        onResolve: (res) => {
          State().commit('appendLog', [Dice.logEntry(res, m.name, m.id)]);
          const cur = pools((S().party || []).find((x) => x.id === m.id) || m).find((p) => p.key === 'mind');
          if (res.focus && cur && cur.cur != null) setLive({ mind: Math.max(0, cur.cur - res.focus) }, 'Focus: ' + res.focus + ' Mind spent (' + cur.cur + ' → ' + Math.max(0, cur.cur - res.focus) + ')');
        },
      });
    }
    // the General Skills, every one, with the Rank this Character has in it (0 when unlisted)
    const ranks = {};
    (ch.Skills || []).forEach((s) => (ranks[s.Skill] = s));
    const skills = skillEntities();
    const rows = skills.map((sk) => {
      const have = ranks[sk.name];
      const rank = have ? have.Rank || 0 : 0;
      const pl = skillPool(stats, sk.name, rank);
      const rows = [{ name: sk.name, rank, pl }];
      if (have && have.Specialization) rows.push({ name: have.Specialization, rank: have['Specialization Rank'] || 0, pl: skillPool(stats, sk.name, have['Specialization Rank'] || 0), spec: sk.name });
      return rows;
    });
    const skillRow = (x) => el('tr', { class: (x.rank ? 'trained' : 'untrained') + (x.spec ? ' spec' : '') }, [
      el('td', {}, [x.spec ? el('span', { class: 'muted' }, ['↳ ']) : null, x.name, x.pl.needsRank ? '*' : '']),
      el('td', { class: 'num' }, [String(x.rank)]),
      el('td', { class: 'muted small' }, [x.pl.stat ? x.pl.stat + ' ' + x.pl.statValue : '']),
      el('td', {}, [x.pl.pool != null
        ? button(x.pl.pool + (x.pl.pool === 1 ? ' die' : ' dice'), () => {
          const cur = pools((S().party || []).find((y) => y.id === m.id) || m).find((p) => p.key === 'mind');
          r.set({ pool: x.pl.pool, label: m.name + ' · ' + x.name + ' ' + x.rank + (x.pl.stat ? ' + ' + x.pl.stat + ' ' + x.pl.statValue : ''), mind: cur && cur.cur != null ? cur.cur : 0 });
          r.scrollIntoView({ block: 'nearest' });
        }, 'ghost tiny')
        : el('span', { class: 'muted small', title: x.pl.why }, ['—'])]),
    ]);
    box.appendChild(el('div', { class: 'sheet-cols' }, [
      el('div', { class: 'sheet-skills' }, [
        el('div', { class: 'track-k' }, ['Skills', el('span', { class: 'muted' }, [' · Rank + the higher Related Stat; the lower at Rank 0; * none at Rank 0'])]),
        el('table', { class: 'printed skills' }, [
          el('thead', {}, [el('tr', {}, ['Skill', 'Rank', 'Stat', 'Pool'].map((h) => el('th', {}, [h])))]),
          el('tbody', {}, [].concat.apply([], rows).filter((x) => o.allSkills !== false || x.rank).map(skillRow)),
        ]),
      ]),
      el('div', { class: 'sheet-roll' }, [r]),
    ]));
    // Abilities, Gifts and Burdens, Equipment, as the Character prints them
    const list = (label, items, fn) => (items && items.length ? el('div', { class: 'sheet-list' }, [el('div', { class: 'track-k' }, [label]), el('ul', { class: 'items rows' }, items.map((x) => el('li', {}, [fn(x)])))]) : null);
    box.appendChild(list('Abilities', ch.Abilities, (a) => E.link({ name: a }, 'core')));
    box.appendChild(list('Gifts and Burdens', ch['Gifts and Burdens'], (g) => el('span', {}, [el('b', {}, [g.Kind || '']), g.Name ? ': ' + g.Name : '', g.Level != null ? ' (' + g.Level + ')' : '', g.Effect ? [' — ', E.span(g.Effect, 'core')] : null])));
    box.appendChild(list('Equipment', ch.Equipment, (q) => (q.Printed ? E.span(q.Printed, 'core') : E.link({ name: q.Name }, 'core'))));
    // every other field the ACTOR declares, as a field
    const decl = D.declared(ACTOR).props.filter((p) => LAID_OUT.indexOf(p.name) === -1);
    const rest = decl.map((p) => {
      const v = ch[p.name] !== undefined ? ch[p.name] : p.default;
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
      return el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [p.name]), el('div', { class: 'prop-v' }, [Array.isArray(v) ? v.join(' · ') : String(v)])]);
    }).filter(Boolean);
    if (rest.length) box.appendChild(el('div', { class: 'fields' }, rest));
    if (o.player) {
      box.appendChild(el('div', { class: 'player-notes' }, [
        el('div', { class: 'track-k' }, ['My notes']),
        el('textarea', { class: 'text', rows: 4, oninput: debounce((ev) => State().commit('setPartyPlayerNotes', [m.id, ev.target.value]), 400) }, [m.playerNotes || '']),
      ]));
    }
    return box;
  }

  // ── files ──────────────────────────────────────────────────────────
  function readMember(obj, fileName) {
    if (!obj || obj.templateId !== ACTOR_ID || !obj.character) throw new Error((fileName || 'That file') + ' is not a Coyote & Crow character file.');
    const m = Object.assign({ id: State().genId('pc'), live: {}, notes: '' }, obj, { source: Object.assign({ kind: 'file', name: fileName || null }, obj.source && obj.source.kind === 'pregen' ? { from: obj.source.id } : {}) });
    m.name = m.name || m.character.Name || 'A Character';
    return m;
  }
  function downloadMember(m) {
    const out = { templateId: m.templateId, name: m.name, character: m.character, live: m.live, source: m.source, versions: m.versions || [] };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = String(m.name || 'character').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  return { ACTOR, ACTOR_ID, memberFromEntity, pools, tokenText, sentence, skillPool, live, readMember, downloadMember, plain };
})();
