'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

const U = load(['core/desk.js']).shellUtil;
const j = (x) => JSON.parse(JSON.stringify(x));

test('validId allows a-z and hyphens only', () => {
  for (const ok of ['jobs', 'recipe-events', 'a']) assert.ok(U.validId(ok), ok);
  for (const bad of ['', 'Jobs', 'a_b', '-a', 'a-', 'a--b', 'a1', '../x', null, 3]) assert.ok(!U.validId(bad), String(bad));
});

test('sortByOrder: order, then registration; default 50; no mutation', () => {
  const list = [{ id: 'c', seq: 3 }, { id: 'b', order: 10, seq: 2 }, { id: 'a', seq: 1 }, { id: 'z', order: 'x', seq: 0 }];
  assert.deepStrictEqual(j(U.sortByOrder(list)).map((e) => e.id), ['b', 'z', 'a', 'c']);
  assert.strictEqual(list[0].id, 'c');
});

test('orderTabs: home first, core tabs last', () => {
  const tabs = [
    { id: 'data', core: true, order: 1000, seq: 1 }, { id: 'jobs', seq: 5 },
    { id: 'ai', core: true, order: 900, seq: 2 }, { id: 'home', order: 99, seq: 9 }, { id: 'help', order: 70, seq: 6 },
  ];
  assert.deepStrictEqual(j(U.orderTabs(tabs)).map((t) => t.id), ['home', 'jobs', 'help', 'ai', 'data']);
});

test('parseRoute: known, arguments, unknown, empty', () => {
  const ids = ['home', 'jobs', 'data'];
  assert.deepStrictEqual(j(U.parseRoute('#jobs', ids, 'home')), { tab: 'jobs', args: [], known: true });
  assert.deepStrictEqual(j(U.parseRoute('#/jobs/j_abc%20d', ids, 'home')), { tab: 'jobs', args: ['j_abc d'], known: true });
  assert.deepStrictEqual(j(U.parseRoute('#nope', ids, 'home')), { tab: 'home', args: [], known: false });
  assert.deepStrictEqual(j(U.parseRoute('', ids, 'home')), { tab: 'home', args: [], known: false });
  assert.strictEqual(U.parseRoute('#%E0%A4%A', ids, 'home').tab, 'home');
});
