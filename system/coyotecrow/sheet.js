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
//   WEAPON_DICE    Weapons: "The Damage number, listed as +X, is the number of Dice that can be
//                   added to a Pool when someone rolls an attack with that weapon." and "You can
//                   not add more dice to your total Pool from a weapon than you have Skill with
//                   that weapon."
//   ITEM_SN        an item's `Success Number` effect that Applies To a Skill (a Suyata Kit's
//                   "-1 SN Survival") moves the default Success Number of that Skill's Check.
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

  const newId = () => (State() ? State().genId('pc') : 'pc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  // a character as a member: its fields by name, its pools full
  function memberFromCharacter(character, source) {
    const m = { id: newId(), templateId: ACTOR_ID, name: character.Name || 'A Character', source: source || { kind: 'file' }, character, live: {}, notes: '' };
    POOLS.forEach(([k, label]) => { const max = int((character['Stat Line'] || {})[label]); if (max != null) m.live[k] = max; });
    return m;
  }
  // a published character (a pregen)
  function memberFromEntity(e) {
    const character = {};
    (e.props || []).forEach((p) => (character[p.name] = plain(p)));
    if (!character.Name) character.Name = e.name;
    return memberFromCharacter(character, { kind: 'pregen', id: e.id });
  }
  // an item a Character carries, as the book lists it (the Equipment entry of that name, when there is one)
  const equipmentNamed = (n) => D.all().find((e) => e.type === 'Equipment' && e.name === n) || null;
  const itemEffects = (q) => (q.Effects && q.Effects.length ? q.Effects : []);
  const firstInt = (v) => { const m = /^\s*([+-]?\d+)/.exec(String(v == null ? '' : v)); return m ? parseInt(m[1], 10) : null; };
  // the Success Number a Skill's Check starts at: the default, moved by carried items that name it
  function skillSn(ch, skill) {
    let sn = Dice.RULES.DEFAULT_SN.v;
    const why = [];
    (ch.Equipment || []).forEach((q) => itemEffects(q).forEach((f) => {
      if (f.Kind === 'Success Number' && [].concat(f['Applies To'] || []).indexOf(skill) !== -1) { const d = firstInt(f.Value); if (d != null) { sn += d; why.push(q.Name + ' ' + f.Value); } }
    }));
    return { sn, why };
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
    const box = el('div', { class: 'sheet live' + (o.preview ? ' preview' : '') });
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
      p.max == null || o.preview ? el('span', {}, [p.text]) : [
        button('−', () => setLive({ [p.key]: Math.max(0, p.cur - 1) }, p.label + ' ' + p.cur + ' → ' + Math.max(0, p.cur - 1)), 'ghost tiny'),
        el('b', { class: 'pool-v' }, [p.cur + ' / ' + p.max]),
        button('+', () => setLive({ [p.key]: Math.min(p.max, p.cur + 1) }, p.label + ' ' + p.cur + ' → ' + Math.min(p.max, p.cur + 1)), 'ghost tiny'),
      ],
    ]))));
    // the roller, preset by a Skill; Focus spends Mind from the track
    const mind = pools(m).find((p) => p.key === 'mind');
    let r = o.preview ? null : rollers[m.id];
    if (!r && !o.preview) {
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
    // a Skill may carry several Skill Rank rows — one per Specialized Skill under it
    const ranks = {};
    (ch.Skills || []).forEach((s) => (ranks[s.Skill] = (ranks[s.Skill] || []).concat([s])));
    const skills = skillEntities();
    const rows = skills.map((sk) => {
      const have = ranks[sk.name] || [];
      const rank = have.length ? have[0].Rank || 0 : 0;
      const pl = skillPool(stats, sk.name, rank);
      const out = [{ name: sk.name, skill: sk.name, rank, pl }];
      have.filter((h) => h.Specialization).forEach((h) => out.push({ name: h.Specialization, skill: sk.name, rank: h['Specialization Rank'] || 0, pl: skillPool(stats, sk.name, h['Specialization Rank'] || 0), spec: sk.name }));
      return out;
    });
    const skillRow = (x) => el('tr', { class: (x.rank ? 'trained' : 'untrained') + (x.spec ? ' spec' : '') }, [
      el('td', {}, [x.spec ? el('span', { class: 'muted' }, ['↳ ']) : null, x.name, x.pl.needsRank ? '*' : '']),
      el('td', { class: 'num' }, [String(x.rank)]),
      el('td', { class: 'muted small' }, [x.pl.stat ? x.pl.stat + ' ' + x.pl.statValue : '']),
      el('td', {}, [x.pl.pool != null
        ? (o.preview ? el('span', { class: 'num' }, [String(x.pl.pool)]) : button(x.pl.pool + (x.pl.pool === 1 ? ' die' : ' dice'), () => {
          const cur = pools((S().party || []).find((y) => y.id === m.id) || m).find((p) => p.key === 'mind');
          const sn = skillSn(ch, x.skill);
          r.set({ pool: x.pl.pool, sn: sn.sn, label: m.name + ' · ' + x.name + ' ' + x.rank + (x.pl.stat ? ' + ' + x.pl.stat + ' ' + x.pl.statValue : '') + (sn.why.length ? ' · SN ' + sn.sn + ' (' + sn.why.join(', ') + ')' : ''), mind: cur && cur.cur != null ? cur.cur : 0 });
          r.scrollIntoView({ block: 'nearest' });
        }, 'ghost tiny'))
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
      o.preview ? null : el('div', { class: 'sheet-roll' }, [r]),
    ]));
    // attacks: a carried weapon's Damage +X adds dice, never more than the Rank in its Skill
    const attacks = (ch.Equipment || []).map((q) => {
      const dmg = itemEffects(q).find((f) => f.Kind === 'Damage');
      if (!dmg || firstInt(dmg.Value) == null) return null;
      const eq = equipmentNamed(q.Name);
      const cls = eq && D.text(eq, 'Class');
      const skill = skills.some((k) => k.name === cls) ? cls : null;
      return { q, add: firstInt(dmg.Value), skill };
    }).filter(Boolean);
    if (attacks.length && !o.preview) {
      const combat = ['Melee Weapons', 'Ranged Weapons', 'Unarmed Combat'].filter((n) => skills.some((k) => k.name === n));
      box.appendChild(el('div', { class: 'sheet-list attacks' }, [
        el('div', { class: 'track-k' }, ['Attacks', el('span', { class: 'muted' }, [' · a weapon adds its +X in dice, never more than your Rank in its Skill'])]),
        el('ul', { class: 'items rows' }, attacks.map((a) => {
          const sel = a.skill ? null : el('select', { class: 'scope tiny', 'aria-label': 'Which Skill for ' + a.q.Name }, combat.map((n) => el('option', { value: n }, [n])));
          const roll = () => {
            const skill = a.skill || sel.value;
            const have = (ranks[skill] || [])[0];
            const rank = have ? have.Rank || 0 : 0;
            const pl = skillPool(stats, skill, rank);
            const extra = Math.min(a.add, rank);
            const cur = pools((S().party || []).find((y) => y.id === m.id) || m).find((p) => p.key === 'mind');
            r.set({ pool: (pl.pool || 0) + extra, label: m.name + ' · ' + a.q.Name + ' · ' + skill + ' ' + rank + (pl.stat ? ' + ' + pl.stat + ' ' + pl.statValue : '') + ' + ' + extra + ' from the weapon' + (extra < a.add ? ' (of +' + a.add + ', capped at the Rank)' : ''), mind: cur && cur.cur != null ? cur.cur : 0 });
            r.scrollIntoView({ block: 'nearest' });
          };
          return el('li', {}, [el('b', {}, [a.q.Name]), ' +' + a.add + ' ', a.skill ? el('span', { class: 'muted small' }, [a.skill + ' ']) : sel, button('Attack', roll, 'ghost tiny')]);
        })),
      ]));
    }
    // Abilities, Gifts and Burdens, Equipment, as the Character prints them
    const add = (node) => { if (node) box.appendChild(node); };
    const list = (label, items, fn) => (items && items.length ? el('div', { class: 'sheet-list' }, [el('div', { class: 'track-k' }, [label]), el('ul', { class: 'items rows' }, items.map((x) => el('li', {}, [fn(x)])))]) : null);
    add(list('Abilities', ch.Abilities, (a) => E.link({ name: a }, 'core')));
    add(list('Gifts and Burdens', ch['Gifts and Burdens'], (g) => el('span', {}, [el('b', {}, [g.Kind || '']), g.Name ? ': ' + g.Name : '', g.Level != null ? ' (' + g.Level + ')' : '', g['Taken As'] ? el('span', { class: 'chip' }, [g['Taken As']]) : null, g.Effect ? [' — ', E.span(g.Effect, 'core')] : null])));
    add(list('Equipment', ch.Equipment, (q) => (q.Printed ? E.span(q.Printed, 'core') : el('span', {}, [E.link({ name: q.Name }, 'core'), itemEffects(q).length ? el('span', { class: 'effects' }, itemEffects(q).map((f) => el('span', { class: 'effect' }, [el('span', { class: 'effect-k' }, [f.Kind]), ' ', String(f.Value == null ? '' : f.Value), f['Applies To'] ? el('span', { class: 'muted' }, [' ' + [].concat(f['Applies To']).join(', ')]) : null]))) : null]))));
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

  return { ACTOR, ACTOR_ID, memberFromEntity, memberFromCharacter, pools, tokenText, sentence, skillPool, skillSn, live, readMember, downloadMember, plain };
})();
