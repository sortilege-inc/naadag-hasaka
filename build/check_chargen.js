#!/usr/bin/env node
// build/check_chargen.js — the creator's rules (system/coyotecrow/chargen.js), read from data/ by the
// very code the pages run, and checked against the book's own numbers and examples:
//   * every rule the creator enforces is found in the corpus (a pattern that stops matching fails
//     here, not silently at the table);
//   * the six Archetypes each read one Stat and free-Skill options that name real Skills;
//   * the book's worked examples hold: Aya's Strength (3 points → 2, +1 Warrior, +1 Path → 4), and
//     Dezba's Skills (Melee Weapons 1 + War Clubs 2 = 2 points; + Knives 3 = 3 more).
//     node build/check_chargen.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = { console, location: { hostname: 'localhost' } };
ctx.window = ctx;
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
['engine/config.js', 'engine/render.js', 'engine/data.js'].forEach(load);
fs.readdirSync(path.join(ROOT, 'data')).filter((f) => f.endsWith('.js')).forEach((f) => load('data/' + f));
['system/coyotecrow/data.js', 'system/coyotecrow/dice.js', 'system/coyotecrow/entity.js', 'system/coyotecrow/sheet.js', 'system/coyotecrow/chargen.js'].forEach(load);
ctx.CnCData.reindex();
const C = ctx.CnCChargen;
const R = C.rules();
const fails = [];
let n = 0;
const check = (label, got, want) => { n++; if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(label + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); };
check('every rule found in the corpus', R.missing, []);
check('Character Points', R.points, { gb: 5, stats: 42, skills: 42 });
check('Stat cost', R.statCost, { 1: 0, 2: 3, 3: 6, 4: 10, 5: 15 });
check('Stat cap before the Path', R.statCap, 5);
check('Notoriety', R.notoriety, { at: 6, level: 1 });
check('Skill cost, General', R.skillCost.general, { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15, 6: 21 });
check('Skill cost, Specialized', R.skillCost.special, { 1: null, 2: 1, 3: 3, 4: 6, 5: 10, 6: 15 });
check('advised starting Rank', R.skillAdvised, 6);
check('Goals', R.goals, { short: 2, long: 1 });
check('Wealth Rank default, Financial Burden', [R.wealth, R.financialBurden], [4, 1]);
check('starting gear baseline', R.gear, { equal: 3, above: 1, aboveBy: 1 });
check('Archetypes read', R.archetypes.map((a) => a.name + ':' + a.stat + '+' + a.bonus + ':' + a.options.map((o) => (o.spec ? 'spec ' : '') + o.skill).join('|')).sort(),
  ['Healer:Spirit+1:Medicine|Ceremony', 'Scout:Agility+1:Stealth|Ranged Weapons', 'Seeker:Perception+1:Investigation|Tracking', 'Tinkerer:Intelligence+1:spec Knowledge|Crafting', 'Warrior:Strength+1:Unarmed Combat|Melee Weapons', 'Whisperer:Charisma+1:Charm|Performance']);
check('Paths', R.paths.length, 15);
check('Derived Stats with Components', R.derived.map((x) => x.name + '=' + x.parts.join('+')).sort(), ['Body=Strength+Agility+Endurance', 'Initiative Score=Agility+Perception+Charisma', 'Mental Defense=Perception+Wisdom', 'Mind=Intelligence+Perception+Wisdom', 'Mystical Defense=Charisma+Will', 'Physical Defense=Agility+Endurance', 'Soul=Spirit+Charisma+Will']);
// Aya: "spend 3 points on her Strength, giving her a 2 … adds an additional 1 because she chose
// Warrior, and another 1 because she chose Path of the Buffalo, giving Aya a final Strength of 4"
// (the corpus's Paths name the Bison; the Path with Strength is what the example turns on)
const aya = C.blank();
aya.archetype = 'Warrior';
aya.path = 'Path of the Bison';
aya.stats.Strength = 2;
const ca = C.compute(aya);
check('Aya: Strength 2 costs 3', ca.points.stats.spent, 3);
check('Aya: final Strength 4', ca.final.Strength, 4);
// Dezba: Melee Weapons 1 (1 point) + War Clubs 2 (1 point); + Knives 3 (3 points)
const dz = C.blank();
dz.skills['Melee Weapons'] = 1;
dz.specs = [{ skill: 'Melee Weapons', name: 'War Clubs', rank: 2 }];
check('Dezba: 2 points', C.compute(dz).points.skills.spent, 2);
dz.specs.push({ skill: 'Melee Weapons', name: 'Knives', rank: 3 });
check('Dezba: + Knives 3 = 5 points', C.compute(dz).points.skills.spent, 5);
// the rules refuse what the book forbids
const bad = C.blank();
bad.archetype = 'Warrior';
bad.stats.Strength = 5;
check('Warrior Strength 5 bought → 6 before the Path is refused', C.compute(bad).errors.some((e) => /may not go above 5/.test(e.text)), true);
bad.stats.Strength = 1;
bad.gb = [{ kind: 'Quirks', takenAs: 'Gift', level: 3 }, { kind: 'Family', takenAs: 'Gift', level: 3 }];
check('Gifts past 5 points are refused', C.compute(bad).errors.some((e) => /negative points/.test(e.text)), true);
bad.gb = [{ kind: 'Secrets', takenAs: 'Burden', level: 2 }];
const cb = C.compute(bad);
check('a Burden grants its Levels', cb.points.gb.left, 7);
const sp = C.blank();
sp.skills.Piloting = 2;
sp.specs = [{ skill: 'Piloting', name: 'Sun Wing', rank: 2 }];
check('a Specialized Rank not above its General Rank is refused', C.compute(sp).errors.some((e) => /must always be higher/.test(e.text)), true);
check('unspent points are noted with the book’s sentence', C.compute(C.blank()).notes.filter((x) => /are lost after Character creation/.test(x.text)).length, 2);
console.log('check_chargen: ' + (fails.length ? fails.length + ' FAILED' : 'OK') + ' (' + n + ' assertions)');
fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
