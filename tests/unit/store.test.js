'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');
const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));

function fresh() {
  const D = load(['core/store.js']);
  let t = Date.UTC(2026, 9, 19, 12, 0, 0);
  D.store.init({ now: () => (t += 1000), device: 'dev1' });
  return D.store;
}

test('put creates with id, prefix, created, updated, source', () => {
  const s = fresh();
  const j = s.put({ type: 'job', title: 'Cook' });
  assert.match(j.id, /^j_[0-9a-hjkmnp-tv-z]{10}$/);
  assert.strictEqual(j.source, 'user');
  assert.strictEqual(j.updated, '2026-10-19T12:00:02.000Z');
  assert.ok(j.created);
  assert.match(s.put({ type: 'event-mark' }).id, /^em_/);
});

test('ids come from the injected random and differ by default', () => {
  const s = fresh();
  assert.notStrictEqual(s.put({ type: 'job' }).id, s.put({ type: 'job' }).id);
  const D = load(['core/store.js']);
  D.store.init({ random: (n) => new Uint8Array(n) });
  assert.strictEqual(D.store.put({ type: 'job' }).id, 'j_0000000000');
});

test('singletons get a fixed id', () => {
  const s = fresh();
  assert.strictEqual(s.put({ type: 'profile' }).id, 'profile');
  s.put({ type: 'profile', field: 'x' });
  assert.strictEqual(s.all('profile').length, 1);
});

test('get, all, update bumps updated, keeps created', () => {
  const s = fresh();
  const a = s.put({ type: 'job', title: 'A' });
  s.put({ type: 'note' });
  const b = s.put({ id: a.id, type: 'job', title: 'B' });
  assert.strictEqual(s.get(a.id).title, 'B');
  assert.strictEqual(b.created, a.created);
  assert.ok(b.updated > a.updated);
  assert.strictEqual(s.all('job').length, 1);
  assert.strictEqual(s.all().length, 2);
  assert.strictEqual(s.get('nope'), undefined);
});

test('reads return copies', () => {
  const s = fresh();
  const a = s.put({ type: 'job', title: 'A' });
  s.get(a.id).title = 'changed';
  assert.strictEqual(s.get(a.id).title, 'A');
});

test('remove writes a tombstone hidden by default', () => {
  const s = fresh();
  const a = s.put({ type: 'job', title: 'A', notes: 'secret' });
  assert.strictEqual(s.remove(a.id), true);
  assert.strictEqual(s.get(a.id), undefined);
  assert.strictEqual(s.all('job').length, 0);
  const t = s.get(a.id, { withDeleted: true });
  assert.strictEqual(t.deleted, true);
  assert.ok(t.updated > a.updated);
  assert.strictEqual(t.notes, undefined);
  assert.strictEqual(s.all('job', { withDeleted: true }).length, 1);
  assert.strictEqual(s.all({ withDeleted: true }).length, 1);
  assert.strictEqual(s.remove(a.id), false);
  assert.strictEqual(s.remove('nope'), false);
  assert.strictEqual(s.state().records[a.id].deleted, true);
});

test('put on a tombstoned id revives it', () => {
  const s = fresh();
  const a = s.put({ type: 'job' });
  s.remove(a.id);
  s.put({ id: a.id, type: 'job', title: 'back' });
  assert.strictEqual(s.get(a.id).title, 'back');
});

test('ext sets a namespace, merges, keeps others', () => {
  const s = fresh();
  const a = s.put({ type: 'job' });
  s.ext(a.id, { x: 1 }, 'notes');
  const r = s.ext(a.id, { y: 2 }, 'notes');
  s.ext(a.id, { z: 3 }, 'other');
  same(s.get(a.id).ext, { notes: { x: 1, y: 2 }, other: { z: 3 } });
  assert.ok(r.updated > a.updated);
  assert.throws(() => s.ext(a.id, {}), /which feature/);
  assert.throws(() => s.ext('nope', {}, 'notes'), /no such record/);
});

test('put keeps ext it was not given', () => {
  const s = fresh();
  const a = s.put({ type: 'job' });
  s.ext(a.id, { x: 1 }, 'notes');
  s.put({ id: a.id, type: 'job', title: 'T' });
  same(s.get(a.id).ext, { notes: { x: 1 } });
});

test('scoped store: ownership refusals with plain errors', () => {
  const s = fresh();
  const job = s.put({ type: 'job', title: 'J' });
  const ev = s.scoped('events', ['event-mark']);
  assert.ok(ev.put({ type: 'event-mark', eventId: 'e1' }).id);
  assert.throws(() => ev.put({ type: 'job' }), /may not change "job"/);
  assert.throws(() => ev.remove(job.id), /may not remove "job"/);
  assert.throws(() => ev.put({ id: job.id, type: 'event-mark' }), /already used/);
  assert.strictEqual(ev.get(job.id).title, 'J'); // reads are free
  assert.strictEqual(ev.all('job').length, 1);
  assert.ok(ev.remove(ev.all('event-mark')[0].id));
  assert.ok(!('init' in ev) && !('load' in ev) && !('state' in ev));
  assert.throws(() => ev.put({ type: 'job' }), (e) => e.name === 'Error' && !/at |undefined/.test(e.message));
});

test('scoped ext: own namespace on any record, never another', () => {
  const s = fresh();
  const job = s.put({ type: 'job' });
  const n = s.scoped('notes', []);
  n.ext(job.id, { a: 1 });
  same(s.get(job.id).ext, { notes: { a: 1 } });
  const bad = s.scoped('evil', ['job']);
  bad.put({ id: job.id, type: 'job', ext: { notes: { a: 'stolen' }, evil: { b: 1 } } });
  same(s.get(job.id).ext, { notes: { a: 1 }, evil: { b: 1 } });
  bad.ext(job.id, { b: 2 }, 'notes'); // a third argument cannot redirect it
  assert.strictEqual(s.get(job.id).ext.notes.b, undefined);
  assert.strictEqual(s.get(job.id).ext.evil.b, 2);
  assert.throws(() => bad.undo(), /Undo is handled/);
});

test('batch: one subscribe call, one undo step', () => {
  const s = fresh();
  const calls = [];
  s.subscribe((e) => calls.push(e));
  s.batch('Import', () => {
    s.put({ type: 'job', title: 'A' });
    s.put({ type: 'job', title: 'B' });
    s.batch('inner', () => s.put({ type: 'job', title: 'C' }));
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].label, 'Import');
  assert.strictEqual(calls[0].ids.length, 3);
  assert.strictEqual(s.all('job').length, 3);
  assert.strictEqual(s.undoLabel(), 'Import');
  assert.strictEqual(s.undo(), 'Import');
  assert.strictEqual(s.all('job').length, 0);
  assert.strictEqual(calls.length, 2); // the undo notifies once too
  assert.strictEqual(s.undo(), false);
  assert.strictEqual(s.canUndo(), false);
});

test('undo restores edits, removals and ext', () => {
  const s = fresh();
  const a = s.put({ type: 'job', title: 'A' });
  s.batch('edit', () => { s.put({ id: a.id, type: 'job', title: 'B' }); s.ext(a.id, { q: 1 }, 'x'); s.remove(a.id); });
  assert.strictEqual(s.get(a.id), undefined);
  s.undo();
  assert.strictEqual(s.get(a.id).title, 'A');
  assert.strictEqual(s.get(a.id).ext, undefined);
});

test('undo of a mixed batch returns every record to before', () => {
  const s = fresh();
  const a = s.put({ type: 'job', title: 'A' });
  const before = JSON.stringify(s.state());
  s.batch('mix', () => { s.put({ id: a.id, type: 'job', title: 'B' }); s.put({ type: 'job' }); s.ext(a.id, { q: 1 }, 'f'); });
  s.undo();
  assert.strictEqual(JSON.stringify(s.state()), before);
  s.remove(a.id);
  s.undo();
  assert.strictEqual(s.get(a.id).title, 'A');
});

test('a throwing batch rolls back and does not notify', () => {
  const s = fresh();
  let n = 0;
  s.subscribe(() => n++);
  assert.throws(() => s.batch('x', () => { s.put({ type: 'job' }); throw new Error('boom'); }), /boom/);
  assert.strictEqual(s.all().length, 0);
  assert.strictEqual(n, 0);
  assert.strictEqual(s.canUndo(), false);
});

test('single writes are single steps; unsubscribe works; undo depth is 1', () => {
  const s = fresh();
  let n = 0;
  const off = s.subscribe(() => n++);
  s.put({ type: 'job' });
  assert.strictEqual(n, 1);
  off();
  s.put({ type: 'job' });
  assert.strictEqual(n, 1);
  s.put({ type: 'job' });
  s.put({ type: 'job' });
  assert.strictEqual(s.undo(), 'Save');
  assert.strictEqual(s.all('job').length, 3);
  assert.strictEqual(s.undo(), false);
});

test('load validates schema, keeps unknown types and ext', () => {
  const s = fresh();
  assert.match(s.load({ schema: 'other' }), /not a Search Desk file/);
  assert.match(s.load(null), /not a Search Desk file/);
  const st = { schema: 'searchdesk/1', device: 'd', records: { z1: { id: 'z1', type: 'future', updated: 'x', ext: { f: { a: 1 } } } } };
  assert.strictEqual(s.load(st), '');
  assert.strictEqual(s.get('z1').type, 'future');
  same(s.state().records.z1.ext, { f: { a: 1 } });
  assert.strictEqual(s.state().schema, 'searchdesk/1');
  assert.strictEqual(s.canUndo(), false);
});

test('put without a type is refused', () => {
  assert.throws(() => fresh().put({ title: 'x' }), /needs a type/);
});

test('regression: ext clones the patch', () => {
  const s = fresh();
  const n = s.scoped('n1', []);
  const a = s.put({ type: 'job' });
  const p = { deep: { v: 1 } };
  n.ext(a.id, p);
  p.deep.v = 99;
  assert.strictEqual(s.get(a.id).ext.n1.deep.v, 1);
});

test('regression: prototype-key and non-string ids are safe', () => {
  const s = fresh();
  const n = s.scoped('n1', ['job']);
  assert.throws(() => n.ext('__proto__', { x: 1 }), /not a usable record id/);
  assert.throws(() => s.remove('__proto__'), /not a usable record id/);
  assert.throws(() => s.put({ id: '__proto__', type: 'job' }), /not a usable record id/);
  assert.throws(() => s.put({ id: 5, type: 'job' }), /not a usable record id/);
  assert.strictEqual(s.get('constructor'), undefined);
  assert.strictEqual(s.get('__proto__'), undefined);
  assert.strictEqual(s.remove('toString'), false);
  assert.throws(() => s.ext('toString', {}, 'n1'), /no such record/);
  assert.strictEqual(({}).x, undefined);
  assert.strictEqual(s.all().length, 0);
});

test('regression: undo is depth 1 and singleton ids are reserved', () => {
  const s = fresh();
  assert.throws(() => s.put({ id: 'profile', type: 'job' }), /kept for/);
  assert.strictEqual(s.put({ id: 'settings', type: 'settings' }).id, 'settings');
});

test('regression: generated ids never reuse an existing id', () => {
  const D = load(['core/store.js']);
  let calls = 0;
  D.store.init({ random: (n) => new Uint8Array(n).fill(calls++ < 10 ? 0 : 1) });
  const a = D.store.put({ type: 'job' });
  const b = D.store.put({ type: 'job' });
  assert.notStrictEqual(a.id, b.id);
});

test('regression: ext replaces a non-object ext value instead of throwing', () => {
  const s = fresh();
  s.load({ schema: 'searchdesk/1', records: { a: { id: 'a', type: 'job', ext: { n: 'str' } }, b: { id: 'b', type: 'job', ext: 'bad' } } });
  s.ext('a', { v: 1 }, 'n');
  s.ext('b', { v: 2 }, 'n');
  same(s.get('a').ext, { n: { v: 1 } });
  same(s.get('b').ext, { n: { v: 2 } });
});

test('regression: load drops and counts malformed records, rejects array records', () => {
  const s = fresh();
  assert.match(s.load({ schema: 'searchdesk/1', records: [] }), /no records/);
  const r = s.load({ schema: 'searchdesk/1', records: { a: { id: 'a', type: 'job' }, b: 'str', c: { id: 'x', type: 'job' }, d: null, e: { id: 'e' } } });
  assert.strictEqual(r, '');
  assert.strictEqual(s.dropped(), 4);
  same(s.all().map((x) => x.id), ['a']);
});

test('regression: restoreStep checks shape and fingerprint', () => {
  const s = fresh();
  const a = s.put({ type: 'job', title: 'A' });
  s.put({ id: a.id, type: 'job', title: 'B' });
  const step = s.lastStep();
  assert.ok(step.after[a.id]);
  // good step, same state
  const s2 = fresh();
  s2.load(s.state());
  assert.strictEqual(s2.restoreStep(step), true);
  assert.strictEqual(s2.undo(), 'Save');
  assert.strictEqual(s2.get(a.id).title, 'A');
  // stale: record changed since
  const s3 = fresh();
  const newer = s.state();
  newer.records[a.id].updated = '2031-01-01T00:00:00.000Z';
  s3.load(newer);
  assert.strictEqual(s3.restoreStep(step), false);
  assert.strictEqual(s3.canUndo(), false);
  // malformed
  const s4 = fresh();
  s4.load(s.state());
  const evil = { label: 'x', before: { [a.id]: 'str' }, after: { [a.id]: step.after[a.id] } };
  assert.strictEqual(s4.restoreStep(evil), false);
  assert.strictEqual(s4.restoreStep({ label: 'x', before: { [a.id]: { id: 'other', type: 'job' } }, after: { [a.id]: step.after[a.id] } }), false);
  assert.strictEqual(s4.restoreStep({ before: {} }), false);
  assert.strictEqual(s4.restoreStep(null), false);
  assert.strictEqual(s4.canUndo(), false);
  assert.strictEqual(s4.all().length, 1);
});
