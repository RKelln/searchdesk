'use strict';
// docs/menu.html is made by tools/menu.py from docs/features/*.md. It must be up to date, and it must offer exactly
// the briefs there are: a page of ideas that is missing one, or offers one that is gone, sends a person to nothing.
// Skipped when python3 is missing, and when this copy has no tools/ to check against -- see `gone` in _load.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { root, gone } = require('./_load');

const noPy = spawnSync('python3', ['--version']).status !== 0;
const why = noPy ? 'python3 is not installed' : gone('tools/menu.py');

test('the menu page is up to date', { skip: why }, () => {
  const r = spawnSync('python3', ['tools/menu.py', '--check'], { cwd: root, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('the menu page offers exactly the briefs there are', { skip: why }, () => {
  const briefs = fs.readdirSync(`${root}/docs/features`).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
  const page = fs.readFileSync(`${root}/docs/menu.html`, 'utf8');
  const offered = [...page.matchAll(/Ask for it by name: <code>([a-z0-9-]+)<\/code>/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(offered, briefs);
});

test('the menu page opens from a file: no script and nothing loaded from the network', { skip: why }, () => {
  const page = fs.readFileSync(`${root}/docs/menu.html`, 'utf8');
  assert.ok(!/<script/i.test(page), 'it has a script');
  assert.ok(!/(src|href)=["']https?:/i.test(page), 'it loads or links something from the network');
});
