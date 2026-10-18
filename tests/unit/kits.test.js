'use strict';
// The build kits in docs/kits must match what tools/kit.py would write now (T6.2). Skipped when python3 is
// missing, and when this copy has no tools/ to check against -- see `gone` in _load.js.
const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const { root, gone } = require('./_load');

const noPy = spawnSync('python3', ['--version']).status !== 0;
const why = noPy ? 'python3 is not installed' : gone('tools/kit.py');

test('docs/kits is up to date', { skip: why }, () => {
  const r = spawnSync('python3', ['tools/kit.py', '--check'], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});
