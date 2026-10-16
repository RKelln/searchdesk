'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, root } = require('./_load');

const Desk = load(['core/prompt.js']);
const lines = (p) => JSON.parse(JSON.stringify(Desk.prompt.profileLines(p)));

test('profileLines: empty or missing profile gives no lines', () => {
  assert.deepStrictEqual(lines(undefined), []);
  assert.deepStrictEqual(lines(null), []);
  assert.deepStrictEqual(lines({}), []);
});

test('profileLines: format and fixed order', () => {
  const p = { replyLanguage: 'English', roles: 'Office administration', field: 'Finance', area: 'East end', languages: 'English, Tamil' };
  assert.deepStrictEqual(lines(p), [
    'What work: Office administration', 'Field: Finance', 'Area: East end', 'Languages: English, Tamil', 'Reply language: English',
  ]);
});

test('profileLines: default share leaves out background, availability and avoid', () => {
  const p = { roles: 'a', background: 'b', availability: 'c', avoid: 'd' };
  assert.deepStrictEqual(lines(p), ['What work: a']);
});

test('profileLines: a switch turned on adds the field, off removes it, missing keys use defaults', () => {
  const p = { roles: 'a', field: 'f', avoid: 'night work', share: { avoid: true, roles: false } };
  assert.deepStrictEqual(lines(p), ['Field: f', 'Avoid: night work']);
});

test('profileLines: empty and blank values are skipped; breaks become spaces', () => {
  const p = { roles: '   ', field: '', area: 7, background: 'one\n  two', share: { background: true } };
  assert.deepStrictEqual(lines(p), ['Background: one two']);
});

test('profileLines: never includes fields outside the list', () => {
  const p = { roles: 'a', name: 'Sam', email: 'x@y.z', phone: '1', share: { name: true, email: true, phone: true }, id: 'profile', type: 'profile' };
  assert.deepStrictEqual(lines(p), ['What work: a']);
});

test('profileLines: does not change its input', () => {
  const p = { roles: 'a', share: { roles: true } };
  const copy = JSON.stringify(p);
  Desk.prompt.profileLines(p);
  assert.strictEqual(JSON.stringify(p), copy);
});

test('the profile feature lists the same fields and defaults as core/prompt.js', () => {
  const win = { Desk: { register(d) { win.def = d; } } };
  win.window = win;
  vm.runInContext(fs.readFileSync(path.join(root, 'features/profile.js'), 'utf8'), vm.createContext(win));
  const mine = JSON.parse(JSON.stringify(win.def.logic.fields.map((f) => [f.key, f.share])));
  const core = JSON.parse(JSON.stringify(Desk.prompt.profileFields.map((f) => [f.key, f.share])));
  assert.deepStrictEqual(mine, core);
});
