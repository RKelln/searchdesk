'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

function fakeStorage(over) {
  const m = new Map();
  return Object.assign({
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  }, over || {});
}
function setup(storage, opts) {
  const D = load(['core/store.js', 'core/persist.js']);
  D.store.init({ device: 'dev1' });
  const timers = [];
  D.persist.init(Object.assign({
    storage, setTimer: (f) => { timers.push(f); return timers.length; }, clearTimer: (id) => { timers[id - 1] = null; },
  }, opts));
  return { D, timers, run: () => timers.splice(0).forEach((f) => f && f()) };
}
const LINE = 'This browser is not saving. Save a copy before you close it.';

test('saves under searchdesk1:state, debounced to one write', () => {
  const st = fakeStorage();
  let writes = 0;
  const orig = st.setItem; st.setItem = (k, v) => { if (k === 'searchdesk1:state') writes++; orig(k, v); };
  const { D, timers, run } = setup(st);
  D.store.put({ type: 'job', title: 'A' });
  D.store.put({ type: 'job', title: 'B' });
  assert.strictEqual(timers.length, 1);
  assert.strictEqual(writes, 0);
  run();
  assert.strictEqual(writes, 1);
  const saved = JSON.parse(st.m.get('searchdesk1:state'));
  assert.strictEqual(saved.schema, 'searchdesk/1');
  assert.strictEqual(Object.keys(saved.records).length, 2);
  assert.strictEqual(D.persist.status(), 'ok');
  assert.strictEqual(D.persist.message(), '');
});

test('flush saves now and cancels the timer; last undo step is saved too', () => {
  const st = fakeStorage();
  const { D, timers } = setup(st);
  D.store.put({ type: 'job' });
  assert.strictEqual(D.persist.flush(), true);
  assert.strictEqual(timers[0], null);
  assert.ok(JSON.parse(st.m.get('searchdesk1:undo')).before);
});

test('load round-trips state and the undo step', () => {
  const st = fakeStorage();
  const a = setup(st);
  const j = a.D.store.put({ type: 'job', title: 'A' });
  a.D.persist.flush();
  const b = setup(st);
  assert.strictEqual(b.D.persist.load(), 'loaded');
  assert.strictEqual(b.D.store.get(j.id).title, 'A');
  assert.strictEqual(b.D.store.undo(), 'Save');
  assert.strictEqual(b.D.store.get(j.id), undefined);
});

test('empty storage and corrupt data', () => {
  const st = fakeStorage();
  const a = setup(st);
  assert.strictEqual(a.D.persist.load(), 'empty');
  st.m.set('searchdesk1:state', '{not json');
  const b = setup(st);
  assert.strictEqual(b.D.persist.load(), 'corrupt');
  assert.strictEqual(st.m.get('searchdesk1:state'), '{not json'); // not overwritten by load
  assert.strictEqual([...st.m.keys()].filter((k) => k.startsWith('searchdesk1:corrupt:')).map((k) => st.m.get(k))[0], '{not json');
  st.m.set('searchdesk1:state', JSON.stringify({ schema: 'nope' }));
  assert.strictEqual(setup(st).D.persist.load(), 'corrupt');
});

test('setItem throws (quota): memory mode, app keeps working, line shown', () => {
  const st = fakeStorage({ setItem: () => { throw new Error('QuotaExceededError'); } });
  const { D, run } = setup(st);
  assert.strictEqual(D.persist.status(), 'memory'); // the probe fails
  assert.strictEqual(D.persist.message(), LINE);
  const j = D.store.put({ type: 'job', title: 'A' });
  run();
  assert.strictEqual(D.persist.flush(), false);
  assert.strictEqual(D.store.get(j.id).title, 'A');
});

test('access throws, getItem throws, and storage missing', () => {
  const blocked = { get getItem() { throw new Error('SecurityError'); }, get setItem() { throw new Error('SecurityError'); } };
  let r = setup(blocked);
  assert.strictEqual(r.D.persist.status(), 'memory');
  assert.strictEqual(r.D.persist.load(), 'memory');
  r.D.store.put({ type: 'job' });
  assert.doesNotThrow(() => { r.run(); r.D.persist.flush(); });

  r = setup(fakeStorage({ getItem: () => { throw new Error('x'); } }));
  assert.strictEqual(r.D.persist.load(), 'memory');
  assert.strictEqual(r.D.persist.message(), LINE);

  r = setup(null);
  assert.strictEqual(r.D.persist.status(), 'memory');
  assert.strictEqual(r.D.persist.load(), 'memory');
  assert.strictEqual(r.D.persist.flush(), false);
});

test('window.localStorage getter that throws is survived by default', () => {
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const win = { console, setTimeout, clearTimeout, crypto: require('crypto').webcrypto };
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('denied'); } });
  win.window = win;
  const ctx = vm.createContext(win);
  for (const f of ['core/store.js', 'core/persist.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8'), ctx);
  assert.strictEqual(win.Desk.persist.status(), 'memory');
  assert.strictEqual(win.Desk.persist.load(), 'memory');
});

test('status listeners fire when a later save fails, and recover when it works', () => {
  let fail = false;
  const st = fakeStorage();
  const orig = st.setItem; st.setItem = (k, v) => { if (fail) throw new Error('full'); orig(k, v); };
  const { D } = setup(st);
  const seen = [];
  D.persist.onStatus((s) => seen.push(s));
  D.store.put({ type: 'job' });
  fail = true; D.persist.flush();
  fail = false; D.persist.flush();
  assert.strictEqual(seen.join(), 'memory,ok');
});

test('message uses Desk.t(notSaving) when the strings table has it', () => {
  const { D } = setup(fakeStorage({ setItem: () => { throw new Error('q'); } }));
  D.strings = { notSaving: 'x' }; D.t = () => 'from table';
  assert.strictEqual(D.persist.message(), 'from table');
});

test('regression: corrupt state is not overwritten by pagehide flush before an edit', () => {
  const st = fakeStorage();
  st.m.set('searchdesk1:state', '{bad');
  const { D } = setup(st);
  assert.strictEqual(D.persist.load(), 'corrupt');
  assert.strictEqual(D.persist.flush(), false);
  assert.strictEqual(st.m.get('searchdesk1:state'), '{bad');
  D.store.put({ type: 'job' }); // an edit; the backup exists, so saving resumes
  assert.strictEqual(D.persist.flush(), true);
  assert.notStrictEqual(st.m.get('searchdesk1:state'), '{bad');
});

test('regression: failed backup blocks writes to the state key, status is memory', () => {
  const st = fakeStorage();
  st.m.set('searchdesk1:state', '{bad');
  const orig = st.setItem;
  st.setItem = (k, v) => { if (k.startsWith('searchdesk1:corrupt')) throw new Error('full'); orig(k, v); };
  const { D, run } = setup(st);
  assert.strictEqual(D.persist.load(), 'corrupt');
  assert.strictEqual(D.persist.status(), 'memory');
  D.store.put({ type: 'job' });
  run();
  assert.strictEqual(D.persist.flush(), false);
  assert.strictEqual(st.m.get('searchdesk1:state'), '{bad');
  assert.strictEqual(D.persist.message(), LINE);
});

test('regression: a second corruption does not erase the first backup', () => {
  const st = fakeStorage();
  st.m.set('searchdesk1:state', '{bad1');
  setup(st).D.persist.load();
  st.m.set('searchdesk1:state', '{bad2');
  setup(st).D.persist.load();
  const vals = [...st.m.keys()].filter((k) => k.startsWith('searchdesk1:corrupt:')).map((k) => st.m.get(k)).sort();
  assert.strictEqual(vals.join(), '{bad1,{bad2');
});

test('regression: stale or malformed persisted undo step is ignored', () => {
  const st = fakeStorage();
  const a = setup(st);
  const j = a.D.store.put({ type: 'job', title: 'A' });
  a.D.persist.flush();
  // another tab changes the record
  const saved = JSON.parse(st.m.get('searchdesk1:state'));
  saved.records[j.id].updated = '2030-01-01T00:00:00.000Z';
  st.m.set('searchdesk1:state', JSON.stringify(saved));
  const b = setup(st);
  assert.strictEqual(b.D.persist.load(), 'loaded');
  assert.strictEqual(b.D.store.canUndo(), false);
  st.m.set('searchdesk1:undo', JSON.stringify({ before: { evil: 'str' }, after: { evil: null } }));
  const c = setup(st);
  c.D.persist.load();
  assert.strictEqual(c.D.store.canUndo(), false);
  assert.strictEqual(c.D.store.all().every((r) => typeof r === 'object'), true);
});

test('regression: failed undo-key write keeps memory status', () => {
  const st = fakeStorage();
  const orig = st.setItem; st.setItem = (k, v) => { if (k === 'searchdesk1:undo') throw new Error('full'); orig(k, v); };
  const { D } = setup(st);
  const seen = [];
  D.persist.onStatus((x) => seen.push(x));
  D.store.put({ type: 'job' });
  D.persist.flush();
  assert.strictEqual(D.persist.status(), 'memory');
  assert.strictEqual(seen.join(), 'memory');
});

test('regression: init notifies listeners when status changes', () => {
  const D = load(['core/store.js', 'core/persist.js']);
  const seen = [];
  D.persist.onStatus((x) => seen.push(x));
  D.persist.init({ storage: fakeStorage() });
  D.persist.init({ storage: null });
  D.persist.init({ storage: fakeStorage() });
  assert.strictEqual(seen.join(), 'ok,memory,ok');
});

test('regression: visibilitychange to hidden flushes', () => {
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const handlers = {};
  const st = fakeStorage();
  const win = { console, setTimeout, clearTimeout, crypto: require('crypto').webcrypto, localStorage: st,
    document: { visibilityState: 'visible', addEventListener: (n, f) => { handlers[n] = f; } } };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const f of ['core/store.js', 'core/persist.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8'), ctx);
  win.Desk.store.put({ type: 'job' });
  assert.strictEqual(st.m.has('searchdesk1:state'), false);
  win.document.visibilityState = 'hidden';
  handlers.visibilitychange();
  assert.strictEqual(st.m.has('searchdesk1:state'), true);
});
