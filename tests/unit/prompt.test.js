'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, root } = require('./_load');

const Desk = load(['core/prompt.js']);
const lines = (p) => JSON.parse(JSON.stringify(Desk.prompt.profileLines(p)));

test('profileLines: empty or missing profile gives no lines', () => {
  assert.deepStrictEqual(lines(undefined), []);
  assert.deepStrictEqual(lines(null), []);
  assert.deepStrictEqual(lines({}), []);
});

test('profileLines: format and fixed order', () => {
  const p = { replyLanguage: 'English', roles: 'Office administration', field: 'Finance', area: 'East end', languages: 'English, Tamil' };
  assert.deepStrictEqual(lines(p), [
    'What work: Office administration', 'Field: Finance', 'Area: East end', 'Languages: English, Tamil', 'Reply language: English',
  ]);
});

test('profileLines: default share leaves out background, availability and avoid', () => {
  const p = { roles: 'a', background: 'b', availability: 'c', avoid: 'd' };
  assert.deepStrictEqual(lines(p), ['What work: a']);
});

test('profileLines: a switch turned on adds the field, off removes it, missing keys use defaults', () => {
  const p = { roles: 'a', field: 'f', avoid: 'night work', share: { avoid: true, roles: false } };
  assert.deepStrictEqual(lines(p), ['Field: f', 'Avoid: night work']);
});

test('profileLines: empty and blank values are skipped; breaks become spaces', () => {
  const p = { roles: '   ', field: '', area: 7, background: 'one\n  two', share: { background: true } };
  assert.deepStrictEqual(lines(p), ['Background: one two']);
});

test('profileLines: never includes fields outside the list', () => {
  const p = { roles: 'a', name: 'Sam', email: 'x@y.z', phone: '1', share: { name: true, email: true, phone: true }, id: 'profile', type: 'profile' };
  assert.deepStrictEqual(lines(p), ['What work: a']);
});

test('profileLines: does not change its input', () => {
  const p = { roles: 'a', share: { roles: true } };
  const copy = JSON.stringify(p);
  Desk.prompt.profileLines(p);
  assert.strictEqual(JSON.stringify(p), copy);
});

test('the profile feature lists the same fields and defaults as core/prompt.js', () => {
  const win = { Desk: { register(d) { win.def = d; } } };
  win.window = win;
  vm.runInContext(fs.readFileSync(path.join(root, 'features/profile.js'), 'utf8'), vm.createContext(win));
  const mine = JSON.parse(JSON.stringify(win.def.logic.fields.map((f) => [f.key, f.share])));
  const core = JSON.parse(JSON.stringify(Desk.prompt.profileFields.map((f) => [f.key, f.share])));
  assert.deepStrictEqual(mine, core);
});

// ---- T3.1: codes, aliases, templates, envelope --------------------------------------------------------------------
const P = Desk.prompt;
const json = (x) => JSON.parse(JSON.stringify(x));
const seq = (bytes) => { let i = 0; return (n) => { const out = []; for (let k = 0; k < n; k++) out.push(bytes[i++ % bytes.length]); return out; }; };

// DESIGN 9.6 template, copied here as a fixture (recipes own the real one).
const EVENTS_TEMPLATE = `Pick the events most likely to help this person meet people in their line of work,
or learn something useful for finding work.
About the person:
{profile}
Up to {quotaL} from the library list and up to {quotaC} from the city list. A short list is better than a padded one.
For each, say the concrete connection to their situation.
{items}`;
const EVENTS = {
  id: 'events', template: EVENTS_TEMPLATE,
  answer: { L: ['why'], C: ['why'], NEW: ['title', 'url', 'why'] },
  example: 'L1 | why this one fits, in one sentence',
};
const PROFILE = { roles: 'Office administration', field: 'Finance', area: 'Scarborough, TTC', languages: 'English, Tamil', replyLanguage: 'English' };
const HEADER = 'alias | date | title | venue';
function eventData(nl, nc) {
  const L = [], C = [];
  for (let i = 0; i < nl; i++) L.push({ id: 'e_l' + i, cols: ['2026-10-' + String(20 + (i % 9)).padStart(2, '0') + ' 18:30', 'Job search drop-in and resume help ' + i, 'Toronto Public Library, Agincourt Branch'] });
  for (let i = 0; i < nc; i++) C.push({ id: 'e_c' + i, cols: ['2026-10-' + String(20 + (i % 9)).padStart(2, '0') + ' 19:00', 'Networking evening for finance and admin staff ' + i, 'Metro Toronto Convention Centre'] });
  return { profile: P.profileLines(PROFILE), quotaL: 4, quotaC: 4, replyLanguage: 'English', items: { header: HEADER, kinds: { L: L, C: C } } };
}

test('code: 4 characters from the safe alphabet, from injected randomness', () => {
  assert.strictEqual(P.code(seq([0, 1, 2, 3])), '2345');
  assert.strictEqual(P.code(seq([29, 30, 31, 32])), 'Z234'); // 30 wraps to the first character
  const c = P.code();
  assert.match(c, /^[2-9A-HJKMNP-TV-Z]{4}$/);
  assert.ok(!/[01ILOU]/.test(P.CODE_CHARS));
});

test('code: skips high bytes (no bias) and codes already taken', () => {
  assert.strictEqual(P.code(seq([250, 255, 0, 1, 2, 3])), '2345');
  assert.strictEqual(P.code(seq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), ['desk-2345']), 'ABCD');
});

test('normalizeCode: accepts the pasted forms, refuses others', () => {
  assert.strictEqual(P.normalizeCode('DESK-7Q3K'), '7Q3K');
  assert.strictEqual(P.normalizeCode(' desk 7q3k '), '7Q3K');
  assert.strictEqual(P.normalizeCode('7q3k'), '7Q3K');
  assert.strictEqual(P.normalizeCode('DESK-0123'), '');
  assert.strictEqual(P.normalizeCode('DESK-7Q3'), '');
  assert.strictEqual(P.normalizeCode(null), '');
});

test('aliases: numbers run across letters, are stable and unique', () => {
  const rows = [{ kind: 'L', id: 'a' }, { kind: 'L', id: 'b' }, { kind: 'C', id: 'c' }, { kind: 'L', id: 'd' }];
  const names = (r) => P.assignAliases(r).map((a) => a.alias);
  assert.deepStrictEqual(names(rows), ['L1', 'L2', 'C3', 'L4']);
  assert.deepStrictEqual(names(rows), names(rows));
  const big = P.assignAliases(eventData(20, 20).items.kinds.L.map((r) => Object.assign({ kind: 'L' }, r)).concat(eventData(20, 20).items.kinds.C.map((r) => Object.assign({ kind: 'C' }, r))));
  assert.strictEqual(big[19].alias, 'L20');
  assert.strictEqual(big[20].alias, 'C21');
  assert.strictEqual(new Set(big.map((a) => a.n)).size, 40);
  assert.deepStrictEqual(json(P.assignAliases([])), []);
});

test('fill: {name} only, unknown stays visible, one pass, arrays join with line breaks', () => {
  assert.strictEqual(P.fill('Hi {a} {b} {c}', { a: 'x', c: ['1', '2'] }), 'Hi x {b} 1\n2');
  assert.strictEqual(P.fill('{a}', { a: '{b}', b: 'no' }), '{b}');
  assert.strictEqual(P.fill('{a} {toString} {}', {}), '{a} {toString} {}');
  assert.strictEqual(P.fill('{a}', { a: '' }), '');
});

test('missingPlaceholders: names the template uses that have no value; absentPlaceholders is the reverse', () => {
  const t = 'Do {task} for {profile} and {oops}. {profile}';
  assert.deepStrictEqual(json(P.missingPlaceholders(t, ['task', 'profile'])), ['oops']);
  assert.deepStrictEqual(json(P.missingPlaceholders(t, { task: 1, profile: 2, oops: 3 })), []);
  assert.deepStrictEqual(json(P.absentPlaceholders(t, ['task', 'profile', 'items'])), ['items']);
  assert.deepStrictEqual(json(P.placeholders(t)), ['task', 'profile', 'oops']);
});

test('build: an unknown placeholder stays visible and is reported', () => {
  const r = P.build({ id: 'x', template: 'Hello {name}. {nope}\n{items}', answer: null }, { name: 'there' }, { code: '7Q3K', now: 0 });
  assert.ok(r.text.includes('Hello there. {nope}'));
  assert.deepStrictEqual(json(r.missing), ['nope']);
});

test('itemsTable: header, pipes and breaks cleaned, title cut at 80', () => {
  const long = 'T'.repeat(100);
  const rows = P.assignAliases([{ kind: 'L', id: 'a', cols: ['2026-10-21', long, 'A | B\nC'] }]);
  const lines = P.itemsTable(rows, HEADER).split('\n');
  assert.strictEqual(lines[0], HEADER);
  const cols = lines[1].split(' | ');
  assert.strictEqual(cols.length, 4);
  assert.strictEqual(cols[2].length, 80);
  assert.ok(cols[2].endsWith('…'));
  assert.strictEqual(cols[3], 'A / B C');
});

test('howToAnswer: code, example, extra kinds, reply language; none for no answer', () => {
  const h = P.howToAnswer(EVENTS, { code: '7Q3K', replyLanguage: 'Tamil', aliased: ['L', 'C'] });
  assert.strictEqual(h, [
    'HOW TO ANSWER', 'Put your whole answer inside one code block.', 'First line: DESK-7Q3K',
    'Then one line for each pick, like this:', 'L1 | why this one fits, in one sentence',
    'You may also use:', 'C<n> | why', 'NEW | title | url | why', 'Write the reasons in Tamil.',
  ].join('\n'));
  assert.strictEqual(P.howToAnswer({ answer: null }, { code: '7Q3K' }), '');
  assert.ok(P.howToAnswer({ answer: 'text' }, { code: '7Q3K' }).includes('Then your answer as plain text.'));
});

test('build: items are appended when the template has no {items}', () => {
  const r = P.build({ id: 'x', template: 'Pick some.', answer: { L: ['why'] }, example: 'L1 | because' },
    { items: { header: 'alias | title', kinds: { L: [{ id: 'a', cols: ['One'] }] } } }, { code: '7Q3K', now: 0 });
  assert.ok(r.text.includes('Pick some.\n\nalias | title\nL1 | One\n\nHOW TO ANSWER'));
});

test('build: same input gives the same text; record maps aliases to ids', () => {
  const a = P.build(EVENTS, eventData(3, 2), { code: '7Q3K', now: 1e12 });
  const b = P.build(EVENTS, eventData(3, 2), { code: '7Q3K', now: 1e12 });
  assert.strictEqual(a.text, b.text);
  assert.deepStrictEqual(json(a.aliases), { L1: 'e_l0', L2: 'e_l1', L3: 'e_l2', C4: 'e_c0', C5: 'e_c1' });
  assert.deepStrictEqual(json(a.record), { type: 'prompt', recipe: 'events', code: '7Q3K', aliases: json(a.aliases), created: '2001-09-09T01:46:40.000Z', source: 'user' });
  assert.ok(P.build(EVENTS, eventData(1, 1), { random: seq([0, 1, 2, 3]), now: 0 }).text.startsWith('[A question from Search Desk, a job-search page. Code: DESK-2345]'));
});

test('build: a recipe edit (opts.template) replaces the template but not HOW TO ANSWER', () => {
  const r = P.build(EVENTS, eventData(1, 0), { code: '7Q3K', now: 0, template: 'Just pick one. {items}' });
  assert.ok(r.text.includes('Just pick one. alias | date'));
  assert.ok(r.text.includes('HOW TO ANSWER'));
});

test('an example events question is under 6,000 characters (20 L + 20 C)', () => {
  const r = P.build(EVENTS, eventData(20, 20), { code: '7Q3K', now: 0 });
  assert.ok(r.size < 6000, 'size ' + r.size);
  assert.strictEqual(r.truncated, false, 'dropped ' + r.dropped + ' size ' + r.size);
  assert.strictEqual(Object.keys(r.aliases).length, 40);
});

test('budget: over-long questions lose rows from the longest list, keep numbering gap-free, never cut the instructions', () => {
  const d = eventData(40, 40);
  d.items.kinds.L.forEach((row) => { row.cols[2] = 'V'.repeat(300); });
  const r = P.build(EVENTS, d, { code: '7Q3K', now: 0 });
  assert.ok(r.size <= 6000, 'size ' + r.size);
  assert.strictEqual(r.truncated, true);
  assert.ok(r.dropped > 0);
  const n = Object.keys(r.aliases).length;
  assert.strictEqual(n, 80 - r.dropped);
  assert.deepStrictEqual(Object.keys(r.aliases).map((a) => +a.slice(1)).sort((x, y) => x - y), Array.from({ length: n }, (_, i) => i + 1));
  assert.ok(r.text.includes('HOW TO ANSWER') && r.text.includes('Up to 4 from the library list'));
  // a recipe may lift the budget
  assert.strictEqual(P.build(EVENTS, d, { code: '7Q3K', now: 0, budget: 0 }).truncated, false);
});

test('envelope matches the golden file (UPDATE_GOLDEN=1 rewrites it)', () => {
  const r = P.build(EVENTS, {
    profile: P.profileLines(PROFILE), quotaL: 4, quotaC: 4, replyLanguage: 'English',
    items: { header: HEADER, kinds: {
      L: [
        { id: 'e1', cols: ['2026-10-21 18:30', 'Resume clinic', 'Agincourt Library'] },
        { id: 'e2', cols: ['2026-10-23 14:00', 'Intro to bookkeeping software | free', 'Albion Library'] },
        { id: 'e3', cols: ['2026-10-27 11:00', 'Job search basics', 'Malvern Library'] },
      ],
      C: [
        { id: 'e4', cols: ['2026-10-22 19:00', 'Finance and admin professionals mixer', 'Metro Hall'] },
        { id: 'e5', cols: ['2026-10-28 18:00', 'Newcomer career fair', 'Scarborough Civic Centre'] },
      ],
    } },
  }, { code: '7Q3K', now: Date.UTC(2026, 9, 16) });
  const file = path.join(root, 'tests/unit/golden/events-envelope.txt');
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(file, r.text);
  assert.strictEqual(r.text, fs.readFileSync(file, 'utf8'));
});

test('remember: saves a prompt record and keeps the newest 30', () => {
  const D = load(['core/store.js', 'core/prompt.js'].filter((f) => fs.existsSync(path.join(root, f))));
  let t = Date.UTC(2026, 9, 16);
  D.store.init({ app: 'test', now: () => t, random: (n) => Array.from({ length: n }, (_, i) => i) });
  const codes = [];
  for (let i = 0; i < 33; i++) {
    t += 60000;
    const code = D.prompt.code(seq([i, 1, 2, 3 + (i % 7), 0, 0, 0, 0]), codes);
    codes.push(code);
    const b = D.prompt.build(EVENTS, eventData(1, 1), { code, now: t });
    D.prompt.remember(b.record);
  }
  const kept = D.store.all('prompt');
  assert.strictEqual(kept.length, 30);
  assert.ok(kept.every((r) => r.id === 'p_' + r.code.toLowerCase() && r.aliases.L1 === 'e_l0'));
  assert.ok(!kept.some((r) => r.code === codes[0]) && kept.some((r) => r.code === codes[32]));
});
