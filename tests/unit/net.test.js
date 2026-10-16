'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, root } = require('./_load');

const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'togather-events.json'), 'utf8'));
const API = 'https://staging.toronto.togather.foundation/api/v1/events';
const TIERS = [
  { id: 'library', name: 'At the library', query: { keywords: 'career & job search' } },
  { id: 'city', name: 'Around the city', query: {} },
];
const plain = (x) => JSON.parse(JSON.stringify(x));

// A fresh Desk with core/strings.js and core/net.js, a fake store, storage and fetch.
function world(opts) {
  opts = opts || {};
  const calls = [];
  const mem = {};
  const extras = {
    AbortController,
    DESK_LOCALE: { events: { api: 'api' in opts ? opts.api : API, tiers: TIERS } },
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } },
    fetch: (url, init) => {
      calls.push({ url, init });
      return opts.fetch ? opts.fetch(url, init) : Promise.reject(new Error('no fetch planned'));
    },
  };
  if (opts.workshop) extras.DESK_WORKSHOP = opts.workshop;
  if (opts.snapshot) extras.DESK_EVENTS_SNAPSHOT = opts.snapshot;
  const Desk = load(['core/strings.js', 'core/net.js'], extras);
  const settings = { id: 'settings', type: 'settings', liveEvents: opts.live !== false };
  Desk.store = { get: (id) => (id === 'settings' ? settings : undefined) };
  let redraws = 0;
  Desk.redraw = () => { redraws++; };
  return { Desk, calls, mem, settings, redraws: () => redraws };
}
const json = (body) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) });

test('normalise: the fixture items become the normalised shape, with no description', () => {
  const { Desk } = world();
  const out = FIX.library.items.map((i) => Desk.net.normalise(i, 'library'));
  assert.ok(out.every(Boolean));
  const first = plain(out[0]);
  assert.deepStrictEqual(Object.keys(first), ['id', 'title', 'start', 'end', 'venue', 'address', 'url', 'tier', 'tags']);
  assert.match(first.id, /^[0-9A-Z]{26}$/);
  assert.match(first.start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.strictEqual(first.start, FIX.library.items[0].startDate.slice(0, 16));
  assert.strictEqual(first.url, FIX.library.items[0]['@id'], 'the Togather page, since the list has no source link');
  assert.strictEqual(first.tier, 'library');
  assert.ok(first.tags.indexOf('career & job search') >= 0);
  assert.ok(first.address.indexOf(', ') > 0 || first.address === '');
  assert.ok(FIX.library.items[0].description.length > 20, 'the fixture does carry a description');
  assert.ok(!JSON.stringify(out).includes(FIX.library.items[0].description.slice(0, 30)), 'it is dropped');
});

test('normalise: all-day, no end, bad items', () => {
  const { Desk } = world();
  const all = FIX.city.items.map((i) => Desk.net.normalise(i, 'city'));
  const day = all.filter((e) => e && e.start.length === 10);
  assert.ok(day.length >= 1, 'an all-day event keeps a date-only start');
  assert.ok(all.some((e) => e && e.end === ''), 'a missing end is an empty string');
  const bad = FIX.city.items.filter((i) => /01TEST(NOTITLE|NOSTART|HTTP)/.test(i['@id']));
  assert.strictEqual(bad.length, 3);
  bad.forEach((i) => assert.strictEqual(Desk.net.normalise(i, 'city'), null, i['@id'] + ' is refused'));
  const odd = Desk.net.normalise(FIX.city.items.find((i) => /01TESTHOSTILE/.test(i['@id'])), 'city');
  assert.strictEqual(odd.title, 'Spaced out title');
  assert.strictEqual(odd.end, '', 'an end before the start is dropped');
  assert.deepStrictEqual(plain(odd.tags), ['free', 'resume']);
  assert.strictEqual(odd.address, '1 Main St');
  assert.strictEqual(Desk.net.normalise(null, 'x'), null);
  assert.strictEqual(Desk.net.normalise('x', 'x'), null);
});

test('normaliseAll: the first tier wins a duplicate, the result is sorted, a known source link is kept', () => {
  const { Desk } = world();
  const out = Desk.net.normaliseAll({ library: FIX.library.items, city: FIX.city.items }, TIERS, {});
  const ids = out.map((e) => e.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'each event once');
  const libIds = FIX.library.items.map((i) => i['@id'].split('/').pop());
  libIds.forEach((id) => assert.strictEqual(out.find((e) => e.id === id).tier, 'library'));
  const shared = FIX.city.items.filter((i) => libIds.indexOf(i['@id'].split('/').pop()) >= 0);
  assert.ok(shared.length >= 1, 'the fixture has an event in both feeds');
  for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].start <= out[i].start, 'sorted by start');
  const one = libIds[0];
  const keep = Desk.net.normaliseAll({ library: FIX.library.items }, TIERS, { [one]: 'https://tpl.example.org/e/1', other: 'x', });
  assert.strictEqual(keep.find((e) => e.id === one).url, 'https://tpl.example.org/e/1');
  const refuse = Desk.net.normaliseAll({ library: FIX.library.items }, TIERS, { [one]: 'http://tpl.example.org/e/1' });
  assert.ok(refuse.find((e) => e.id === one).url.startsWith('https://staging.'), 'a known link that is not https is ignored');
  assert.deepStrictEqual(plain(Desk.net.normaliseAll(null, TIERS)), []);
});

test('cleanEvent: stored events are checked', () => {
  const { Desk } = world();
  const ok = { id: 'a1', title: 'T', start: '2026-10-20T10:00', end: '', venue: 'V', address: '', url: 'https://x.org/a', tier: 'city', tags: ['a', 3] };
  assert.deepStrictEqual(plain(Desk.net.cleanEvent(ok).tags), ['a']);
  assert.strictEqual(Desk.net.cleanEvent(Object.assign({}, ok, { url: 'javascript:alert(1)' })).url, '');
  assert.strictEqual(Desk.net.cleanEvent(Object.assign({}, ok, { url: 'http://x.org/a' })).url, '');
  assert.strictEqual(Desk.net.cleanEvent(Object.assign({}, ok, { start: 'tomorrow' })), null);
  assert.strictEqual(Desk.net.cleanEvent(Object.assign({}, ok, { title: '' })), null);
  assert.strictEqual(Desk.net.cleanEvent(null), null);
});

test('get: GET only, and only the locale host', async () => {
  const w = world({ fetch: () => json({ ok: 1 }) });
  const n = w.Desk.net;
  assert.strictEqual(n.allowedHost(), 'staging.toronto.togather.foundation');
  assert.deepStrictEqual(plain(await n.get(API + '?limit=1')), { ok: 1 });
  assert.strictEqual(w.calls[0].init.method, 'GET');
  assert.strictEqual(w.calls[0].init.credentials, 'omit');
  assert.strictEqual(w.calls[0].init.redirect, 'error');
  for (const bad of ['https://evil.example.org/x', 'http://staging.toronto.togather.foundation/api', 'https://staging.toronto.togather.foundation.evil.org/x',
    'https://user@evil.org/x', 'ftp://staging.toronto.togather.foundation/', '//staging.toronto.togather.foundation/x', 'api/v1/events', '', null, 5]) {
    await assert.rejects(() => n.get(bad), /not allowed/, String(bad));
  }
  assert.strictEqual(w.calls.length, 1, 'refused addresses never reach fetch');
  const none = world({ api: null, fetch: () => json({}) });
  assert.strictEqual(none.Desk.net.allowedHost(), null);
  await assert.rejects(() => none.Desk.net.get(API), /no events address/);
  assert.strictEqual(none.calls.length, 0);
});

test('get: timeout, bad status, bad JSON', async () => {
  const slow = world({ fetch: (u, init) => new Promise((res, rej) => { init.signal.addEventListener('abort', () => rej(new Error('aborted'))); }) });
  await assert.rejects(() => slow.Desk.net.get(API, { timeout: 30 }), /too long/);
  const st = world({ fetch: () => Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('') }) });
  await assert.rejects(() => st.Desk.net.get(API), /503/);
  const bj = world({ fetch: () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html>') }) });
  await assert.rejects(() => bj.Desk.net.get(API));
});

const NOW = new Date(2026, 9, 16, 12, 0).getTime();
const SNAP = { generated: '2026-10-16T10:00:00Z', events: [{ id: 'snap1', title: 'From the snapshot', start: '2026-10-20T10:00', end: '', venue: '', address: '', url: 'https://tpl.example.org/s1', tier: 'library', tags: [] }] };

test('events: never fetches unless settings.liveEvents is true', async () => {
  const w = world({ live: false, snapshot: SNAP, fetch: () => json({ items: [] }) });
  const r = await w.Desk.net.events({ now: NOW, force: true });
  assert.strictEqual(w.calls.length, 0);
  assert.strictEqual(r.source, 'snapshot');
  assert.strictEqual(r.events.length, 1);
  assert.strictEqual(r.generated, SNAP.generated);
  w.settings.liveEvents = 'yes';
  await w.Desk.net.events({ now: NOW, force: true });
  assert.strictEqual(w.calls.length, 0, 'only true counts');
});

test('events: a workshop copy and a missing api never fetch', async () => {
  const a = world({ workshop: { liveEvents: false }, snapshot: SNAP, fetch: () => json({ items: [] }) });
  await a.Desk.net.events({ now: NOW, force: true });
  assert.strictEqual(a.calls.length, 0);
  const b = world({ api: null, snapshot: SNAP, fetch: () => json({ items: [] }) });
  const r = await b.Desk.net.events({ now: NOW, force: true });
  assert.strictEqual(b.calls.length, 0);
  assert.strictEqual(r.events[0].id, 'snap1');
  const c = world({ workshop: { banner: 'x' }, fetch: () => json({ items: FIX.library.items }) });
  await c.Desk.net.events({ now: NOW });
  assert.ok(c.calls.length > 0, 'a workshop copy that does not say liveEvents false is not blocked');
});

test('events: fetches each tier with dates, tier query and cursor; caches; redraws', async () => {
  const pages = {};
  const w = world({ snapshot: SNAP, fetch: (url) => {
    const u = new URL(url);
    const kw = u.searchParams.get('keywords');
    if (kw) { // library: two pages
      if (!u.searchParams.get('after')) return json({ items: FIX.library.items.slice(0, 2), next_cursor: 'CUR1' });
      assert.strictEqual(u.searchParams.get('after'), 'CUR1');
      return json({ items: FIX.library.items.slice(2), next_cursor: '' });
    }
    return json({ items: FIX.city.items, next_cursor: '' });
  } });
  const r = await w.Desk.net.events({ now: NOW });
  assert.strictEqual(w.calls.length, 3);
  const u0 = new URL(w.calls[0].url);
  assert.strictEqual(u0.origin + u0.pathname, API);
  assert.strictEqual(u0.searchParams.get('keywords'), 'career & job search', 'the "&" survives encoding');
  assert.strictEqual(u0.searchParams.get('startDate'), '2026-10-16');
  assert.strictEqual(u0.searchParams.get('endDate'), '2026-12-11');
  assert.strictEqual(u0.searchParams.get('limit'), '200');
  assert.strictEqual(u0.searchParams.get('context'), 'document');
  assert.ok(!new URL(w.calls[2].url).searchParams.has('keywords'));
  assert.strictEqual(r.source, 'cache');
  assert.strictEqual(r.note, '');
  assert.ok(r.events.length >= 8);
  assert.ok(r.events.every((e) => !('description' in e)));
  assert.ok(w.mem['searchdesk1:events'], 'cached under searchdesk1:events');
  assert.strictEqual(JSON.parse(w.mem['searchdesk1:events']).fetched, NOW);
  assert.strictEqual(w.redraws(), 1);
  assert.strictEqual(w.Desk.net.current().source, 'cache', 'current() now shows the cache');
});

test('events: fresh for 12 hours, then refetched; force always fetches', async () => {
  const w = world({ snapshot: SNAP, fetch: () => json({ items: FIX.library.items }) });
  await w.Desk.net.events({ now: NOW });
  const n = w.calls.length;
  assert.strictEqual(n, 2, 'one request per tier');
  await w.Desk.net.events({ now: NOW + 11 * 3600 * 1000 });
  assert.strictEqual(w.calls.length, n, 'fresh: no request');
  await w.Desk.net.events({ now: NOW + 13 * 3600 * 1000 });
  assert.strictEqual(w.calls.length, 2 * n, 'stale: fetched again');
  await w.Desk.net.events({ now: NOW + 13 * 3600 * 1000, force: true });
  assert.strictEqual(w.calls.length, 3 * n, 'force fetches');
});

test('events: a failure falls back to the cache, then the snapshot, with a note', async () => {
  let fail = false;
  const w = world({ snapshot: SNAP, fetch: () => (fail ? Promise.reject(new Error('offline')) : json({ items: FIX.library.items })) });
  fail = true;
  const first = await w.Desk.net.events({ now: NOW });
  assert.strictEqual(first.source, 'snapshot');
  assert.strictEqual(first.events[0].id, 'snap1');
  assert.match(first.note, /list that came with this app/);
  fail = false;
  const ok = await w.Desk.net.events({ now: NOW, force: true });
  assert.strictEqual(ok.source, 'cache');
  assert.strictEqual(ok.note, '');
  fail = true;
  const second = await w.Desk.net.events({ now: NOW + 20 * 3600 * 1000 });
  assert.strictEqual(second.source, 'cache', 'an old cache beats the snapshot');
  assert.match(second.note, /saved earlier/);
  assert.strictEqual(second.events.length, ok.events.length);
  fail = false;
  const empty = world({ snapshot: SNAP, fetch: () => json({ items: [] }) });
  const r = await empty.Desk.net.events({ now: NOW });
  assert.strictEqual(r.source, 'snapshot', 'an answer with no events is treated as a failure');
});

test('events: a cache from another address is ignored; a broken cache is ignored', async () => {
  const w = world({ snapshot: SNAP, live: true });
  w.mem['searchdesk1:events'] = JSON.stringify({ fetched: NOW, api: 'https://other.example.org/events', events: SNAP.events });
  assert.strictEqual(w.Desk.net.current().source, 'snapshot');
  w.mem['searchdesk1:events'] = '{not json';
  assert.strictEqual(w.Desk.net.current().source, 'snapshot');
  w.mem['searchdesk1:events'] = JSON.stringify({ fetched: NOW, api: API, events: [{ id: 'c1', title: 'Cached', start: '2026-10-21', url: 'javascript:x' }, { bad: true }] });
  const c = w.Desk.net.current();
  assert.strictEqual(c.source, 'cache');
  assert.deepStrictEqual(plain(c.events.map((e) => [e.id, e.url])), [['c1', '']]);
});

test('events: only one fetch at a time', async () => {
  const w = world({ snapshot: SNAP, fetch: () => json({ items: FIX.library.items }) });
  const [a, b] = await Promise.all([w.Desk.net.events({ now: NOW }), w.Desk.net.events({ now: NOW })]);
  assert.strictEqual(w.calls.length, 2);
  assert.strictEqual(a.events.length, b.events.length);
});

test('locale and tools/snapshot.py agree on the endpoint and tiers', () => {
  const win = {};
  win.window = win;
  vm.runInContext(fs.readFileSync(path.join(root, 'locale/toronto.js'), 'utf8'), vm.createContext(win));
  const ev = plain(win.DESK_LOCALE.events);
  assert.strictEqual(ev.api, API);
  assert.ok(/^https:\/\/[^/]+\/api\/v1\/events$/.test(ev.api));
  const py = fs.readFileSync(path.join(root, 'tools/snapshot.py'), 'utf8');
  assert.ok(py.includes('API = "' + ev.api + '"'), 'snapshot.py uses the same endpoint');
  ev.tiers.forEach((t) => {
    assert.ok(py.includes('{"id": "' + t.id + '", "keywords": "' + (t.query.keywords || '') + '"}'), 'snapshot.py has tier ' + t.id);
  });
});

test('the committed snapshot: both tiers, https links, no descriptions, sorted, unique', () => {
  const win = {};
  win.window = win;
  vm.runInContext(fs.readFileSync(path.join(root, 'data/events-snapshot.js'), 'utf8'), vm.createContext(win));
  const s = plain(win.DESK_EVENTS_SNAPSHOT);
  assert.match(s.generated, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.strictEqual(s.source, API);
  const ids = s.events.map((e) => e.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  const tiers = new Set(s.events.map((e) => e.tier));
  assert.deepStrictEqual([...tiers].sort(), ['city', 'library']);
  s.events.forEach((e) => {
    assert.deepStrictEqual(Object.keys(e), ['id', 'title', 'start', 'end', 'venue', 'address', 'url', 'tier', 'tags']);
    assert.match(e.start, /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/);
    assert.ok(e.title && e.title.length <= 200);
    assert.ok(e.url === '' || /^https:\/\/[^\s<>"']+$/.test(e.url), e.id);
    assert.ok(e.tags.length <= 6);
  });
  for (let i = 1; i < s.events.length; i++) {
    const a = s.events[i - 1], b = s.events[i];
    const ka = [a.start, a.title.toLowerCase(), a.id], kb = [b.start, b.title.toLowerCase(), b.id];
    let cmp = 0;
    for (let k = 0; k < 3 && !cmp; k++) cmp = ka[k] < kb[k] ? -1 : (ka[k] > kb[k] ? 1 : 0);
    assert.ok(cmp <= 0, 'out of order at ' + i);
  }
  const { Desk } = world({ snapshot: win.DESK_EVENTS_SNAPSHOT });
  assert.strictEqual(Desk.net.snapshot().events.length, s.events.length, 'net.js accepts every event in the snapshot');
});
