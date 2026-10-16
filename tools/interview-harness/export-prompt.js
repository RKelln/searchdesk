'use strict';
// Prints the coach instructions exactly as Search Desk's "Copy only the instructions" button copies them.
//   node tools/interview-harness/export-prompt.js [--workshop] [--options key=value ...] [--check] > prompt.txt
// Options: kind=general|behavioural  questions=2..5  research=on|off  language=<name>.
// Without --workshop this is what a normal copy of the app copies (5 questions, no workshop sentence). With
// --workshop it is what a workshop copy copies; its defaults are interviewer prompt v4 byte for byte, the version
// the harness tested (harness.py and cases/prepare.py use this mode unless you pass --normal). It loads features/recipe-coach.js the same way checks/run.js does
// and calls the feature's own logic, so the harness tests the release text and never a hand-copied one.
// Also accepts "--options kind=behavioural research=off" or "--options=kind=behavioural,research=off".
// --check: print nothing but a one-line summary on stderr (length and cap) and still exit 1 if over the cap.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const CORE = ['core/strings.js', 'core/h.js', 'core/contract.js', 'core/merge.js', 'core/prompt.js'];

function loadFeature(id) {
  const w = { console };
  w.window = w;
  const context = vm.createContext(w);
  const features = {};
  w.Desk = { register: (def) => { features[def.id] = def; return def; } };
  [].concat(CORE, ['features/' + id + '.js']).forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
  });
  if (!features[id]) throw new Error('features/' + id + '.js did not register "' + id + '".');
  return features[id];
}

function parseArgs(argv) {
  const opts = {};
  let check = false, inOptions = false, workshop = false;
  argv.forEach((a) => {
    if (a === '--check') { check = true; inOptions = false; return; }
    if (a === '--workshop') { workshop = true; inOptions = false; return; }
    if (a === '--options') { inOptions = true; return; }
    if (a.indexOf('--options=') === 0) { a = a.slice(10); inOptions = false; }
    else if (!inOptions) throw new Error('Unknown argument: ' + a);
    a.split(',').forEach((pair) => {
      const i = pair.indexOf('=');
      if (i < 1) throw new Error('Options look like key=value, not "' + pair + '".');
      opts[pair.slice(0, i)] = pair.slice(i + 1);
    });
  });
  return { opts, check, workshop };
}

try {
  const { opts, check, workshop } = parseArgs(process.argv.slice(2));
  const L = loadFeature('recipe-coach').logic;
  const known = ['kind', 'questions', 'research', 'language'];
  Object.keys(opts).forEach((k) => { if (known.indexOf(k) < 0) throw new Error('Unknown option "' + k + '". Known: ' + known.join(', ') + '.'); });
  const norm = L.options(opts, workshop);
  Object.keys(opts).forEach((k) => {
    if (String(norm[k]) !== String(opts[k])) throw new Error('"' + opts[k] + '" is not a choice for ' + k + '.');
  });
  const text = L.instructions(opts, workshop);
  process.stderr.write('recipe-coach instructions (' + (workshop ? 'workshop' : 'normal') + '): ' + text.length + ' characters (cap ' + L.CAP + ')\n');
  if (text.length > L.CAP) throw new Error('Over the cap.');
  if (!check) process.stdout.write(text);
} catch (e) {
  process.stderr.write('Error: ' + e.message + '\n');
  process.exit(1);
}
