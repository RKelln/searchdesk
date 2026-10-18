'use strict';
// tools/demo-export.js prints the made-up person in the shape of a saved copy, so an agent can see that
// shape without real data (AGENTS.md, "Working with someone's data"). These checks are the point of the
// tool: what it prints must be a copy the page would actually read, and it must not leak Amira's own
// source marker, which the real writer drops.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const { load, root, gone } = require('./_load');

// Every check here runs the tool, so a copy without tools/ has nothing to run and skips rather than fails
// (see `gone` in _load.js). The tool is a development convenience: what it prints is checked again in
// io.test.js and merge.test.js against the same records, without the tool.
const why = gone('tools/demo-export.js');

function run(args) {
  const r = spawnSync('node', ['tools/demo-export.js', ...args], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  return r.stdout;
}

test('the demo export is a copy the page would read, and holds no example records', { skip: why }, () => {
  const copy = JSON.parse(run([]));
  assert.strictEqual(copy.schema, 'searchdesk/1');
  const ids = Object.keys(copy.records);
  assert.ok(ids.length >= 6, 'too few records: ' + ids.length);
  for (const id of ids) {
    const r = copy.records[id];
    assert.ok(r.id, id + ' has no id');
    assert.ok(r.type, id + ' has no type');
    assert.ok(r.updated && !isNaN(Date.parse(r.updated)), id + ' has no usable updated');
    assert.notStrictEqual(r.source, 'example', id + ' kept the marker the real export writer drops');
  }
  const D = load(['core/strings.js', 'core/store.js', 'core/merge.js', 'core/io.js']);
  const m = D.merge({ schema: 'searchdesk/1', records: {} }, copy);
  assert.strictEqual(m.error, undefined, m.error);
  assert.strictEqual(m.report.skippedBad, 0, 'the page would leave records out');
  assert.strictEqual(m.report.skippedExample, 0, 'the page would leave records out');
  assert.strictEqual(m.report.added, ids.length);
});

test('every id declared in data/example.js shows up in the demo export', { skip: why }, () => {
  const copy = JSON.parse(run([]));
  const text = require('fs').readFileSync(root + '/data/example.js', 'utf8');
  // A fixed id only: `id: 'em_' + pick.id` builds one at load time, so it is not matched.
  const ids = [...text.matchAll(/id: '([a-z0-9_-]+)'(?!\s*\+)/g)].map((m) => m[1]);
  assert.ok(ids.length >= 6, 'data/example.js looks like it has no fixed ids: ' + ids.length);
  for (const id of ids) assert.ok(copy.records[id], id + ' is in data/example.js but not in the demo export');
});

test('--ids lists every record in the export', { skip: why }, () => {
  const copy = JSON.parse(run([]));
  const lines = run(['--ids']).trim().split('\n');
  assert.strictEqual(lines.length, Object.keys(copy.records).length);
  for (const line of lines) {
    const [id, type] = line.split('\t');
    assert.ok(copy.records[id], 'no such record in the export: ' + id);
    assert.strictEqual(copy.records[id].type, type);
  }
});