'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const TYPES = ['job', 'event-mark', 'suggestion'];
const J = (x) => JSON.parse(JSON.stringify(x));
const rec = (o) => Object.assign({ id: 'job_a', type: 'job', title: 'Cook', stage: 'saved', updated: '2026-10-20T10:00:00Z', source: 'ai' }, o);

function fresh() {
  const D = load(['core/desk.js', 'core/strings.js', 'core/store.js', 'core/merge.js', 'core/inbox.js']);
  let t = Date.UTC(2026, 9, 19, 12, 0, 0);
  D.store.init({ now: () => (t += 1000), device: 'dev1' });
  D.setNow(NOW);
  D.toasts = [];
  D.ui = { toast: (text, o) => D.toasts.push({ text, undo: !!(o && o.undo) }) };
  D.featureDefs = () => [{ types: TYPES }];
  return D;
}
const inbox = (records) => ({ schema: 'searchdesk/1', records });

test('check accepts good records, turns the list into a map and sets source ai', () => {
  const D = fresh();
  const c = D.inbox.check(inbox([rec({ source: undefined }), rec({ id: 'job_b', type: 'event-mark' })]), TYPES, NOW);
  assert.strictEqual(c.error, '');
  assert.strictEqual(c.count, 2);
  assert.strictEqual(c.skipped, 0);
  assert.strictEqual(c.incoming.records.job_a.source, 'ai');
});

test('check refuses a bad schema, a non-list and a non-object', () => {
  const D = fresh();
  assert.strictEqual(D.inbox.check({ schema: 'other', records: [] }, TYPES, NOW).error, 'schema');
  assert.strictEqual(D.inbox.check({ schema: 'searchdesk/1', records: {} }, TYPES, NOW).error, 'records');
  assert.strictEqual(D.inbox.check('x', TYPES, NOW).error, 'shape');
  assert.strictEqual(D.inbox.check(null, TYPES, NOW).error, 'shape');
});

test('check skips and counts unknown types, settings, tombstones, bad dates, bad ids and HTML-looking text', () => {
  const D = fresh();
  const bad = [
    rec({ id: 'x1', type: 'mystery' }),
    rec({ id: 'settings', type: 'settings' }),
    rec({ id: 'x2', deleted: true }),
    rec({ id: 'x3', updated: 'yesterday' }),
    rec({ id: 'x4', updated: '2030-01-01T00:00:00Z' }),
    rec({ id: '' }),
    rec({ id: 'x5', title: '<img src=x onerror=alert(1)>' }),
    rec({ id: 'x6', notes: ['fine', { deep: '<script>1</script>' }] }),
    rec({ id: 'x7', link: 'javascript:alert(1)' }),
    'a string', null, 7,
    rec({ id: 'profile', type: 'profile', email: 'a@b.c' }),
    rec({ id: 'p2', type: 'profile' })
  ];
  const c = D.inbox.check(inbox(bad.concat([rec({ id: 'ok' })])), TYPES.concat([]), NOW);
  assert.strictEqual(c.count, 1);
  assert.strictEqual(c.skipped, bad.length);
  assert.deepStrictEqual(Object.keys(c.incoming.records), ['ok']);
});

test('check allows a profile with no contact fields, and counts a repeated id as one left out', () => {
  const D = fresh();
  const c = D.inbox.check(inbox([rec({ id: 'profile', type: 'profile', field: 'cooking' }), rec(), rec({ title: 'Later' })]), TYPES, NOW);
  assert.strictEqual(c.count, 2);
  assert.strictEqual(c.skipped, 1);
  assert.strictEqual(c.incoming.records.job_a.title, 'Later');
});

test('fingerprint is stable and changes with the content', () => {
  const D = fresh();
  const a = inbox([rec()]);
  assert.strictEqual(D.inbox.fingerprint(a), D.inbox.fingerprint(J(a)));
  assert.notStrictEqual(D.inbox.fingerprint(a), D.inbox.fingerprint(inbox([rec({ title: 'Other' })])));
  assert.strictEqual(D.inbox.fingerprint(undefined), '');
});

test('sentence says one or many, and joins the parts', () => {
  const D = fresh();
  const s = (c) => D.inbox.sentence(Object.assign({ changes: 0, kept: 0, skipped: 0, error: '' }, c), D.t);
  assert.strictEqual(s({ changes: 5 }), 'Brought in 5 changes from your helper.');
  assert.strictEqual(s({ changes: 1 }), 'Brought in 1 change from your helper.');
  assert.strictEqual(s({ changes: 2, kept: 1, skipped: 2 }), 'Brought in 2 changes from your helper. Kept 1 that was newer here. 2 items from your helper were left out.');
  assert.strictEqual(s({ skipped: 1 }), '1 item from your helper was left out.');
  assert.match(s({ error: 'schema' }), /nothing was changed/);
  assert.strictEqual(s({}), '');
});

test('run brings records in as one batch with Undo, and a second run does nothing', () => {
  const D = fresh();
  D.store.put({ type: 'job', id: 'job_mine', title: 'Mine', stage: 'saved' });
  D.store.put({ type: 'job', id: 'job_a', title: 'Old', stage: 'saved', updated: undefined });
  const before = D.store.state();
  D.setNow(NOW);
  const FILE = inbox([rec({ id: 'job_a', title: 'New', updated: '2030-01-01T00:00:00Z' }), rec({ id: 'job_n' }), rec({ id: 'job_z', type: 'mystery' })]);
  const r = D.inbox.run({ sourceCopy: true, raw: FILE });
  assert.strictEqual(r.changes, 1 + 0); // job_a is dated in the future, so it was left out; job_n was added
  assert.strictEqual(r.skipped, 2);
  assert.strictEqual(D.toasts.length, 1);
  assert.strictEqual(D.toasts[0].undo, true);
  assert.strictEqual(D.store.get('job_n').source, 'ai');
  assert.strictEqual(D.store.get('job_a').title, 'Old');
  D.store.undo();
  assert.strictEqual(D.store.get('job_n'), undefined);
  assert.deepStrictEqual(Object.keys(D.store.state().records).filter((k) => k !== 'settings').sort(), Object.keys(before.records).sort());
  // Same file again: nothing new, no toast, and Undo's work is not brought back.
  const r2 = D.inbox.run({ sourceCopy: true, raw: FILE });
  assert.strictEqual(r2.ran, false);
  assert.strictEqual(D.toasts.length, 1);
  assert.strictEqual(D.store.get('job_n'), undefined);
});

test('the newer record wins, and on a tie the record already here stays', () => {
  const D = fresh();
  D.store.putQuiet({ type: 'job', id: 'job_t', title: 'Here', stage: 'saved' });
  const here = D.store.get('job_t');
  let r = D.inbox.run({ sourceCopy: true, raw: inbox([rec({ id: 'job_t', title: 'Tie', updated: here.updated })]) });
  assert.strictEqual(r.changes, 0);
  assert.strictEqual(D.store.get('job_t').title, 'Here');
  r = D.inbox.run({ sourceCopy: true, raw: inbox([rec({ id: 'job_t', title: 'Older', updated: '2020-01-01T00:00:00Z' })]) });
  assert.strictEqual(r.kept, 1);
  assert.strictEqual(D.store.get('job_t').title, 'Here');
  r = D.inbox.run({ sourceCopy: true, raw: inbox([rec({ id: 'job_t', title: 'Newer', updated: '2026-10-20T11:00:00Z' })]) });
  assert.strictEqual(r.changes, 1);
  assert.strictEqual(D.store.get('job_t').title, 'Newer');
});

test('a bad file shows one plain line, changes nothing, and is not shown again', () => {
  const D = fresh();
  const r = D.inbox.run({ sourceCopy: true, raw: { schema: 'nope', records: [] } });
  assert.strictEqual(r.error, 'schema');
  assert.strictEqual(D.toasts[0].undo, false);
  assert.strictEqual(D.store.all().filter((x) => x.type !== 'settings').length, 0);
  assert.strictEqual(D.inbox.run({ sourceCopy: true, raw: { schema: 'nope', records: [] } }).ran, false);
});

test('run does nothing outside the source copy', () => {
  const D = fresh();
  assert.strictEqual(D.inbox.run({ raw: inbox([rec()]) }).ran, false);
  assert.strictEqual(D.store.get('job_a'), undefined);
});
