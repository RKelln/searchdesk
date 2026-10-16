'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

const Desk = load(['core/strings.js']);

test('t: finds a string, substitutes {vars}', () => {
  Desk.strings.hello = 'Hi {name}, you have {n} left. {name}!';
  assert.strictEqual(Desk.t('hello', { name: 'Sam', n: 0 }), 'Hi Sam, you have 0 left. Sam!');
  assert.strictEqual(Desk.t('hello', { name: 'Sam' }), 'Hi Sam, you have {n} left. Sam!');
  assert.strictEqual(Desk.t('hello'), 'Hi {name}, you have {n} left. {name}!');
});

test('t: a missing key shows the key; odd keys do not leak prototype stuff', () => {
  assert.strictEqual(Desk.t('no.such.key'), 'no.such.key');
  assert.strictEqual(Desk.t('no.such {x}', { x: 1 }), 'no.such 1');
  assert.strictEqual(Desk.t('toString'), 'toString');
  assert.strictEqual(Desk.t('constructor'), 'constructor');
});

test('makeT: feature table first, then core, then the key', () => {
  const ft = Desk.makeT({ tabLabel: 'Sites', today: 'now', n: 'Count {c}' });
  assert.strictEqual(ft('tabLabel'), 'Sites');
  assert.strictEqual(ft('n', { c: 2 }), 'Count 2');
  assert.strictEqual(ft('today'), 'now');       // feature wins
  assert.strictEqual(ft('tomorrow'), 'tomorrow'); // core
  assert.strictEqual(ft('zzz'), 'zzz');
});

const NOW = '2026-10-16'; // a Friday

test('fmtDate: date-only strings never shift; weekday is right', () => {
  assert.strictEqual(Desk.fmtDate('2026-10-22'), 'Thu Oct 22');
  assert.strictEqual(Desk.fmtDate('2026-01-01'), 'Thu Jan 1');
  assert.strictEqual(Desk.fmtDate('2026-12-31'), 'Thu Dec 31');
  assert.strictEqual(Desk.fmtDate('2027-03-05', { now: NOW }), 'Fri Mar 5, 2027');
  assert.strictEqual(Desk.fmtDate('2026-03-05', { now: NOW }), 'Thu Mar 5');
});

test('fmtDate: bad input gives an empty string', () => {
  for (const v of ['', null, undefined, 'soon', '2026-02-30', 'NaN', true]) assert.strictEqual(Desk.fmtDate(v), '', String(v));
});

test('fmtTime and fmtDateTime use local time', () => {
  assert.strictEqual(Desk.fmtTime('2026-10-22T18:00:00'), '6pm');
  assert.strictEqual(Desk.fmtTime('2026-10-22T18:30:00'), '6:30pm');
  assert.strictEqual(Desk.fmtTime('2026-10-22T09:05:00'), '9:05am');
  assert.strictEqual(Desk.fmtTime('2026-10-22T00:00:00'), '12am');
  assert.strictEqual(Desk.fmtTime('2026-10-22T12:15:00'), '12:15pm');
  assert.strictEqual(Desk.fmtTime('2026-10-22'), '');
  assert.strictEqual(Desk.fmtTime(new Date(2026, 9, 22, 18, 0)), '6pm');
  assert.strictEqual(Desk.fmtDateTime('2026-10-22T18:00:00'), 'Thu Oct 22, 6pm');
  assert.strictEqual(Desk.fmtDateTime('2026-10-22'), 'Thu Oct 22');
});

test('fmtRelative: words and counts', () => {
  const r = (v) => Desk.fmtRelative(v, NOW);
  assert.strictEqual(r('2026-10-16'), 'today');
  assert.strictEqual(r('2026-10-17'), 'tomorrow');
  assert.strictEqual(r('2026-10-15'), 'yesterday');
  assert.strictEqual(r('2026-10-19'), 'in 3 days');
  assert.strictEqual(r('2026-10-14'), '2 days late');
  assert.strictEqual(r('2027-01-01'), 'in 77 days');
  assert.strictEqual(Desk.fmtRelative('2026-10-14', NOW, { past: 'ago' }), '2 days ago');
  assert.strictEqual(r('nope'), '');
});

test('fmtRelative: counts calendar days, not 24-hour blocks', () => {
  const now = new Date(2026, 9, 16, 23, 30);
  assert.strictEqual(Desk.fmtRelative(new Date(2026, 9, 17, 0, 10), now), 'tomorrow');
  assert.strictEqual(Desk.fmtRelative('2026-10-16T01:00:00', now), 'today');
  // across a daylight-saving change (Nov 1, 2026 in Toronto)
  assert.strictEqual(Desk.daysFrom('2026-11-02', '2026-10-30'), 3);
  assert.strictEqual(Desk.daysFrom(new Date(2026, 10, 2, 0, 5), new Date(2026, 9, 30, 23, 55)), 3);
});
