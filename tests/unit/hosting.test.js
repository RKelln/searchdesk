'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load.js');

function desk(extras) { return load(['core/hosting.js'], Object.assign({ location: { protocol: 'https:' } }, extras)); }
const base = { protocol: 'https:', small: true, touch: false, standalone: false, dismissed: false, workshop: false };

test('hint: only on http(s), on a small or touch screen, not installed, not dismissed', () => {
  const h = desk().hosting;
  assert.strictEqual(h.shouldShowHint(base), true);
  assert.strictEqual(h.shouldShowHint(Object.assign({}, base, { small: false, touch: true })), true);
  assert.strictEqual(h.shouldShowHint(Object.assign({}, base, { protocol: 'file:' })), false);
  assert.strictEqual(h.shouldShowHint(Object.assign({}, base, { small: false })), false);
  assert.strictEqual(h.shouldShowHint(Object.assign({}, base, { standalone: true })), false);
  assert.strictEqual(h.shouldShowHint(Object.assign({}, base, { dismissed: true })), false);
  assert.strictEqual(h.shouldShowHint(Object.assign({}, base, { workshop: true })), false);
  assert.strictEqual(h.shouldShowHint(), false);
});

test('hint kind: the Android prompt wins, then iOS wording, then the menu wording', () => {
  const h = desk().hosting;
  assert.strictEqual(h.hintKind({ hasPrompt: true, ios: true }), 'prompt');
  assert.strictEqual(h.hintKind({ ios: true }), 'ios');
  assert.strictEqual(h.hintKind({}), 'menu');
});

test('saved(): asks for persistent storage once, and never on file://', () => {
  let n = 0;
  const nav = { storage: { persist() { n++; return Promise.resolve(true); } } };
  const h = desk({ navigator: nav }).hosting;
  h.saved(); h.saved();
  assert.strictEqual(n, 1);
  let m = 0;
  const f = load(['core/hosting.js'], { location: { protocol: 'file:' }, navigator: { storage: { persist() { m++; } } } }).hosting;
  f.saved();
  assert.strictEqual(m, 0);
});

test('saved(): a throwing or rejecting persist() is silent', () => {
  desk({ navigator: { storage: { persist() { throw new Error('no'); } } } }).hosting.saved();
  desk({ navigator: { storage: { persist() { return Promise.reject(new Error('no')); } } } }).hosting.saved();
});
