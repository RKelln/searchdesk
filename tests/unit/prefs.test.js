'use strict';
// core/prefs.js: the two pure functions, which decide what a saved value means. Checked with no page, the same
// way core/merge.js and core/reply.js are.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

const { allowed, read, types } = load('core/prefs.js').prefs;

const choice = (opts, def) => ({ key: 'size', type: 'choice', options: opts, def: def });
const OPTIONS = [{ value: 'normal', label: 'Normal' }, { value: 'big', label: 'Bigger' }];
const toggle = { key: 'contrast', type: 'toggle', def: false };

test('types: only choice and toggle', () => {
  // Round-tripped: objects from the vm realm are not deepStrictEqual to literals here (PLAN, "Found while working").
  assert.deepStrictEqual(JSON.parse(JSON.stringify(types())).sort(), ['choice', 'toggle']);
});

test('allowed: a choice takes one of its own options', () => {
  const d = choice(OPTIONS, 'normal');
  assert.equal(allowed(d, 'normal'), true);
  assert.equal(allowed(d, 'big'), true);
  assert.equal(allowed(d, 'bigger'), false, 'an option the feature no longer offers');
  assert.equal(allowed(d, 'Normal'), false, 'case matters: the value, not the label');
  assert.equal(allowed(d, 21), false);
  assert.equal(allowed(d, ''), false);
});

test('allowed: a choice with numeric options keeps the type it was given', () => {
  const d = choice([{ value: 14, label: '2 weeks' }, { value: 21, label: '3 weeks' }], 21);
  assert.equal(allowed(d, 21), true);
  assert.equal(allowed(d, '21'), false, 'a string is not the number it looks like');
});

test('allowed: a toggle takes true or false and nothing else', () => {
  assert.equal(allowed(toggle, true), true);
  assert.equal(allowed(toggle, false), true);
  assert.equal(allowed(toggle, 'true'), false);
  assert.equal(allowed(toggle, 1), false);
  assert.equal(allowed(toggle, null), false);
});

test('allowed: rubbish is not allowed rather than a crash', () => {
  assert.equal(allowed(null, 'x'), false);
  assert.equal(allowed(undefined, 'x'), false);
  assert.equal(allowed({ key: 'x', type: 'colour' }, '#fff'), false);
  assert.equal(allowed({ key: 'x', type: 'choice' }, 'a'), false, 'no options at all');
});

test('read: the saved value when it is still on offer', () => {
  const d = choice(OPTIONS, 'normal');
  assert.equal(read(d, { size: 'big' }), 'big');
  assert.equal(read(toggle, { contrast: true }), true);
});

test('read: the default when the saved value has gone stale', () => {
  const d = choice(OPTIONS, 'normal');
  assert.equal(read(d, { size: 'gigantic' }), 'normal', 'an old file');
  assert.equal(read(d, {}), 'normal', 'never saved');
  assert.equal(read(d, null), 'normal');
  assert.equal(read(d, undefined), 'normal');
  assert.equal(read(toggle, { contrast: 'yes' }), false, 'a hand-edited file');
  assert.equal(read(toggle, { contrast: 1 }), false);
});

test('read: the default when the saved value is the wrong shape entirely', () => {
  const d = choice(OPTIONS, 'normal');
  assert.equal(read(d, 'not even an object'), 'normal');
  assert.equal(read(d, 7), 'normal');
  assert.equal(read(d, { size: { toString() { return 'big'; } } }), 'normal', 'no sneaky object');
});

test('read: a numeric default is handed back as the number', () => {
  const d = choice([{ value: 14 }, { value: 21 }], 21);
  assert.strictEqual(read(d, { size: 14 }), 14);
  assert.strictEqual(read(d, { size: 'nope' }), 21);
});