// system/coyotecrow/dice.js — the D12 System: a Dice Pool of d12s against a Success Number,
// walked through the book's own Steps to Making a Dice Check (Rules of the Game › The D12
// System › Dice Checks). The corpus declares no FACES or outcome ladder for these dice; every
// number below is a named constant quoting the sentence that states it (PLAN.md ground rules).
// The rules text itself is shown beside the roller from the corpus, verbatim.
//
//   CnCDice.check(pool, sn)      → a Check at its first step: the Standard dice rolled
//   CnCDice.adjust(chk, i, d)    Legendary Rank / Focus: move a Standard die by ±1
//   CnCDice.criticals(chk)       roll the Critical dice for every 12, and again for their 12s
//   CnCDice.tally(chk)           Successes, Fails, and the outcome
//   CnCDice.roller(opts)         the widget: pool, Success Number, Legendary Rank, Mind for Focus
window.CnCDice = (function () {
  const { el } = window.VttRender;
  const D = window.CnCData;

  // ── the numbers, each with its sentence ─────────────────────────────
  const RULES = {
    SIDES: { v: 12, text: 'you\'ll be using a single kind of die, a d12 (a die with numbers ranging from 1-12)' },
    DEFAULT_SN: { v: 8, text: 'Unless a Success Number is stated in the text, the default Success Number is 8.' },
    MIN_SN: { v: 2, text: 'It can never go below 2.' },
    FAIL: { v: 1, text: 'Each 1 you roll is considered a Fail and subtracts 1 Success.' },
    CRIT: { v: 12, text: 'For every die showing 12 in the Dice Pool, the Player should gather up an equal number of Critical (black) dice.' },
    CRIT_LOW: { v: 1, text: 'Any number rolled on Critical Dice below the Success Number, even a 1, counts as one Success.' },
    CRIT_HIGH: { v: 2, text: 'Any Critical Die that rolls equal to or higher than the Success Number is worth two Successes.' },
    CRIT_AGAIN: { text: 'If a Player rolls a 12 or multiple 12s with their Critical Dice, they repeat the Critical Dice Step' },
    LEGENDARY: { text: 'For every Legendary Rank a Character has, the Player may adjust the value of any die up or down by 1 point. They can adjust the same die more than once. They cannot change the value of a Fail.' },
    FOCUS: { text: 'For every point of Mind spent, one die may be adjusted upward or downward by one. Players may boost a die to 12 this way, but Fails may not be adjusted.' },
    NO_ADJUST_CRIT: { text: 'Note that Focus and Legendary Status cannot be used on Critical Dice.' },
    OUTCOME: { text: '1+ Successes: Success  0 Successes: Failure  < 0 Successes: Critical Failure' },
  };
  // The book names no bound for a die moved by Legendary Rank or Focus beyond "boost a die to
  // 12" and "cannot change the value of a Fail"; the roller keeps an adjusted die within
  // MIN_SN..12, so an adjustment never makes a Fail and never passes a face the die has
  // (PLAN.md decision log).
  const ADJ_MIN = RULES.MIN_SN.v;
  const ADJ_MAX = RULES.SIDES.v;

  function d12() {
    const a = new Uint32Array(1);
    // rejection sampling: an unbiased 1–12 from 32 random bits
    const lim = Math.floor(0x100000000 / 12) * 12;
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return (a[0] % 12) + 1;
  }

  function check(pool, sn) {
    const n = Math.max(0, Math.floor(pool) || 0);
    const target = Math.max(RULES.MIN_SN.v, Math.min(RULES.SIDES.v, Math.floor(sn) || RULES.DEFAULT_SN.v));
    const dice = [];
    for (let i = 0; i < n; i++) {
      const v = d12();
      dice.push({ v, rolled: v });
    }
    return { pool: n, sn: target, dice, crits: [], legendaryUsed: 0, focusUsed: 0, resolved: false };
  }

  // A Standard die may move while it is not a Fail (its rolled value is not 1).
  const adjustable = (die) => die.rolled !== RULES.FAIL.v;
  function adjust(chk, i, delta, source) {
    const die = chk.dice[i];
    if (!die || !adjustable(die) || chk.resolved) return false;
    const nv = die.v + delta;
    if (nv < ADJ_MIN || nv > ADJ_MAX) return false;
    die.v = nv;
    if (source === 'legendary') chk.legendaryUsed++;
    else chk.focusUsed++;
    return true;
  }

  // Step 6: one Critical die per 12; each Critical 12 rolls another, until none is rolled.
  function criticals(chk) {
    let n = chk.dice.filter((d) => d.v === RULES.CRIT.v).length;
    chk.crits = [];
    while (n > 0) {
      const wave = [];
      for (let i = 0; i < n; i++) wave.push(d12());
      chk.crits.push(wave);
      n = wave.filter((v) => v === RULES.CRIT.v).length;
    }
    chk.resolved = true;
    return chk;
  }

  // Step 7: +1 per Standard die at or over the Success Number, −1 per Fail, +1 or +2 per
  // Critical die by whether it meets the Success Number.
  function tally(chk) {
    let successes = 0;
    let fails = 0;
    let crit = 0;
    chk.dice.forEach((d) => {
      if (d.rolled === RULES.FAIL.v) fails++;
      else if (d.v >= chk.sn) successes++;
    });
    chk.crits.forEach((w) => w.forEach((v) => (crit += v >= chk.sn ? RULES.CRIT_HIGH.v : RULES.CRIT_LOW.v)));
    const total = successes + crit - fails;
    const outcome = total >= 1 ? 'Success' : total === 0 ? 'Failure' : 'Critical Failure';
    return { successes, crit, fails, total, outcome, critical: chk.crits.length > 0 };
  }

  function summary(chk) {
    const t = tally(chk);
    const bits = [t.total + (Math.abs(t.total) === 1 ? ' Success' : ' Successes') + ' — ' + t.outcome];
    const parts = [t.successes + ' standard'];
    if (t.crit) parts.push(t.crit + ' from Critical dice');
    if (t.fails) parts.push(t.fails + ' Fail' + (t.fails === 1 ? '' : 's'));
    bits.push(parts.join(', '));
    return bits.join(' · ');
  }

  // ── the widget ─────────────────────────────────────────────────────
  function dieFace(v, cls, title) {
    return el('span', { class: 'd12' + (cls ? ' ' + cls : ''), title: title || null }, [String(v)]);
  }

  // opts: { pool, sn, legendary, mind, label, onResolve(result) }
  function roller(opts) {
    const o = opts || {};
    const box = el('div', { class: 'roller' });
    const num = (label, value, min, max, title) => {
      const input = el('input', { type: 'number', min: String(min), max: max == null ? null : String(max), value: String(value), class: 'numin' });
      return { input, node: el('label', { class: 'field', title: title || null }, [el('span', { class: 'field-k' }, [label]), input]) };
    };
    const fPool = num('Dice Pool', o.pool != null ? o.pool : 5, 0, 30);
    const fSn = num('Success Number', o.sn != null ? o.sn : RULES.DEFAULT_SN.v, RULES.MIN_SN.v, RULES.SIDES.v, RULES.DEFAULT_SN.text + ' ' + RULES.MIN_SN.text);
    const fLeg = num('Legendary Rank', o.legendary || 0, 0, null, RULES.LEGENDARY.text);
    const fMind = num('Mind for Focus', o.mind != null ? o.mind : 0, 0, null, RULES.FOCUS.text);
    const stage = el('div', { class: 'roll-stage' });
    let chk = null;
    let step = null;   // 'legendary' | 'focus' | 'done'

    const val = (f) => Math.max(0, parseInt(f.input.value, 10) || 0);
    function start() {
      chk = check(val(fPool), parseInt(fSn.input.value, 10) || RULES.DEFAULT_SN.v);
      fSn.input.value = String(chk.sn);
      step = val(fLeg) > 0 ? 'legendary' : 'focus';
      draw();
    }
    function budget() {
      return step === 'legendary' ? val(fLeg) - chk.legendaryUsed : val(fMind) - chk.focusUsed;
    }
    function finish() {
      criticals(chk);
      step = 'done';
      draw();
      const t = tally(chk);
      if (o.onResolve) o.onResolve({ check: chk, tally: t, summary: summary(chk), label: o.label || null, legendary: chk.legendaryUsed, focus: chk.focusUsed });
    }
    function draw() {
      stage.innerHTML = '';
      if (!chk) return;
      const left = step === 'done' ? 0 : budget();
      const row = el('div', { class: 'dice-row' }, chk.dice.map((d, i) => {
        const cls = [d.rolled === RULES.FAIL.v ? 'fail' : d.v >= chk.sn ? 'hit' : 'miss', d.v === RULES.CRIT.v ? 'crit' : null, d.v !== d.rolled ? 'moved' : null].filter(Boolean).join(' ');
        const face = dieFace(d.v, cls, d.v !== d.rolled ? 'rolled ' + d.rolled : null);
        if (step === 'done' || !adjustable(d)) return el('span', { class: 'die-slot' }, [face]);
        const btn = (delta, label) => el('button', {
          class: 'adj', type: 'button', disabled: left <= 0 || d.v + delta < ADJ_MIN || d.v + delta > ADJ_MAX ? true : null,
          'aria-label': (delta > 0 ? 'Raise' : 'Lower') + ' die ' + (i + 1),
          onclick: () => { if (budget() > 0 && adjust(chk, i, delta, step)) draw(); },
        }, [label]);
        return el('span', { class: 'die-slot' }, [btn(1, '▲'), face, btn(-1, '▼')]);
      }));
      stage.appendChild(el('div', { class: 'roll-sn muted small' }, ['Success Number ' + chk.sn + ' · ' + chk.pool + ' Standard ' + (chk.pool === 1 ? 'die' : 'dice')]));
      stage.appendChild(row);
      if (step === 'legendary') {
        stage.appendChild(el('div', { class: 'roll-step' }, [
          el('b', {}, ['(Optional) Use Legendary Status']), ' — ', left + ' of ' + val(fLeg) + ' left. ',
          el('button', { class: 'btn', type: 'button', onclick: () => { step = 'focus'; draw(); } }, ['Done: on to Focus']),
        ]));
      } else if (step === 'focus') {
        stage.appendChild(el('div', { class: 'roll-step' }, [
          el('b', {}, ['(Optional) Use Focus']), ' — ', chk.focusUsed + ' Mind spent' + (val(fMind) ? ', ' + left + ' left. ' : '. '),
          el('button', { class: 'btn primary', type: 'button', onclick: finish }, [chk.dice.some((d) => d.v === RULES.CRIT.v) ? 'Roll Critical Dice and resolve' : 'Resolve']),
        ]));
      } else {
        chk.crits.forEach((w, k) => stage.appendChild(el('div', { class: 'dice-row crits' }, [
          el('span', { class: 'muted small' }, [k ? 'Critical again' : 'Critical dice']),
          w.map((v) => dieFace(v, 'critdie' + (v >= chk.sn ? ' hit' : '') + (v === RULES.CRIT.v ? ' crit' : ''))),
        ])));
        const t = tally(chk);
        stage.appendChild(el('div', { class: 'roll-result ' + t.outcome.toLowerCase().replace(/\s+/g, '-') }, [summary(chk)]));
        if (chk.focusUsed) stage.appendChild(el('div', { class: 'muted small' }, [chk.focusUsed + ' Mind spent on Focus']));
      }
    }
    box.appendChild(el('div', { class: 'roller-inputs' }, [fPool.node, fSn.node, fLeg.node, fMind.node,
      el('button', { class: 'btn primary', type: 'button', onclick: start }, ['Roll'])]));
    box.appendChild(stage);
    return box;
  }

  function logLine(entry) {
    return el('div', { class: 'log-line' }, [
      el('span', { class: 'log-who' }, [entry.who || '']), entry.label ? el('span', { class: 'muted' }, [' · ' + entry.label]) : null,
      el('span', { class: 'log-dice' }, [' ', (entry.dice || []).join(' '), entry.crits && entry.crits.length ? ' + ' + entry.crits.join(' ') : '']),
      el('div', {}, [entry.summary]),
    ]);
  }
  function logEntry(r, who) {
    return {
      who, label: r.label, summary: r.summary, sn: r.check.sn,
      dice: r.check.dice.map((d) => (d.v !== d.rolled ? d.rolled + '→' + d.v : String(d.v))),
      crits: [].concat.apply([], r.check.crits).map(String),
    };
  }

  // The rules the roller follows, from the corpus: the Dice Checks section and its children.
  function rulesEntity() {
    return D.all(['core']).find((e) => e.name === 'Dice Checks') || null;
  }

  return { RULES, check, adjust, criticals, tally, summary, roller, logLine, logEntry, rulesEntity, d12 };
})();
