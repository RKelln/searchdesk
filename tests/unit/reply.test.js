'use strict';
// Fixture corpus for core/reply.js (PLAN T3.2). Each fixture is tests/unit/replies/<group>/<name>.txt (the pasted
// answer), <name>.json (the context) and <name>.expected.json (the expected result). Run with UPDATE_FIXTURES=1 to
// (re)write the expected files, then read the diff before committing. The real trial replies in
// tests/unit/replies/trial/ get their context built here from slice.json; their expected files sit next to them.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { load } = require('./_load');

const Desk = load(['core/reply.js']);
const base = path.join(__dirname, 'replies');
const update = !!process.env.UPDATE_FIXTURES;
const plain = (x) => JSON.parse(JSON.stringify(x));
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

function check(txtFile, context) {
  const expFile = txtFile.replace(/\.txt$/, '.expected.json');
  const got = plain(Desk.reply.parse(fs.readFileSync(txtFile, 'utf8'), context));
  if (update) fs.writeFileSync(expFile, JSON.stringify(got, null, 1) + '\n');
  assert.ok(fs.existsSync(expFile), 'missing ' + path.basename(expFile));
  assert.deepStrictEqual(got, readJson(expFile));
  return got;
}

// ---- hand-written fixtures -------------------------------------------------------------------------------------------
for (const group of fs.readdirSync(base).sort()) {
  const dir = path.join(base, group);
  if (group === 'trial' || !fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.txt')).sort()) {
    test('reply fixture ' + group + '/' + f.replace(/\.txt$/, ''), () => {
      const txt = path.join(dir, f);
      check(txt, readJson(txt.replace(/\.txt$/, '.json')));
    });
  }
}

// ---- the trial replies from free Claude (older JSON-lines format) ------------------------------------------------------------
function trialContext(round) {
  const slice = readJson(path.join(base, 'trial', round, 'slice.json'));
  const aliases = {}, titles = {};
  slice.events.forEach((e, i) => {
    const letter = e.tier === 'A' ? 'L' : 'C';
    aliases[letter + (i + 1)] = e.id;
    titles[e.id] = e.name;
  });
  return {
    recipe: 'events', prompts: [{ code: 'TRL1', recipe: 'events', aliases }], titles,
    answer: { L: ['why'], C: ['why'], NEW: ['title', 'url', 'why'] },
  };
}

let intended = 0, accepted = 0;
const notAccepted = [];
for (const round of ['round1', 'round2']) {
  const dir = path.join(base, 'trial', round), context = trialContext(round);
  for (const f of fs.readdirSync(dir).filter((n) => /^\d.*\.txt$/.test(n)).sort()) {
    test('reply trial ' + round + '/' + f, () => {
      const txt = path.join(dir, f);
      const got = check(txt, context);
      // intended lines: every pick or new line in the reply, counted on the text with quotes straightened
      const want = fs.readFileSync(txt, 'utf8').replace(/[“”]/g, '"').replace(/\s*\n\s*(?=[a-z.]*[a-z]\/)/g, '')
        .split('\n').filter((l) => /"t"\s*:\s*"(pick|new)"/.test(l)).length;
      const wantAll = (fs.readFileSync(txt, 'utf8').replace(/[“”]/g, '"').match(/"t"\s*:\s*"(pick|new)"/g) || []).length;
      intended += wantAll; accepted += got.accepted.length;
      got.rejected.forEach((r) => notAccepted.push(f + ': ' + r.line + ' -> ' + r.reason));
      assert.strictEqual(got.accepted.length, wantAll, 'every intended line is accepted (' + want + ' whole lines)');
      assert.strictEqual(got.rejected.length, 0);
      assert.strictEqual(got.codeStatus, 'missing');
    });
  }
}
test('reply trial share', () => {
  const line = 'Trial lines accepted: ' + accepted + ' of ' + intended + ' (' + Math.round(100 * accepted / Math.max(1, intended)) + '%)';
  console.log(line);
  notAccepted.forEach((n) => console.log('  not accepted: ' + n));
  assert.strictEqual(accepted, intended);
});

// ---- purity ---------------------------------------------------------------------------------------------------------------------
test('reply.js touches no clock, randomness or page', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'core', 'reply.js'), 'utf8').replace(/\/\/.*$/gm, '');
  for (const word of ['Date.now', 'new Date()', 'Math.random', 'document', 'innerHTML', 'localStorage', 'fetch', 'eval']) {
    assert.ok(src.indexOf(word) < 0, word);
  }
});

test('reply: parse does not change its context', () => {
  const ctx = readJson(path.join(base, 'layout', 'clean-block.json'));
  const before = JSON.stringify(ctx);
  Desk.reply.parse('DESK-7Q3K\nL1 | x', ctx);
  assert.strictEqual(JSON.stringify(ctx), before);
});
