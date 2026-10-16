'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

function fresh() {
  const D = load(['core/strings.js', 'core/store.js', 'core/merge.js', 'core/io.js']);
  let t = Date.UTC(2026, 9, 19, 12, 0, 0);
  D.store.init({ now: () => (t += 1000), device: 'dev1' });
  return D;
}
const J = (x) => JSON.parse(JSON.stringify(x));

test('filename uses the local date', () => {
  const D = fresh();
  assert.strictEqual(D.io.filename(new Date(2026, 9, 5, 23, 59)), 'searchdesk-2026-10-05.json');
  assert.strictEqual(D.io.filename(new Date(2027, 0, 31, 0, 1)), 'searchdesk-2027-01-31.json');
});

test('exportText is pretty, drops example records and their tombstones, and strips device settings', () => {
  const D = fresh();
  const s = D.store;
  s.put({ type: 'job', title: 'mine' });
  const ex = s.put({ type: 'job', title: 'made up', source: 'example' });
  s.remove(ex.id);
  s.put({ type: 'job', title: 'made up 2', source: 'example' });
  s.put({ type: 'settings', service: 'chatgpt', lastExport: '2026-01-01T00:00:00.000Z', exampleLoaded: true });
  const text = D.io.exportText(s.state(), '2026.10.19');
  assert.ok(text.includes('\n  "schema": "searchdesk/1"'));
  const o = JSON.parse(text);
  assert.strictEqual(o.schema, 'searchdesk/1');
  assert.strictEqual(o.device, 'dev1');
  const recs = Object.values(o.records);
  assert.strictEqual(recs.length, 2);
  assert.ok(recs.every((r) => r.source !== 'example'));
  const st = o.records.settings;
  assert.strictEqual(st.service, 'chatgpt');
  assert.strictEqual(st.lastExport, undefined);
  assert.strictEqual(st.exampleLoaded, undefined);
  assert.strictEqual(s.get('settings').lastExport, '2026-01-01T00:00:00.000Z'); // the store is untouched
});

test('detectPaste tells state, answer, empty and unknown apart', () => {
  const D = fresh();
  const d = D.io.detectPaste;
  const state = JSON.stringify({ schema: 'searchdesk/1', records: {} });
  assert.strictEqual(d(state), 'state');
  assert.strictEqual(d('  \n' + state + '\n  '), 'state');
  assert.strictEqual(d('```json\n' + state + '\n```'), 'state');
  assert.strictEqual(d(JSON.stringify({ schema: 'searchdesk/2', records: {} })), 'state');
  assert.strictEqual(d(''), 'empty');
  assert.strictEqual(d('   \n '), 'empty');
  assert.strictEqual(d(null), 'empty');
  assert.strictEqual(d('```\nDESK-7Q3K\nL1 | fits you\n```'), 'answer');
  assert.strictEqual(d('Sure! Here you go:\nL3 - good fit\nC22: near you'), 'answer');
  assert.strictEqual(d('{"t":"pick","id":"L3","why":"x"}'), 'answer');
  assert.strictEqual(d('HOW TO ANSWER\nPut your whole answer'), 'answer');
  assert.strictEqual(d('hello there'), 'unknown');
  assert.strictEqual(d('{"schema": 5}'), 'unknown');
  assert.strictEqual(d('{"a":1}'), 'unknown');
  assert.strictEqual(d('{broken'), 'unknown');
  assert.strictEqual(d('[1,2]'), 'unknown');
});

test('report sentences', () => {
  const D = fresh();
  const s = D.io.reportSentence;
  assert.strictEqual(s({ added: 3, updated: 5, removed: 0, kept: 12, skipped: 0 }), 'Added 3 · Updated 5 · Kept 12 that were newer here');
  assert.strictEqual(s({ added: 0, updated: 2, removed: 0, kept: 0, skipped: 0 }), 'Updated 2');
  assert.strictEqual(s({ added: 4, updated: 0, removed: 0, kept: 0, skipped: 0 }), 'Added 4. Everything was added back.');
  assert.strictEqual(s({ added: 1, updated: 0, removed: 2, kept: 0, skipped: 0 }), 'Added 1 · Removed 2');
  assert.strictEqual(s({ added: 0, updated: 0, removed: 0, kept: 0, skipped: 0 }), 'Nothing new. Everything in this copy is already here.');
  assert.strictEqual(s({ added: 0, updated: 0, removed: 0, kept: 3, skipped: 0 }), 'Nothing new. Kept 3 that were newer here.');
  assert.strictEqual(s({ added: 2, updated: 0, removed: 0, kept: 0, skipped: 1 }), 'Added 2 · Skipped 1 that could not be read');
});

test('reportCounts leaves out settings and uses kept, not unchanged', () => {
  const D = fresh();
  const c = D.io.reportCounts({ skippedBad: 1, byType: {
    job: { added: 2, updated: 1, removed: 0, kept: 4, unchanged: 9 },
    settings: { added: 1, updated: 0, removed: 0, kept: 0, unchanged: 0 } } });
  assert.deepStrictEqual(J(c), { added: 2, updated: 1, removed: 0, kept: 4, skipped: 1 });
});

test('hasChanges: made-up and settings records do not count; never exported means anything counts', () => {
  const D = fresh();
  const recs = {
    a: { id: 'a', type: 'job', updated: '2026-10-01T00:00:00.000Z' },
    b: { id: 'b', type: 'job', updated: '2026-12-01T00:00:00.000Z', source: 'example' },
    settings: { id: 'settings', type: 'settings', updated: '2026-12-01T00:00:00.000Z' }
  };
  assert.strictEqual(D.io.hasChanges(recs, '2026-10-02T00:00:00.000Z'), false);
  assert.strictEqual(D.io.hasChanges(recs, '2026-09-30T00:00:00.000Z'), true);
  assert.strictEqual(D.io.hasChanges(recs, undefined), true);
  assert.strictEqual(D.io.hasChanges({}, undefined), false);
  assert.strictEqual(D.io.hasChanges({ b: recs.b, settings: recs.settings }, undefined), false);
});

test('nudge: changes AND (7 days OR 10 records)', () => {
  const D = fresh();
  const now = new Date(Date.UTC(2026, 9, 19, 12, 0, 0));
  const ago = (d) => ({ lastExport: new Date(now.getTime() - d * 86400000).toISOString() });
  let n = D.io.nudge(ago(9), 3, true, now);
  assert.strictEqual(n.show, true);
  assert.strictEqual(n.text, 'Last saved a copy: 9 days ago');
  assert.strictEqual(D.io.nudge(ago(9), 3, false, now).show, false);
  assert.strictEqual(D.io.nudge(ago(6), 9, true, now).show, false);
  assert.strictEqual(D.io.nudge(ago(6), 10, true, now).show, true);
  assert.strictEqual(D.io.nudge(ago(7), 1, true, now).show, true);
  n = D.io.nudge({}, 2, true, now);
  assert.strictEqual(n.show, true);
  assert.strictEqual(n.text, 'Last saved a copy: never');
  assert.strictEqual(D.io.nudge(undefined, 0, false, now).show, false);
  assert.strictEqual(D.io.nudge(ago(0), 1, true, now).text, 'Last saved a copy: today');
});

test('the size cap is 5 MB and a too-big paste changes nothing', () => {
  const D = fresh();
  assert.strictEqual(D.io.MAX_BYTES, 5 * 1024 * 1024);
  const r = D.io.importText('x'.repeat(D.io.MAX_BYTES + 1));
  assert.strictEqual(r.ok, false);
  assert.match(r.text, /too big/);
  assert.strictEqual(D.store.all().length, 0);
});

function twoDevices() {
  const A = fresh();
  A.store.put({ type: 'job', title: 'one' });
  A.store.put({ type: 'job', title: 'two' });
  A.store.put({ type: 'profile', field: 'cooking' });
  A.store.put({ type: 'settings', service: 'x', lastExport: '2026-10-19T12:00:00.000Z' });
  return { A, text: A.io.exportText(A.store.state(), 'v') };
}

test('import: export, clear, import adds everything back; same file again is nothing new', () => {
  const { A, text } = twoDevices();
  const before = A.store.all().filter((r) => r.type !== 'settings').map((r) => r.id).sort();
  const B = load(['core/strings.js', 'core/store.js', 'core/merge.js', 'core/io.js']);
  B.store.init({ now: () => Date.UTC(2027, 0, 1), device: 'zzz' });
  const r1 = B.io.importText(text);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.text, 'Added 3. Everything was added back.');
  assert.ok(r1.token !== null);
  assert.deepStrictEqual(J(B.store.all().filter((r) => r.type !== 'settings').map((r) => r.id).sort()), J(before));
  const j = B.store.all('job')[0];
  assert.strictEqual(j.updated, A.store.get(j.id).updated); // kept verbatim
  const r2 = B.io.importText(text);
  assert.match(r2.text, /^Nothing new\./);
  assert.strictEqual(r2.token, null);
  assert.strictEqual(B.store.undoLabel(), 'Import'); // the second import made no step of its own
});

test('import is one undo step, and undo removes it all', () => {
  const { text } = twoDevices();
  const B = fresh();
  B.io.importText(text);
  assert.strictEqual(B.store.undoLabel(), 'Import');
  B.store.undo();
  assert.strictEqual(B.store.all({ withDeleted: true }).length, 0);
});

test('import keeps newer local records and reports them as kept; device settings are not overwritten', () => {
  const { text } = twoDevices();
  const B = fresh();
  B.io.importText(text);
  const mine = B.store.all('job')[0];
  B.store.put({ ...mine, title: 'edited here' }); // newer than the file
  B.store.putQuiet({ type: 'settings', service: 'x', lastExport: '2030-01-01T00:00:00.000Z' });
  const r = B.io.importText(text);
  assert.strictEqual(r.text, 'Nothing new. Kept 1 that were newer here.');
  assert.strictEqual(B.store.get(mine.id).title, 'edited here');
  assert.strictEqual(B.store.get('settings').lastExport, '2030-01-01T00:00:00.000Z');
});

test('import: a newer record in the file updates, and the report says so', () => {
  const { A, text } = twoDevices();
  const B = fresh();
  B.io.importText(text);
  const o = JSON.parse(text);
  const id = Object.keys(o.records).find((k) => o.records[k].type === 'job');
  o.records[id].title = 'newer';
  o.records[id].updated = '2099-01-01T00:00:00.000Z';
  const r = B.io.importText(JSON.stringify(o));
  assert.strictEqual(r.text, 'Updated 1');
  assert.strictEqual(B.store.get(id).title, 'newer');
  assert.strictEqual(B.store.get(id).updated, '2099-01-01T00:00:00.000Z');
});

test('import: bad input changes nothing and says why in one sentence', () => {
  const B = fresh();
  B.store.put({ type: 'job', title: 'safe' });
  const tok = B.store.undoToken();
  for (const bad of ['hello', '{"x":1}', '{"schema":"searchdesk/9","records":{}}', '{"schema":"searchdesk/1"}', '']) {
    const r = B.io.importText(bad);
    assert.strictEqual(r.ok, false, bad);
    assert.ok(r.text.length > 5);
  }
  assert.strictEqual(B.store.all().length, 1);
  assert.strictEqual(B.store.undoToken(), tok);
});

test('an AI answer goes to a registered handler, or gets a plain sentence', () => {
  const B = fresh();
  const answer = 'DESK-7Q3K\nL1 | fits';
  let r = B.io.importText(answer);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.text, 'This looks like an AI answer. Open the AI helper to use it.');
  let seen = null;
  B.pasteHandlers.push((t) => { seen = t; return { text: '1 suggestion added' }; });
  r = B.io.importText(answer);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.handled, true);
  assert.strictEqual(seen, answer);
  assert.strictEqual(r.text, '1 suggestion added');
});

test('import skips records from the made-up person', () => {
  const B = fresh();
  const r = B.io.importText(JSON.stringify({ schema: 'searchdesk/1', device: 'q', records: {
    j_1: { id: 'j_1', type: 'job', updated: '2026-01-01T00:00:00.000Z', source: 'example' } } }));
  assert.match(r.text, /^Nothing new/);
  assert.strictEqual(B.store.all().length, 0);
});

test('example data: load marks source, keeps the person\'s own profile, remove purges without tombstones', () => {
  const B = fresh();
  const D = load(['core/strings.js', 'core/store.js', 'core/merge.js', 'core/io.js'], {
    DESK_EXAMPLE: { records: [
      { type: 'profile', field: 'made up' },
      { id: 'j_ex1', type: 'job', title: 'Example job', source: 'user' },
      { type: 'job', title: 'Example job 2' }
    ] } });
  D.store.init({ now: () => Date.UTC(2026, 9, 19), device: 'd' });
  D.store.put({ type: 'profile', field: 'real' });
  const mine = D.store.put({ type: 'job', title: 'real job' });
  assert.strictEqual(D.io.exampleAvailable(), true);
  assert.strictEqual(D.io.hasExample(), false);
  assert.strictEqual(D.io.loadExample(), 2);
  assert.strictEqual(D.io.hasExample(), true);
  assert.strictEqual(D.store.get('profile').field, 'real');
  assert.strictEqual(D.store.get('j_ex1').source, 'example');
  assert.strictEqual(D.store.get('settings').exampleLoaded, true);
  assert.strictEqual(D.store.undoLabel(), 'Add the made-up person');
  assert.ok(!JSON.parse(D.io.exportText(D.store.state())).records.j_ex1);
  assert.strictEqual(D.io.removeExample(), 2);
  assert.strictEqual(D.store.all({ withDeleted: true }).filter((r) => r.source === 'example').length, 0);
  assert.strictEqual(D.store.get(mine.id).title, 'real job');
  assert.strictEqual(D.store.get('settings').exampleLoaded, undefined);
  D.store.undo();
  assert.strictEqual(D.io.hasExample(), true);
});

test('example data: an example id never overwrites a record of the person\'s own', () => {
  const D = load(['core/strings.js', 'core/store.js', 'core/merge.js', 'core/io.js'], {
    DESK_EXAMPLE: [{ id: 'j_same', type: 'job', title: 'example' }] });
  D.store.init({ now: () => Date.UTC(2026, 9, 19), device: 'd' });
  D.store.put({ id: 'j_same', type: 'job', title: 'mine' });
  assert.strictEqual(D.io.loadExample(), 0);
  assert.strictEqual(D.store.get('j_same').title, 'mine');
  assert.strictEqual(load(['core/strings.js', 'core/store.js', 'core/merge.js', 'core/io.js'], { DESK_EXAMPLE: {} }).io.exampleAvailable(), false);
});
