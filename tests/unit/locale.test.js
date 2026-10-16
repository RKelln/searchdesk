'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { root } = require('./_load');

const win = {};
win.window = win;
vm.runInContext(fs.readFileSync(path.join(root, 'locale/toronto.js'), 'utf8'), vm.createContext(win));
const L = JSON.parse(JSON.stringify(win.DESK_LOCALE));

function walk(v, fn, p) {
  if (typeof v === 'string') fn(v, p);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, fn, p + '[' + i + ']'));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => walk(v[k], fn, p + '.' + k));
}

test('locale is pure data and has an id and name', () => {
  assert.strictEqual(L.id, 'toronto');
  assert.ok(L.name);
  assert.strictEqual(JSON.stringify(L), JSON.stringify(JSON.parse(JSON.stringify(win.DESK_LOCALE))));
});

test('every URL-like string is https', () => {
  let n = 0;
  walk(L, (s, p) => {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(http|ftp)/i.test(s) && /:\/\//.test(s)) {
      n++;
      assert.ok(/^https:\/\/[^\s]+$/.test(s), p + ' is not https: ' + s);
    }
  });
  assert.ok(n > 10);
});

test('help entries have every field and a unique id', () => {
  assert.ok(L.help.length >= 6);
  const ids = new Set();
  L.help.forEach((e) => {
    ['id', 'kind', 'name', 'what', 'how', 'who', 'source'].forEach((k) => assert.ok(e[k] && typeof e[k] === 'string', e.id + '.' + k));
    assert.ok(['person', 'online'].includes(e.kind));
    assert.match(e.source, /^https:\/\//);
    assert.ok(!ids.has(e.id)); ids.add(e.id);
  });
  ['employment-ontario', '211', 'tpl-coaches', 'tpl-newcomers', 'acces', 'jvs'].forEach((id) => assert.ok(ids.has(id), id));
});

test('sites start with Job Bank; services and events are shaped', () => {
  assert.strictEqual(L.sites[0].id, 'jobbank');
  assert.match(L.sites[0].url, /^https:\/\/www\.jobbank\.gc\.ca\//);
  L.services.forEach((s) => { assert.match(s.url, /^https:\/\//); assert.strictEqual(s.prefill, null); });
  assert.ok(L.events.api === null || /^https:\/\//.test(L.events.api));
  assert.ok(L.events.tiers.length === 2);
});

test('posting rules', () => {
  assert.strictEqual(L.postingRules.replyDays, 45);
  assert.match(L.postingRules.source.url, /^https:\/\//);
  assert.deepStrictEqual(L.postingRules.checklist.map((c) => c.id), ['pay', 'ai', 'vacancy']);
});
