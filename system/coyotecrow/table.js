// system/coyotecrow/table.js — what Coyote & Crow tells the table (engine/vtt.js) and the player's
// page (engine/play.js): which scenes are in play, what can stand on the table, what a token's
// state reads as, and how a character file becomes a party member. The engine never asks the
// corpus directly.
//
// Two sources of scenes, one list. The published adventure — the corpus's .arc, *Encounter at
// Station 54*, picked in the Adventure panel (campaign.modules[0]) — gives its Parts; the Story
// Guide's own arc (the Scenes pane, op `setArc`, ported from sortilege-vtt-daggerheart's workbench)
// gives the saga's own scenes after them. One scene is running (the engine's `current`, keyed by
// the module in play, or `saga` with none), and the table, the Cast and the player's page follow it.
//
// A scene's cast is a list of instances (op setSceneCast): { iid, id, label } is one tracked copy of
// an Icon, so three Raiders are three trackers; a bare string is one copy whose iid is its id.
window.VttSystem = (function () {
  const D = window.CnCData;
  const State = window.VttState;
  const Bus = window.VttBus;
  const S = () => State.state;
  const Sheet = () => window.CnCSheet;
  const SAGA = 'saga';

  const moduleId = () => ((S().campaign || {}).modules || [])[0] || SAGA;
  let asked = {};
  function module() {
    const mid = moduleId();
    if (mid === SAGA) return null;
    const m = D.module(mid);
    if (m) return m;
    const ref = D.moduleList().find((x) => x.id === mid);
    if (ref && !asked[ref.book]) {
      asked[ref.book] = true;
      D.ensure(ref.book).then(() => Bus.emit('state:remote', { loaded: true }, { local: true }));
    }
    return null;
  }

  // the adventure's scenes, then the saga's own; `own` marks the Story Guide's
  function scenes() {
    const m = module();
    const out = m ? m.scenes.map((s) => ({ id: s.id, name: s.name, phase: s.part ? s.part.name : null, moduleId: m.id })) : [];
    (S().arc || []).forEach((x) => out.push({ id: x.id, name: x.title || 'A scene', phase: x.session || 'The saga', moduleId: moduleId(), own: true }));
    return out;
  }
  function scene(id) {
    const m = module();
    const s = m && m.scenes.find((x) => x.id === id);
    if (s) return s;
    const a = (S().arc || []).find((x) => x.id === id);
    return a ? { id: a.id, name: a.title || 'A scene', own: true, arc: a } : null;
  }
  function currentSceneId() {
    const cur = (S().current || {})[moduleId()];
    const all = scenes();
    if (!all.length) return cur || null;                       // a player's page: no arc, only the id
    return (all.find((s) => s.id === cur) || all[0] || {}).id || null;
  }

  // ── the cast, as instances ─────────────────────────────────────────
  const castRaw = (sceneId) => ((S().cast || {})[sceneId] || []).slice();
  const castEntries = (sceneId) => castRaw(sceneId).map((c) => (typeof c === 'string' ? { iid: c, id: c } : { iid: c.iid || c.id, id: c.id, label: c.label }));
  const castIds = (sceneId) => castEntries(sceneId).map((c) => c.id);
  const byId = (id) => D.entity(id) || D.records().find((r) => r.id === id) || null;
  const cast = (sceneId) => { const seen = {}; return castIds(sceneId).filter((id) => (seen[id] ? false : (seen[id] = 1))).map(byId).filter(Boolean); };
  const instLabel = (c) => c.label || ((byId(c.id) || {}).name || c.id);
  // a copy of an Icon put in a scene: one more instance, numbered when there are several
  function addToScene(sceneId, id, count) {
    const cur = castRaw(sceneId);
    const name = (byId(id) || {}).name || id;
    const n = count || 1;
    for (let k = 1; k <= n; k++) cur.push({ iid: State.genId('inst'), id, label: n > 1 ? name + ' ' + k : name });
    State.commit('setSceneCast', [sceneId, cur]);
  }
  const removeFromScene = (sceneId, iid) => State.commit('setSceneCast', [sceneId, castRaw(sceneId).filter((c) => (typeof c === 'string' ? c : c.iid) !== iid)]);

  // the adventure's own characters: the Icons its .arc prints (the Raiders, the Drones, Wayata…),
  // and, for one of its scenes, those printed in that scene
  function namedCast(sceneId) {
    const m = module();
    if (!m) return [];
    const inArc = D.all([m.book]).filter((e) => e.file === m.file && e.type === 'Icon');
    if (!sceneId) return inArc;
    const s = m.scenes.find((x) => x.id === sceneId);
    if (!s || !s.block) return [];
    const ids = new Set();
    const walk = (list) => (list || []).forEach((b) => { if (!b) return; if (b.ent) { ids.add(b.ent); const e = D.entity(b.ent); if (e) walk(e.blocks); } if (b.body) walk(b.body); });
    walk(s.block.body);
    return inArc.filter((e) => ids.has(e.id));
  }

  const maps = () => [];
  const mapDef = () => null;
  const defaultMapId = (sceneId) => sceneId;
  const legend = () => null;
  const mapAssets = () => [];

  // ── tokens: the party, and the running scene's cast ────────────────
  function tokenSources() {
    const groups = [];
    const party = (S().party || []).map((m) => ({ id: 'tk-' + m.id, label: m.name, kind: 'party', owner: m.id, ref: m.id }));
    if (party.length) groups.push({ label: 'The party', items: party });
    const sid = currentSceneId();
    const sc = scene(sid);
    const here = sc ? castEntries(sid).map((c) => ({ id: 'tk-' + c.iid, label: instLabel(c), kind: 'cast', ref: c.id, iid: c.iid })) : [];
    if (here.length) groups.push({ label: sc.name, items: here });
    const printed = sc ? namedCast(sid).filter((e) => !here.some((h) => h.ref === e.id)).map((e) => ({ id: 'tk-' + e.id, label: e.name, kind: 'cast', ref: e.id, iid: e.id })) : [];
    if (printed.length) groups.push({ label: 'Printed in this scene', items: printed });
    return groups;
  }
  const COLORS = { party: '#1f8f84', cast: '#b8552e', marker: '#5b3f86' };
  const tokenColor = (t) => COLORS[t.kind] || COLORS.marker;
  // a token's word: a character's Body, Mind and Soul; a copy's, and its Effects and States
  function tokenStatus(t) {
    if (t.kind === 'party') {
      const m = (S().party || []).find((x) => x.id === t.owner);
      return m && Sheet() ? { text: Sheet().tokenText(m), pips: [] } : null;
    }
    const e = t.kind === 'cast' && t.ref ? byId(t.ref) : null;
    if (!e || !e.props) return null;
    const key = t.iid || e.id;
    const cond = (S().npcConditions || {})[key] || [];
    return { text: [Sheet() ? Sheet().pools(e, (S().npcState || {})[key]).map((p) => p.label + ' ' + p.text).join(' · ') : null, cond.join(', ') || null].filter(Boolean).join(' · '), pips: [] };
  }
  function selectToken(t) {
    if (t.kind === 'party') Bus.emit('select', { kind: 'party', id: t.owner });
    else if (t.kind === 'cast' && t.ref) Bus.emit('select', { kind: 'entity', id: t.ref, iid: t.iid, label: t.label });
  }
  const tokenMenu = () => null;

  // ── the character (system/coyotecrow/sheet.js) ─────────────────────
  const readCharacter = (obj, fileName) => Sheet().readMember(obj, fileName);
  const downloadCharacter = (m) => Sheet().downloadMember(m);
  const liveSheet = (m, opts) => Sheet().live(m, opts);
  const memberSubtitle = (m) => Sheet().sentence(m.character || {});
  // the player makes a Character here, with the site's creator, and it takes its seat (engine/play.js)
  const makeCharacter = (container, seat) => window.CnCCreator.render(container, null, null, { embedded: true, onDone: seat, doneLabel: 'Take my Character to the table' });

  return {
    SAGA, moduleId, module, scenes, scene, currentSceneId,
    cast, castIds, castEntries, castRaw, instLabel, addToScene, removeFromScene, namedCast, byId,
    maps, mapDef, defaultMapId, legend, mapAssets,
    tokenSources, tokenColor, tokenStatus, selectToken, tokenMenu,
    liveSheet, readCharacter, downloadCharacter, memberSubtitle, makeCharacter,
  };
})();
