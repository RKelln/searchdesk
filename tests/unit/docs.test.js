'use strict';
// The feature menus in BRIEFS.md and KITS.md are hand-written, and a hand-written list drifts: a brief lands,
// becomes a built feature, and the row stays. `board` sat in that table for days after its brief moved to
// docs/built/, offering to build something already built -- and it sat in BUILDING.md while it did, because that
// page carried a second copy of the same table.
//
// There are three person-facing pages now, one per situation: BUILDING.md for an idea of your own, BRIEFS.md for one
// of the fourteen already written up, KITS.md for the same fourteen with nothing installed. Only the last two offer
// ids, so only they are menus. BUILDING.md is checked the other way: it must offer none, because the duplicate copy
// was how `board` survived.
//
// So the check is set equality, not wording. Every brief in docs/features/ appears in both menus and both menus
// list nothing else. The wording in the tables is deliberately shorter than the briefs ("as suggestions" for a
// line that ends "as suggestions to add to `sites`"), which is why equality of the words is not checked -- only
// that the set of ids is the same, so nothing is offered that cannot be built and nothing goes unwritten.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { root } = require('./_load');

const BRIEFS = path.join(root, 'docs', 'features');
const MENUS = ['docs/BRIEFS.md', 'docs/KITS.md'];
const PAGES = ['docs/BUILDING.md'].concat(MENUS);

// The id in the first line of a brief: "# This week  (id: week, size: S)".
function briefIds() {
  return fs.readdirSync(BRIEFS)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const head = fs.readFileSync(path.join(BRIEFS, f), 'utf8').split('\n')[0];
      const m = head.match(/\bid:\s*([a-z0-9-]+)/);
      assert.ok(m, f + ' has no "id:" in its first line, so nothing can point at it');
      return m[1];
    })
    .sort();
}

// The ids in a menu table: a row that is `| `id` | In plain words |`.
function menuIds(rel) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  return [...text.matchAll(/^\|\s*`([a-z0-9-]+)`\s*\|/gm)].map((m) => m[1]).sort();
}

test('every brief has a menu row in both menus, and no menu row is a dead id', () => {
  const want = briefIds();
  assert.ok(want.length >= 10, 'docs/features/ looks nearly empty: ' + want.length + ' briefs');
  for (const rel of MENUS) {
    const got = menuIds(rel);
    const missing = want.filter((id) => !got.includes(id));
    const extra = got.filter((id) => !want.includes(id));
    assert.deepStrictEqual(missing, [], rel + ' is missing a row for: ' + missing.join(', '));
    assert.deepStrictEqual(extra, [], rel + ' offers ids with no brief: ' + extra.join(', '));
    assert.deepStrictEqual(got, want, rel + ' does not list exactly the briefs');
  }
});

test('the two menus list the same features, so the agent page and the paste page do not disagree', () => {
  const [a, b] = MENUS;
  assert.deepStrictEqual(menuIds(a), menuIds(b), a + ' and ' + b + ' list different features');
});

test('the page for an idea of your own offers no ids, because a second copy is how a stale row survived', () => {
  assert.deepStrictEqual(menuIds('docs/BUILDING.md'), [],
    'docs/BUILDING.md offers feature ids; the fourteen live in BRIEFS.md and KITS.md');
});

test('each of the three pages sends a reader to the other two, so no situation is a dead end', () => {
  for (const rel of PAGES) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    const mine = path.basename(rel);
    for (const other of PAGES.map((p) => path.basename(p)).filter((name) => name !== mine)) {
      assert.ok(text.includes(other), rel + ' never mentions ' + other + ', so a reader in that situation is stuck');
    }
  }
});

test('a kit exists for every brief, and no kit without one', () => {
  // The same drift one level down: kit.py globs docs/features/, so a kit for a brief that moved to
  // docs/built/ is left behind, and kits.test.js would then fail on kit.py's own cleanup pass rather than
  // telling anyone why. This says it first, in words.
  const kits = fs.readdirSync(path.join(root, 'docs', 'kits'))
    .filter((f) => f.endsWith('.txt'))
    .map((f) => f.slice(0, -4))
    .sort();
  assert.deepStrictEqual(kits, briefIds(), 'docs/kits/*.txt and docs/features/*.md have drifted apart');
});
