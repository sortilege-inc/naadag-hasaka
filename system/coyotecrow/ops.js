// system/coyotecrow/ops.js — the ops Coyote & Crow adds to the engine's, registered with the
// same call and shared the same way (engine/ops.js). Loaded by the browser after
// engine/ops.js, and imported by the Worker beside it, so the room applies the very same
// functions. Ids travel in the args; applying an op is deterministic everywhere.
//
//   cast   { [sceneId]: [entityIds] }   who the Story Guide has put in a scene of the adventure,
//                                       beyond the characters its .arc names there — drawn from
//                                       any Icon of the book (the Cast panel, M3)
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../../engine/ops.js'));
  else factory(root.VttOps);
})(typeof self !== 'undefined' ? self : this, function (Ops) {
  Ops.shared(['cast']);

  Ops.register('setSceneCast', (s, sceneId, ids) => {
    if (!s.cast) s.cast = {};
    s.cast[sceneId] = (ids || []).slice();
  });

  return Ops;
});
