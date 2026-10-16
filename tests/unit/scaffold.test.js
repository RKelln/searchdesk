'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

test('scaffold loads and lists the base features', () => {
  const Desk = load(['core/desk.js', 'features/list.js']);
  assert.ok(Desk);
  for (const id of ['home', 'jobs', 'profile', 'events', 'help', 'recipe-events', 'recipe-posting', 'recipe-coach']) {
    assert.ok(Desk.features.includes(id), id);
  }
});
