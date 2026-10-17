'use strict';
// The build kits in docs/kits must match what tools/kit.py would write now (T6.2). Skipped when python3 is missing.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const { root } = require('./_load');

const has = spawnSync('python3', ['--version']).status === 0;

test('docs/kits is up to date', { skip: !has && 'python3 is not installed' }, () => {
  const r = spawnSync('python3', ['tools/kit.py', '--check'], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});
