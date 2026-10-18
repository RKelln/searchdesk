'use strict';
// The coach instructions (T3.6): the default text is interviewer prompt v4 byte for byte, and the harness export
// prints the same text. The browser-free parts of recipe-coach are also in checks/recipe-coach.check.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { root, gone } = require('./_load');
const { execFileSync } = require('child_process');

const golden = fs.readFileSync(path.join(__dirname, 'golden', 'coach-v4.txt'), 'utf8');
// The harness lives in tools/ and a copy without it has nothing to run. The prompt text itself is checked above
// and in checks/recipe-coach.check.js, so the gap is this test's own job, not the app's.
const noHarness = gone('tools/interview-harness/export-prompt.js');

function feature() {
  const w = { console };
  w.window = w;
  const ctx = vm.createContext(w);
  let def = null;
  w.Desk = { register: (d) => { def = d; return d; } };
  vm.runInContext(fs.readFileSync(path.join(root, 'features/recipe-coach.js'), 'utf8'), ctx, { filename: 'recipe-coach.js' });
  return def;
}

test('the golden file is prompt v4: 1,481 characters, ASCII, ends with a newline', () => {
  assert.strictEqual(golden.length, 1481);
  assert.strictEqual(Buffer.byteLength(golden, 'utf8'), 1481);
  assert.ok(golden.endsWith('Invent no facts.\n'));
});

test('workshop default options give the v4 instructions exactly', () => {
  const L = feature().logic;
  assert.strictEqual(L.instructions(undefined, true), golden);
  assert.strictEqual(L.instructions({}, true), golden);
  assert.strictEqual(L.instructions({ kind: 'general', questions: '3', research: 'on', language: '' }, true), golden);
});

test('a normal copy: 5 questions and no workshop sentence, otherwise v4', () => {
  const L = feature().logic;
  const want = golden.replace('Ask 3 main', 'Ask 5 main').replace('After 3 questions', 'After 5 questions')
    .replace(' Workshops: fictional person only, never my own details.', '');
  assert.strictEqual(L.instructions({}, false), want);
  assert.strictEqual(L.instructions({ questions: '3' }, false), golden.replace(' Workshops: fictional person only, never my own details.', ''));
});

test('every combination of options is at most 1,500 characters', () => {
  const L = feature().logic;
  const all = L.allOptions();
  assert.strictEqual(all.length, 2 * 4 * 2 * 12);
  for (const workshop of [true, false]) {
    const sizes = all.map((o) => L.instructions(o, workshop).length);
    assert.ok(Math.max(...sizes) <= 1500, 'longest ' + Math.max(...sizes));
  }
});

test('only the options change the text, and only where they should', () => {
  const L = feature().logic;
  const diff = (a, b) => { // the words that differ, in order
    const x = a.split(/\s+/), y = b.split(/\s+/); let i = 0;
    while (i < x.length && x[i] === y[i]) i++;
    return [x.slice(i).join(' '), y.slice(i).join(' ')];
  };
  assert.strictEqual(L.instructions({ questions: '4' }, true), golden.replace('Ask 3 main', 'Ask 4 main').replace('After 3 questions', 'After 4 questions'));
  assert.strictEqual(L.instructions({ research: 'off' }, true), golden.replace(L.RESEARCH + '\n\n', ''));
  assert.strictEqual(L.instructions({ kind: 'behavioural' }, true), golden.replace(L.KINDS.general, L.KINDS.behavioural));
  assert.strictEqual(L.instructions({ language: 'Urdu' }, true), golden.replace('never my own details.', 'never my own details. Reply in Urdu.'));
  assert.ok(diff(golden, L.instructions({ research: 'off' }, true))[0].startsWith('If search'));
});

test('the harness export prints the same text, and refuses a bad option', { skip: noHarness }, () => {
  const script = path.join(root, 'tools/interview-harness/export-prompt.js');
  const out = execFileSync('node', [script, '--workshop'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.strictEqual(out, golden);
  const off = execFileSync('node', [script, '--options', 'research=off', 'questions=4'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.strictEqual(off, feature().logic.instructions({ research: 'off', questions: '4' }, false));
  const normal = execFileSync('node', [script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.strictEqual(normal, feature().logic.instructions({}, false));
  assert.throws(() => execFileSync('node', [script, '--options', 'questions=9'], { stdio: 'ignore' }));
});
