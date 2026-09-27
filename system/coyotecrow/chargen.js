// system/coyotecrow/chargen.js — character creation as the book states it (Crafting Your Hero ›
// Characters), read from the corpus and computed without a page: the creator (creator.js) draws it,
// build/check_chargen.js gates it. No DOM here.
//
// Every number is read from the corpus at runtime — a TABLE where the book prints one, else the
// sentence that states it, matched by a pattern that must match or the rule reports itself missing
// (and the build gate fails):
//
//   POINTS            Character Points: "Gifts and Burdens: 5 points Stats: 42 points Skills and
//                     Skill Ranks: 42 points"
//   STAT_COST         Generating Your Initial Stats: "Stat Value 1 2 3 4 5 Character Point Cost
//                     0 3 6 10 15" (the corpus carries this table as prose — its TODO, gap 1)
//   STAT_CAP          "starting Stats may not go above 5 except through the points granted by a
//                     Character’s Path"
//   NOTORIETY         Stats: "Anyone with a Stat of 6 or higher must also take the Notoriety Gift
//                     at Level 1 or higher"
//   SKILL_COST        the Skills Table (TABLE): General and Specialized cost by Rank, "X" = none
//   SKILL_ADVISED     Skills: "we recommend that no starting Character have a Rank higher than six"
//   ARCHETYPE         each Archetype's "receive +1 to <Stat>" and "a free Rank in <A> or <B>"
//                     sentences (prose — the corpus's TODO, gap 2); applied after the points
//   PATH              each Path's Related Stats: +1 to each; the Ability from one of them
//   GOALS             Initial Goals: "choose two Short-Term Goals and one Long- Term Goal"
//   WEALTH            the Character ACTOR's `^"Wealth Rank" DEFAULT 4`; Financial as a Burden:
//                     "each Level reduces your Wealth Rank by 1"
//   GEAR              Starting Equipment: any below the Wealth Rank, "three items equal to", "one
//                     item equal to their Wealth Rank +1" — the book's baseline, advisory
//   DERIVED           each Derived Stat's Components (its Formula's parts)
window.CnCChargen = (function () {
  const D = () => window.CnCData;
  const all = () => D().all();
  const byType = (t) => all().filter((e) => e.type === t);
  const named = (n) => all().find((e) => e.name === n && !e.type) || all().find((e) => e.name === n) || null;
  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const num = (w) => (/^\d+$/.test(w) ? parseInt(w, 10) : WORDS[String(w).toLowerCase()]);
  const flat = (s) => String(s || '').replace(/\s+/g, ' ');

  // The Stat Line names the Derived Stat "Mystical Defense" as "Spiritual Defense" (the sheet's
  // "SD", every pregen and Icon); the book prints both. Corpus TODO, gap 3.
  const STAT_LINE_NAME = { 'Mystical Defense': 'Spiritual Defense', 'Initiative Score': null };

  // ── the rules, read ──────────────────────────────────────────────
  let cache = null;
  function rules() {
    if (cache) return cache;
    const r = { missing: [] };
    const need = (key, ok, text) => { if (!ok) r.missing.push(key + ': ' + text); return ok; };
    const cp = flat((named('Character Points') || {}).desc);
    const m1 = /Gifts and Burdens: (\d+) points Stats: (\d+) points Skills and Skill Ranks: (\d+) points/.exec(cp);
    if (need('POINTS', m1, 'the three pools in Character Points')) r.points = { gb: +m1[1], stats: +m1[2], skills: +m1[3] };
    const gs = flat((named('Generating Your Initial Stats') || {}).desc);
    const m2 = /Stat Value ([\d ]+?) Character Point Cost ([\d ]+?) Important/.exec(gs);
    if (need('STAT_COST', m2, 'the Stat Value / Character Point Cost row')) {
      const v = m2[1].trim().split(' ').map(Number);
      const c = m2[2].trim().split(' ').map(Number);
      if (need('STAT_COST', v.length === c.length, 'as many costs as values')) { r.statCost = {}; v.forEach((x, i) => (r.statCost[x] = c[i])); r.statMin = v[0]; r.statMax = v[v.length - 1]; }
    }
    const m3 = /starting Stats may not go above (\d+) except through the points granted by a Character’s Path/.exec(gs);
    if (need('STAT_CAP', m3, 'the cap before the Path')) r.statCap = +m3[1];
    const st = flat((named('Stats') || {}).desc);
    const m4 = /Anyone with a Stat of (\d+) or higher must also take the Notoriety Gift at Level (\d+) or higher/.exec(st);
    if (need('NOTORIETY', m4, 'the Notoriety sentence')) r.notoriety = { at: +m4[1], level: +m4[2] };
    const tbl = (named('Skills Table') || {}).table;
    if (need('SKILL_COST', tbl && tbl.rows.length, 'the Skills Table')) {
      r.skillCost = { general: {}, special: {} };
      tbl.rows.forEach((row) => {
        const rank = +row[0];
        r.skillCost.general[rank] = /^\d+$/.test(row[1]) ? +row[1] : null;
        r.skillCost.special[rank] = /^\d+$/.test(row[2]) ? +row[2] : null;
      });
      r.skillMax = Math.max.apply(null, tbl.rows.map((x) => +x[0]));
    }
    const sk = flat((named('Skills') || {}).desc);
    const m5 = /no starting Character have a Rank higher than (\w+) on any one Skill/.exec(sk);
    if (need('SKILL_ADVISED', m5, 'the advised starting Rank')) r.skillAdvised = num(m5[1]);
    const go = flat((named('Initial Goals') || {}).desc);
    const m6 = /choose (\w+) Short-Term Goals and (\w+) Long- ?Term Goal/.exec(go);
    if (need('GOALS', m6, 'the number of Goals')) r.goals = { short: num(m6[1]), long: num(m6[2]) };
    const wr = (D().declared('Character').props.find((p) => p.name === 'Wealth Rank') || {}).default;
    if (need('WEALTH', wr != null, 'the Character ACTOR’s Wealth Rank DEFAULT')) r.wealth = wr;
    const fin = flat(D().text(all().find((e) => e.type === 'Gift or Burden' && e.name === 'Financial'), 'Description'));
    const m7 = /As a Burden, each Level reduces your Wealth Rank by (\d+)/.exec(fin);
    if (need('WEALTH', m7, 'the Financial Burden')) r.financialBurden = +m7[1];
    const eq = flat((named('Starting Equipment') || {}).desc);
    const m8 = /start with (\w+) items equal to their Wealth Rank and.*?start with (\w+) item equal to their Wealth Rank \+(\d+)/.exec(eq);
    if (need('GEAR', m8, 'the starting-gear baseline')) r.gear = { equal: num(m8[1]), above: num(m8[2]), aboveBy: +m8[3] };
    r.archetypes = archetypes(r);
    r.paths = byType('Path').map((e) => ({ id: e.id, name: e.name, stats: [].concat(D().val(e, 'Related Stats') || []) }));
    r.derived = byType('Derived Stat').map((e) => ({ id: e.id, name: e.name, parts: [].concat(D().val(e, 'Components') || []), formula: D().text(e, 'Formula') }));
    need('DERIVED', r.derived.length && r.derived.every((x) => x.parts.length), 'every Derived Stat has Components');
    return (cache = r);
  }
  // "Warriors … receive +1 to Strength during Character creation." / "… a free Rank in Unarmed
  // Combat or Melee Weapons Skills." / "… a free Rank in either a Specialized Knowledge Skill or
  // Crafting." Each option names a Skill, or a Specialized Skill of one.
  function archetypes(r) {
    const skills = byType('Skill').map((e) => e.name);
    return byType('Archetype').map((e) => {
      const t = flat(D().text(e, 'Description'));
      const s = /receive \+(\d+) to (\w+) during Character creation/.exec(t);
      const k = /receive a free [Rr]ank in (?:either )?(.+?)\./.exec(t);
      const options = k ? k[1].split(/ or /).map((o) => {
        const x = o.replace(/^a /, '').replace(/ Skills?$/, '').trim();
        const sp = /^Specialized (.+)$/.exec(x);
        const name = sp ? sp[1] : x;
        return { label: o.trim(), skill: skills.indexOf(name) !== -1 ? name : null, spec: !!sp };
      }) : [];
      const a = { id: e.id, name: e.name, stat: s ? s[2] : null, bonus: s ? +s[1] : 0, options, sentences: [s && s[0], k && k[0]].filter(Boolean) };
      if (!a.stat || !options.length || options.some((o) => !o.skill)) r.missing.push('ARCHETYPE ' + e.name + ': its Stat or free Skill sentence');
      return a;
    });
  }

  // ── the lists a step picks from ──────────────────────────────────
  const motivations = () => byType('Motivation');
  const archetype = (name) => rules().archetypes.find((a) => a.name === name) || null;
  const path = (name) => rules().paths.find((p) => p.name === name) || null;
  const statNames = () => byType('Stat').map((e) => e.name);
  const skillList = () => byType('Skill').map((e) => ({ id: e.id, name: e.name, related: [].concat(D().val(e, 'Related Stats') || []), needsRank: !!D().val(e, 'Requires Rank'), specs: [].concat(D().val(e, 'Specializations') || []) }));
  const abilitiesFor = (stats) => byType('Ability').filter((e) => stats.indexOf(D().text(e, 'Stat')) !== -1);
  const giftKinds = () => byType('Gift or Burden').map((e) => ({ id: e.id, name: e.name, as: [].concat(D().val(e, 'Available As') || []), levels: [].concat(D().val(e, 'Levels') || []).map(Number) }));
  const equipment = () => byType('Equipment');
  const nations = () => byType('Nation');

  // ── a fresh draft ────────────────────────────────────────────────
  function blank() {
    const stats = {};
    statNames().forEach((s) => (stats[s] = rules().statMin || 1));
    return {
      motivation: '', archetype: '', archetypeSkill: 0, archetypeSpec: '', age: '', identifiers: '', nation: '', path: '',
      gb: [], gbToStats: 0, stats, skills: {}, specs: [], ability: '', equipment: [], background: '',
      short: [], long: '', name: '',
    };
  }

  // ── compute: points, the final numbers, the problems, the character ─
  function compute(dr) {
    const R = rules();
    const errors = [];
    const notes = [];
    // Gifts and Burdens: a Gift Level costs a point, a Burden Level grants one
    let gifts = 0;
    let burdens = 0;
    (dr.gb || []).forEach((g) => { if (g.takenAs === 'Burden') burdens += g.level || 0; else gifts += g.level || 0; });
    const gbLeft = R.points.gb - gifts + burdens;
    if (gbLeft < 0) errors.push({ step: 'gifts', text: 'Gifts and Burdens end at ' + gbLeft + ' points — “You cannot have negative points at the end of this step.”' });
    const extra = Math.max(0, gbLeft);
    const toStats = Math.max(0, Math.min(extra, dr.gbToStats || 0));
    const toSkills = extra - toStats;
    // Stats: bought, then the Archetype's and the Path's points
    const arch = archetype(dr.archetype);
    const pth = path(dr.path);
    const bought = Object.assign({}, dr.stats);
    let statSpent = 0;
    const final = {};
    statNames().forEach((s) => {
      const v = bought[s] || R.statMin;
      if (R.statCost[v] == null) errors.push({ step: 'stats', text: s + ' ' + v + ' is not on the cost table' });
      statSpent += R.statCost[v] || 0;
      let f = v;
      if (arch && arch.stat === s) f += arch.bonus;
      if (f > R.statCap) errors.push({ step: 'stats', text: s + ' is ' + f + ' before the Path — “starting Stats may not go above ' + R.statCap + ' except through the points granted by a Character’s Path”' });
      if (pth && pth.stats.indexOf(s) !== -1) f += 1;
      final[s] = f;
    });
    const statPool = R.points.stats + toStats;
    if (statSpent > statPool) errors.push({ step: 'stats', text: statSpent + ' Stat points spent of ' + statPool });
    const high = statNames().filter((s) => final[s] >= R.notoriety.at);
    const noto = (dr.gb || []).filter((g) => g.kind === 'Notoriety' && (g.level || 0) >= R.notoriety.level);
    if (high.length && !noto.length) errors.push({ step: 'gifts', text: high.join(', ') + ' ' + (high.length === 1 ? 'is' : 'are') + ' ' + R.notoriety.at + ' or higher — “must also take the Notoriety Gift at Level ' + R.notoriety.level + ' or higher”' });
    // Skills: General and Specialized Ranks bought; then the Archetype's free Rank
    let skillSpent = 0;
    const ranks = {};
    skillList().forEach((k) => {
      const v = (dr.skills || {})[k.name] || 0;
      ranks[k.name] = v;
      if (v) {
        const c = R.skillCost.general[v];
        if (c == null) errors.push({ step: 'skills', text: k.name + ' ' + v + ' is not on the Skills Table' });
        else skillSpent += c;
      }
      if (v > R.skillAdvised) notes.push({ step: 'skills', text: k.name + ' ' + v + ' — “we recommend that no starting Character have a Rank higher than ' + R.skillAdvised + ' on any one Skill”' });
    });
    const specs = (dr.specs || []).filter((s) => s.skill && s.name);
    specs.forEach((s) => {
      const c = R.skillCost.special[s.rank];
      if (c == null) errors.push({ step: 'skills', text: s.name + ' (' + s.skill + ') at Rank ' + s.rank + ' costs “X” — a Specialized Skill cannot be bought at that Rank' });
      else skillSpent += c;
      if (!ranks[s.skill]) errors.push({ step: 'skills', text: s.name + ': “In order to gain a Specialized Skill, the Character must also have the connected General Skill.”' });
      else if (!(s.rank > ranks[s.skill])) errors.push({ step: 'skills', text: s.name + ' ' + s.rank + ': “Specialized Skill Ranks must always be higher than their related General Skill Rank when first taken.”' });
    });
    const skillPool = R.points.skills + toSkills;
    if (skillSpent > skillPool) errors.push({ step: 'skills', text: skillSpent + ' Skill points spent of ' + skillPool });
    // the free Rank, after the points (“Once you’re finished spending points, add +1 Rank …”)
    const finalRanks = Object.assign({}, ranks);
    const finalSpecs = specs.map((s) => Object.assign({}, s));
    const opt = arch && arch.options[dr.archetypeSkill || 0];
    if (opt) {
      if (opt.spec) {
        const sp = finalSpecs.find((s) => s.skill === opt.skill && s.name === dr.archetypeSpec);
        if (sp) sp.rank += 1;
        else if (dr.archetypeSpec) finalSpecs.push({ skill: opt.skill, name: dr.archetypeSpec, rank: 1, free: true });
        else errors.push({ step: 'archetype', text: arch.name + '’s free Rank goes to a Specialized ' + opt.skill + ' Skill — name it' });
      } else finalRanks[opt.skill] = (finalRanks[opt.skill] || 0) + 1;
    }
    // Ability: one, from a Path Related Stat
    if (dr.ability && pth && !abilitiesFor(pth.stats).some((e) => e.name === dr.ability)) errors.push({ step: 'ability', text: dr.ability + ' is not an Ability of ' + pth.stats.join(' or ') });
    // Wealth Rank: the default, less the Financial Burden's Levels
    const finBurden = (dr.gb || []).filter((g) => g.kind === 'Financial' && g.takenAs === 'Burden').reduce((a, g) => a + (g.level || 0), 0);
    const wealth = R.wealth - finBurden * R.financialBurden;
    // Equipment and the book's baseline
    const eq = (dr.equipment || []).map((n) => equipment().find((e) => e.name === n)).filter(Boolean);
    const cr = (e) => parseInt(D().text(e, 'Cost Rank'), 10);
    const equal = eq.filter((e) => cr(e) === wealth).length;
    const above = eq.filter((e) => cr(e) === wealth + R.gear.aboveBy).length;
    const over = eq.filter((e) => cr(e) > wealth + R.gear.aboveBy || (cr(e) > wealth && cr(e) !== wealth + R.gear.aboveBy));
    if (equal > R.gear.equal) notes.push({ step: 'equipment', text: equal + ' items at Cost Rank ' + wealth + ' — the baseline is “' + R.gear.equal + ' items equal to their Wealth Rank”' });
    if (above > R.gear.above) notes.push({ step: 'equipment', text: above + ' items at Cost Rank ' + (wealth + R.gear.aboveBy) + ' — the baseline is “' + R.gear.above + ' item equal to their Wealth Rank +' + R.gear.aboveBy + '”' });
    over.forEach((e) => notes.push({ step: 'equipment', text: e.name + ' (Cost Rank ' + cr(e) + ') is above the baseline — your Story Guide’s call' }));
    // Derived Stats, from each one's Components; armor's Defence effects shown as the book prints them, "6(7)"
    const derived = {};
    R.derived.forEach((x) => {
      const base = x.parts.reduce((a, p) => a + (final[p] || 0), 0);
      const mod = eq.reduce((a, e) => a + effects(e).filter((f) => f.Kind === 'Defence' && [].concat(f['Applies To'] || []).indexOf(STAT_LINE_NAME[x.name] || x.name) !== -1).reduce((b, f) => b + (parseInt(f.Value, 10) || 0), 0), 0);
      derived[x.name] = { base, mod, text: mod ? base + '(' + (base + mod) + ')' : String(base) };
    });
    // the character, in the ACTOR's own fields
    const statLine = {};
    statNames().forEach((s) => (statLine[s] = String(final[s])));
    R.derived.forEach((x) => { const k = x.name in STAT_LINE_NAME ? STAT_LINE_NAME[x.name] : x.name; if (k) statLine[k] = derived[x.name].text; });
    const skillsOut = [];
    skillList().forEach((k) => {
      const mine = finalSpecs.filter((s) => s.skill === k.name);
      if (!finalRanks[k.name] && !mine.length) return;
      if (!mine.length) skillsOut.push({ Skill: k.name, Rank: finalRanks[k.name] });
      mine.forEach((s) => skillsOut.push({ Skill: k.name, Rank: finalRanks[k.name] || 0, Specialization: s.name, 'Specialization Rank': s.rank }));
    });
    const character = {
      Name: dr.name || '', Age: dr.age || undefined, Archetype: dr.archetype || undefined, Path: dr.path || undefined,
      Motivation: dr.motivation || undefined, 'Other Identifiers': dr.identifiers || undefined, Nation: dr.nation || undefined,
      Background: dr.background || undefined, 'Short Term Goals': (dr.short || []).filter(Boolean), 'Long Term Goal': dr.long || undefined,
      'Legendary Ranks': 0, 'Wealth Rank': wealth, 'Stat Line': statLine,
      Initiative: derived['Initiative Score'] ? derived['Initiative Score'].text : undefined,
      Skills: skillsOut, Abilities: dr.ability ? [dr.ability] : [],
      'Gifts and Burdens': (dr.gb || []).map((g) => ({ Kind: g.kind, Name: g.name || undefined, Level: g.level, 'Taken As': g.takenAs, Effect: g.effect || undefined })),
      Equipment: eq.map((e) => ({ Name: e.name, Effects: effects(e) })),
    };
    Object.keys(character).forEach((k) => character[k] === undefined && delete character[k]);
    // points left over: "Unspent Character points are lost after Character creation." (Character Points)
    [['stats', statPool - statSpent, 'Stat'], ['skills', skillPool - skillSpent, 'Skill']].forEach(([st, left, k]) => {
      if (left > 0) notes.push({ step: st, text: left + ' ' + k + ' point' + (left === 1 ? '' : 's') + ' unspent — “Unspent Character points are lost after Character creation.”' });
    });
    // what is still to choose
    const todo = [];
    if (!dr.motivation) todo.push({ step: 'motivation', text: 'a Motivation' });
    if (!dr.archetype) todo.push({ step: 'archetype', text: 'an Archetype' });
    if (!dr.path) todo.push({ step: 'path', text: 'a Path' });
    if (!dr.ability) todo.push({ step: 'ability', text: 'an Ability' });
    if (!dr.name) todo.push({ step: 'name', text: 'a name' });
    return {
      points: { gb: { start: R.points.gb, gifts, burdens, left: gbLeft, toStats, toSkills }, stats: { pool: statPool, spent: statSpent, left: statPool - statSpent }, skills: { pool: skillPool, spent: skillSpent, left: skillPool - skillSpent } },
      final, derived, ranks: finalRanks, specs: finalSpecs, wealth, errors, notes, todo, character, ok: !errors.length && !todo.length,
    };
  }
  const effects = (e) => [].concat(D().val(e, 'Effects') || []).length ? (window.CnCSheet.plain(D().prop(e, 'Effects')) || []) : [];

  return { rules, motivations, archetype, path, statNames, skillList, abilitiesFor, giftKinds, equipment, nations, blank, compute, STAT_LINE_NAME, flush: () => (cache = null) };
})();
