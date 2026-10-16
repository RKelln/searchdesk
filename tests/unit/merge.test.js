'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');
const Desk = load(['core/merge.js']);
const merge = (a, b) => { const r = Desk.merge(a, b); return JSON.parse(JSON.stringify(r)); };

const rec = (id, updated, extra) => Object.assign({ id, type: 'job', updated, source: 'user', title: id }, extra || {});
const st = (device, recs) => {
  const records = {};
  (recs || []).forEach((r) => { records[r.id] = r; });
  return { schema: 'searchdesk/1', app: 'x', device, records };
};

test('newer wins, both ways', () => {
  const a = st('d1', [rec('j_1', '2026-10-16T10:00:00Z', { title: 'old' })]);
  const b = st('d2', [rec('j_1', '2026-10-16T11:00:00Z', { title: 'new' })]);
  const r1 = merge(a, b);
  assert.strictEqual(r1.state.records.j_1.title, 'new');
  assert.strictEqual(r1.report.updated, 1);
  const r2 = merge(b, a);
  assert.strictEqual(r2.state.records.j_1.title, 'new');
  assert.strictEqual(r2.report.kept, 1);
  assert.strictEqual(r2.report.updated, 0);
});

test('adds records that are new; local-only records stay', () => {
  const a = st('d1', [rec('j_1', '2026-10-16T10:00:00Z')]);
  const b = st('d2', [rec('j_2', '2026-10-16T10:00:00Z')]);
  const r = merge(a, b);
  assert.deepStrictEqual(Object.keys(r.state.records).sort(), ['j_1', 'j_2']);
  assert.strictEqual(r.report.added, 1);
  assert.strictEqual(r.report.byType.job.added, 1);
});

test('tie is broken by the higher device, either order', () => {
  const t = '2026-10-16T10:00:00Z';
  const a = st('d1', [rec('j_1', t, { title: 'from d1' })]);
  const b = st('d2', [rec('j_1', t, { title: 'from d2' })]);
  assert.strictEqual(merge(a, b).state.records.j_1.title, 'from d2');
  assert.strictEqual(merge(b, a).state.records.j_1.title, 'from d2');
});

test('a newer tombstone wins; an older one loses', () => {
  const a = st('d1', [rec('j_1', '2026-10-16T10:00:00Z')]);
  const gone = st('d2', [rec('j_1', '2026-10-16T11:00:00Z', { deleted: true })]);
  const r = merge(a, gone);
  assert.strictEqual(r.state.records.j_1.deleted, true);
  assert.strictEqual(r.report.removed, 1);
  const old = st('d2', [rec('j_1', '2026-10-16T09:00:00Z', { deleted: true })]);
  const r2 = merge(a, old);
  assert.strictEqual(r2.state.records.j_1.deleted, undefined);
  assert.strictEqual(r2.report.kept, 1);
  // a newer live record revives an older tombstone
  const r3 = merge(old, a);
  assert.strictEqual(r3.state.records.j_1.deleted, undefined);
});

test('unknown types and unknown ext keys are kept', () => {
  const a = st('d1', [rec('j_1', '2026-10-16T10:00:00Z', { ext: { mine: { a: 1 } } })]);
  const b = st('d2', [
    { id: 'z_1', type: 'future-thing', updated: '2026-10-16T10:00:00Z', source: 'user', weird: [1, 2] },
    rec('j_1', '2026-10-16T11:00:00Z', { ext: { other: { b: 2 } } })
  ]);
  const r = merge(a, b);
  assert.deepStrictEqual(r.state.records.z_1.weird, [1, 2]);
  assert.deepStrictEqual(r.state.records.j_1.ext, { other: { b: 2 } }); // whole record wins
  const r2 = merge(b, a);
  assert.deepStrictEqual(r2.state.records.j_1.ext, { other: { b: 2 } });
  const keep = merge(st('d2', [rec('j_1', '2026-10-16T12:00:00Z', { ext: { unknownFeature: { q: 1 } } })]), a);
  assert.deepStrictEqual(keep.state.records.j_1.ext, { unknownFeature: { q: 1 } });
});

test('example records are not imported; local ones are left alone', () => {
  const a = st('d1', [rec('j_ex', '2026-10-16T10:00:00Z', { source: 'example', title: 'mine' })]);
  const b = st('d2', [
    rec('j_ex', '2026-10-16T12:00:00Z', { source: 'example', title: 'theirs' }),
    rec('j_ex2', '2026-10-16T12:00:00Z', { source: 'example' }),
    rec('j_real', '2026-10-16T12:00:00Z')
  ]);
  const r = merge(a, b);
  assert.strictEqual(r.state.records.j_ex.title, 'mine');
  assert.ok(!r.state.records.j_ex2);
  assert.ok(r.state.records.j_real);
  assert.strictEqual(r.report.skippedExample, 2);
  assert.strictEqual(r.report.added, 1);
});

test('idempotent: merging twice equals merging once', () => {
  const t = '2026-10-16T10:00:00Z';
  const a = st('d1', [rec('j_1', t, { title: 'a' }), rec('j_2', '2026-10-16T09:00:00Z'), rec('j_3', t)]);
  const b = st('d2', [rec('j_1', t, { title: 'b' }), rec('j_2', '2026-10-16T11:00:00Z', { deleted: true }), rec('j_4', t)]);
  const once = merge(a, b);
  const twice = merge(once.state, b);
  assert.deepStrictEqual(twice.state, once.state);
  assert.strictEqual(twice.report.added + twice.report.updated + twice.report.removed, 0);
  assert.strictEqual(twice.report.unchanged, 3);
});

test('importing your own export back: nothing new', () => {
  const a = st('d1', [rec('j_1', '2026-10-16T10:00:00Z')]);
  const r = merge(a, JSON.parse(JSON.stringify(a)));
  assert.strictEqual(r.report.unchanged, 1);
  assert.strictEqual(r.report.added + r.report.updated + r.report.removed + r.report.kept, 0);
});

test('importing into an empty state adds everything back', () => {
  const b = st('d1', [rec('j_1', '2026-10-16T10:00:00Z'), rec('j_2', '2026-10-16T10:00:00Z')]);
  const r = merge(st('d9', []), b);
  assert.strictEqual(r.report.added, 2);
  assert.strictEqual(r.state.device, 'd9');
  assert.strictEqual(merge(null, b).report.added, 2);
});

test('wrong schema and garbage are rejected with a sentence', () => {
  const a = st('d1', []);
  const bad = [
    merge(a, { schema: 'searchdesk/2', records: {} }),
    merge(a, { schema: 'other', records: {} }),
    merge(a, { records: {} }),
    merge(a, { schema: 'searchdesk/1' }),
    merge(a, { schema: 'searchdesk/1', records: [] }),
    merge(a, null), merge(a, 'text'), merge(a, 42), merge(a, [1]), merge(a, undefined),
    merge({ nope: 1 }, st('d2', []))
  ];
  for (const r of bad) {
    assert.strictEqual(typeof r.error, 'string');
    assert.ok(/^[A-Z].*\.$/.test(r.error));
    assert.strictEqual(r.state, undefined);
  }
});

test('malformed records are skipped and counted', () => {
  const b = st('d2', []);
  b.records.x = 'nope';
  b.records.y = { id: 'other', type: 'job', updated: '2026-10-16T10:00:00Z' };
  b.records.z = { id: 'z', type: 'job' };
  const r = merge(st('d1', []), b);
  assert.strictEqual(r.report.skippedBad, 3);
  assert.deepStrictEqual(r.state.records, {});
});

test('inputs are not mutated, and the result shares nothing with them', () => {
  const a = st('d1', [rec('j_1', '2026-10-16T10:00:00Z', { ext: { m: { n: 1 } } })]);
  const b = st('d2', [rec('j_1', '2026-10-16T11:00:00Z', { ext: { m: { n: 2 } } }), rec('j_2', '2026-10-16T11:00:00Z')]);
  const a0 = JSON.stringify(a), b0 = JSON.stringify(b);
  const r = merge(a, b);
  assert.strictEqual(JSON.stringify(a), a0);
  assert.strictEqual(JSON.stringify(b), b0);
  r.state.records.j_1.ext.m.n = 99;
  r.state.records.j_2.title = 'changed';
  assert.strictEqual(JSON.stringify(b), b0);
  assert.strictEqual(JSON.stringify(a), a0);
});
