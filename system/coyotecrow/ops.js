// system/coyotecrow/ops.js — the ops Coyote & Crow adds to the engine's, registered with the
// same call and shared the same way (engine/ops.js). Loaded by the browser after engine/ops.js,
// and imported by the Worker beside it, so the room applies the very same functions. Ids travel
// in the args; applying an op is deterministic everywhere, and the room never rolls.
//
//   cast          { [sceneId]: [instance] }   who the Story Guide has put in a scene. An instance
//                                             is { iid, id, label } — one tracked copy of an Icon;
//                                             a bare string is one copy whose iid is its id (the
//                                             shape from sortilege-vtt-daggerheart's workbench)
//   npcConditions { [iid]: [names] }          a copy's Effects and States (Bleeding, Stun,
//                                             Unconsciousness…), shared so the players see them
//   npcState      { [iid]: {body, mind, soul} } the damage a copy has taken to each — the Story
//                                             Guide's own
//   party[].versions                          archived copies of a character (archivePartyVersion)
//   gm, gmNotes, arc, threads                 the Story Guide's own pack state (PLAYBOOK §4b.2):
//                                             never shared, never sent to the room (local ops)
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../../engine/ops.js'));
  else factory(root.VttOps);
})(typeof self !== 'undefined' ? self : this, function (Ops) {
  Ops.shared(['cast', 'npcConditions']);

  Ops.register('setSceneCast', (s, sceneId, list) => {
    if (!s.cast) s.cast = {};
    s.cast[sceneId] = (list || []).slice();
  });
  Ops.register('setNpcConditions', (s, iid, list) => {
    if (!s.npcConditions) s.npcConditions = {};
    s.npcConditions[iid] = (list || []).slice();
  });

  // A character's archived versions: a copy, appended, never edited. A player may archive their own.
  Ops.register('archivePartyVersion', (s, id, version) => {
    const m = (s.party || []).find((x) => x.id === id);
    if (!m || !version || !version.id) return;
    if (!m.versions) m.versions = [];
    if (!m.versions.some((x) => x.id === version.id)) m.versions.push(version);
  }, (s, me, a) => a[0] === me);

  // The Story Guide's own: a copy's damage, and the pack state. No player may send them, none is in
  // a player's view, and the pack state is never forwarded to the room.
  const gmOnly = () => null;
  const LOCAL = { local: true };
  const copy = (x) => JSON.parse(JSON.stringify(x == null ? null : x));
  Ops.register('setNpcState', (s, iid, st) => {
    if (!s.npcState) s.npcState = {};
    s.npcState[iid] = Object.assign({}, st || {});
  }, null, gmOnly);
  Ops.register('setGm', (s, where, value) => { if (!s.gm) s.gm = {}; s.gm[String(where)] = copy(value); }, null, gmOnly, LOCAL);
  Ops.register('setGmNotes', (s, text) => { s.gmNotes = String(text || ''); }, null, gmOnly, LOCAL);
  Ops.register('setArc', (s, list) => { s.arc = copy(list || []); }, null, gmOnly, LOCAL);
  Ops.register('setThreads', (s, list) => { s.threads = copy(list || []); }, null, gmOnly, LOCAL);

  return Ops;
});
