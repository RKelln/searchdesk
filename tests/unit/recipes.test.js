'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

const Desk = load(['core/strings.js', 'core/store.js', 'core/prompt.js', 'core/reply.js', 'core/recipes.js']);
const R = Desk.recipes;
const j = (x) => JSON.parse(JSON.stringify(x));
const NOW = Date.parse('2026-10-16T15:00:00Z');
Desk.now = () => new Date(NOW);

const def = {
  id: 'events', title: 'Find events', kind: 'event',
  template: 'Pick events for:\n{profile}\n{items}',
  answer: { L: ['why'], C: ['why'], NEW: ['title', 'url', 'why'] },
  example: 'L1 | why this one fits, in one sentence',
  quota: { L: 4, C: 4, NEW: 2 },
  data: () => ({ items: { header: 'alias | title', kinds: { L: [{ id: 'ev_a', cols: ['Resume Help'] }, { id: 'ev_b', cols: ['Mock Interviews'] }], C: [{ id: 'ev_c', cols: ['Job Fair'] }] } } }),
};
R.register(def);

function fresh() {
  Desk.store.init({ now: () => NOW, device: 'dtest' });
  const built = R.buildQuestion(def, {}, '7Q3K');
  R.remember(def, built);
  return built;
}

test('hash is stable and 8 hex characters', () => {
  assert.strictEqual(R.hash('a'), R.hash('a'));
  assert.notStrictEqual(R.hash('a'), R.hash('b'));
  assert.match(R.hash('Job Fair|https://x.ca/'), /^[0-9a-f]{8}$/);
});

test('suggestionId: alias lines use the alias, NEW lines hash title and link', () => {
  assert.strictEqual(R.suggestionId('DESK-7Q3K', { alias: 'L3' }), 's_7q3k_l3');
  const a = R.suggestionId('7Q3K', { target: { title: 'Open House', url: 'https://x.ca/a' } });
  const b = R.suggestionId('7Q3K', { target: { title: ' open  house ', url: 'HTTPS://X.CA/A' } });
  const c = R.suggestionId('7Q3K', { target: { title: 'Open House', url: 'https://x.ca/b' } });
  assert.match(a, /^s_7q3k_[0-9a-f]{8}$/);
  assert.strictEqual(a, b, 'case and spacing do not change the id');
  assert.notStrictEqual(a, c);
  assert.strictEqual(R.suggestionId('7Q3K', { key: 'k1' }), R.suggestionId('7Q3K', { key: 'k1', target: 5 }));
});

test('suggestionRecord fills the standard fields', () => {
  const r = j(R.suggestionRecord(def, 'DESK-7Q3K', { alias: 'L1', target: 'ev_a', why: 'fits' }));
  assert.deepStrictEqual(r, { alias: 'L1', target: 'ev_a', why: 'fits', type: 'suggestion', id: 's_7q3k_l1', recipe: 'events',
    code: '7Q3K', kind: 'event', status: 'new', source: 'ai' });
});

test('normaliseApply and splitNew', () => {
  assert.deepStrictEqual(j(R.normaliseApply([{ a: 1 }])), { suggestions: [{ a: 1 }], records: [], text: '', render: null });
  assert.deepStrictEqual(j(R.normaliseApply(undefined)), { suggestions: [], records: [], text: '', render: null });
  const sp = R.splitNew([{ id: 'a' }, { id: 'b' }, { id: 'a' }], (id) => id === 'b');
  assert.deepStrictEqual(j(sp), { fresh: [{ id: 'a' }], existing: [{ id: 'b' }] });
});

test('resultSentence', () => {
  assert.strictEqual(R.resultSentence({ fresh: 6, existing: 0 }), '6 suggestions added.');
  assert.strictEqual(R.resultSentence({ fresh: 1, existing: 0 }), '1 suggestion added.');
  assert.strictEqual(R.resultSentence({ fresh: 6, existing: 0, where: 'Events' }), '6 suggestions added to Events.');
  assert.strictEqual(R.resultSentence({ fresh: 0, existing: 3 }), 'Already added. Nothing new.');
  assert.strictEqual(R.resultSentence({ fresh: 2, existing: 3 }), '2 added. 3 were already here.');
  assert.strictEqual(R.resultSentence({ fresh: 0, existing: 0, text: 'Custom.' }), 'Custom.');
});

test('fixItMessage lists the bad lines, the reasons, the code and the format', () => {
  const msg = R.fixItMessage(def, 'DESK-7Q3K', [
    { line: 'L9 | nope', reason: 'L9 is not one of the items in the question.', code: 'unknown-alias' },
    { line: 'NEW | Fair', reason: 'A line is missing its url.', code: 'missing-field' },
  ], { replyLanguage: 'English' });
  assert.match(msg, /Code: DESK-7Q3K/);
  assert.match(msg, /1\. "L9 \| nope" - L9 is not one of the items in the question\./);
  assert.match(msg, /2\. "NEW \| Fair" - A line is missing its url\./);
  assert.match(msg, /ONLY the lines listed here/);
  assert.match(msg, /First line: DESK-7Q3K/);
  assert.match(msg, /L1 \| why this one fits/);
  assert.match(msg, /Write the reasons in English\./);
});

test('fixItMessage keeps long lists short', () => {
  const rej = Array.from({ length: 14 }, (_, i) => ({ line: 'x' + i, reason: 'r' }));
  const msg = R.fixItMessage(def, '7Q3K', rej);
  assert.match(msg, /10\. "x9"/);
  assert.doesNotMatch(msg, /11\. /);
  assert.match(msg, /\(and 4 more\)/);
});

test('pendingPrompt: newest unanswered within 7 days', () => {
  const day = 86400000;
  const iso = (ms) => new Date(NOW - ms).toISOString();
  const ps = [
    { id: 'p_a', code: 'AAAA', recipe: 'events', created: iso(2 * day) },
    { id: 'p_b', code: 'BBBB', recipe: 'events', created: iso(1 * day), answeredAt: iso(0) },
    { id: 'p_c', code: 'CCCC', recipe: 'events', created: iso(8 * day) },
  ];
  assert.strictEqual(R.pendingPrompt(ps, NOW).code, 'AAAA');
  assert.strictEqual(R.pendingPrompt(ps, NOW, ['coach']), null, 'a task that is not installed is not waiting');
  assert.strictEqual(R.pendingPrompt([], NOW), null);
});

test('parseContext carries the recipe settings to the parser', () => {
  const c = R.parseContext(def, [], { x: 'T' }, '2026-10-16');
  assert.deepStrictEqual(j(c.quota), { L: 4, C: 4, NEW: 2 });
  assert.strictEqual(c.example, def.example);
  assert.strictEqual(c.now, '2026-10-16');
  assert.strictEqual(c.recipe, 'events');
});

test('process: saves one batch, marks the question answered, and Undo undoes both', () => {
  fresh();
  const text = '```\nDESK-7Q3K\nL1 | fits you well\nC3 | employers hire\n```';
  const res = R.process(text);
  assert.strictEqual(res.kind, 'saved');
  assert.strictEqual(res.text, '2 suggestions added.');
  const sug = Desk.store.all('suggestion');
  assert.deepStrictEqual(j(sug.map((s) => s.id).sort()), ['s_7q3k_c3', 's_7q3k_l1']);
  assert.strictEqual(sug.find((s) => s.alias === 'L1').target, 'ev_a');
  assert.strictEqual(sug[0].status, 'new');
  assert.ok(Desk.store.get('p_7q3k').answeredAt, 'prompt marked answered');
  assert.strictEqual(res.token, Desk.store.undoToken());
  Desk.store.undo();
  assert.strictEqual(Desk.store.all('suggestion').length, 0);
  assert.ok(!Desk.store.get('p_7q3k').answeredAt, 'undo makes the question wait again');
});

test('process: the same answer twice says Already added and changes nothing', () => {
  fresh();
  const text = 'DESK-7Q3K\nL1 | a\nL2 | b';
  R.process(text);
  const before = JSON.stringify(Desk.store.state().records);
  const tok = Desk.store.undoToken();
  const again = R.process(text);
  assert.strictEqual(again.kind, 'already');
  assert.strictEqual(again.text, 'Already added. Nothing new.');
  assert.strictEqual(again.token, null);
  assert.strictEqual(Desk.store.undoToken(), tok, 'no new undo step');
  assert.strictEqual(JSON.stringify(Desk.store.state().records), before);
});

test('process: a fix-it answer adds only the missing lines', () => {
  fresh();
  const first = R.process('DESK-7Q3K\nL1 | a\nL9 | bad');
  assert.strictEqual(first.added, 1);
  assert.strictEqual(first.rejected.length, 1);
  assert.strictEqual(first.problem, '1 line could not be read.');
  const second = R.process('DESK-7Q3K\nL1 | a\nL2 | b');
  assert.strictEqual(second.added, 1);
  assert.strictEqual(second.existing, 1);
  assert.strictEqual(second.text, '1 added. 1 were already here.');
  assert.strictEqual(Desk.store.all('suggestion').length, 2);
});

test('process: all lines bad saves nothing and does not mark the question answered', () => {
  fresh();
  const res = R.process('DESK-7Q3K\nL9 | nope');
  assert.strictEqual(res.added, 0);
  assert.strictEqual(res.rejected.length, 1);
  assert.strictEqual(Desk.store.all('suggestion').length, 0);
  assert.ok(!Desk.store.get('p_7q3k').answeredAt);
});

test('process: missing code uses the last question and says so', () => {
  fresh();
  const res = R.process('L1 | a');
  assert.strictEqual(res.added, 1);
  assert.deepStrictEqual(j(res.notes), ['No code found; used your last question.']);
  assert.strictEqual(res.code, '7Q3K');
});

test('process: unknown code, no question, the question pasted back, a backup', () => {
  Desk.store.init({ now: () => NOW });
  assert.strictEqual(R.process('DESK-7Q3K\nL1 | a').kind, 'none');
  const built = fresh();
  const unknown = R.process('DESK-ZZZZ\nL1 | a');
  assert.strictEqual(unknown.kind, 'unknown');
  assert.match(unknown.text, /another device/);
  assert.strictEqual(Desk.store.all('suggestion').length, 0);
  assert.strictEqual(R.process(built.text).kind, 'question');
  assert.strictEqual(R.process('just some words').kind, 'nothing');
});

test('process: a recipe that is not installed', () => {
  fresh();
  Desk.store.put({ type: 'prompt', id: 'p_gone', recipe: 'gone', code: 'GONE', aliases: {}, created: '2026-10-16T16:00:00Z' });
  assert.strictEqual(R.process('DESK-GONE\nL1 | a').kind, 'norecipe');
});

test('process: apply can return records, a line of text, and its own ids', () => {
  Desk.store.init({ now: () => NOW });
  const d2 = { id: 'posting', answer: { TITLE: ['value'], ORG: ['value'] },
    data: () => ({}), template: 'Read it. {items}',
    apply: (res) => ({
      suggestions: [{ kind: 'job-draft', key: 'one', target: { title: res.accepted.map((a) => a.fields.value).join('/') }, why: '' }],
      text: 'Job ready.',
    }) };
  R.register(d2);
  R.remember(d2, R.buildQuestion(d2, {}, '4ABC'));
  const res = R.process('DESK-4ABC\nTITLE | Clerk\nORG | Acme');
  assert.strictEqual(res.text, 'Job ready.');
  const s = Desk.store.all('suggestion')[0];
  assert.match(s.id, /^s_4abc_[0-9a-f]{8}$/);
  assert.strictEqual(s.kind, 'job-draft');
  assert.strictEqual(R.process('DESK-4ABC\nTITLE | Clerk\nORG | Acme').kind, 'already');
});

test('buildQuestion: the edited template is used; a profile is added; the reply language is added when shared', () => {
  Desk.store.init({ now: () => NOW });
  Desk.store.put({ type: 'profile', roles: 'Clerk', replyLanguage: 'French' });
  Desk.store.put({ type: 'recipe-edit', recipe: 'events', text: 'My own words. {profile}\n{items}' });
  const b = R.buildQuestion(def, {}, '7Q3K');
  assert.match(b.text, /^\[A question from Search Desk, a job-search page\. Code: DESK-7Q3K\]\n\nMy own words\. What work: Clerk/);
  assert.match(b.text, /Write the reasons in French\./);
  assert.strictEqual(b.record.code, '7Q3K');
});

test('remember is skipped for a recipe that reads no answer', () => {
  Desk.store.init({ now: () => NOW });
  const d3 = { id: 'coach', answer: null, template: 'Practise.' };
  assert.strictEqual(R.remember(d3, R.buildQuestion(d3, {}, '5DEF')), null);
  assert.strictEqual(Desk.store.all('prompt').length, 0);
});

test('needs turns strings and objects into {text, go}; a throwing needs is one plain problem', () => {
  assert.deepStrictEqual(j(R.needs({ needs: () => ['Add a job.', { text: 'Say what work.', go: 'profile' }, ''] })),
    [{ text: 'Add a job.', go: '' }, { text: 'Say what work.', go: 'profile' }]);
  const bad = R.needs({ needs: () => { throw new Error('x'); } });
  assert.strictEqual(bad.length, 1);
  assert.strictEqual(bad[0].text, 'This task could not be set up.');
  assert.deepStrictEqual(j(R.needs({})), []);
});

test('the paste handler is registered with the shell hook', () => {
  assert.ok(Desk.pasteHandlers.indexOf(R.handlePaste) >= 0);
});

test('an ai slot entry can read pasted text that is not an answer (T3.8)', () => {
  fresh();
  const saved = Desk.slots;
  try {
    let seen = [];
    Desk.slots = { list: (name) => { seen.push(name); return [
      { def: { id: 'bad', paste() { throw new Error('boom'); } } },
      { def: { id: 'none', paste() { return null; } } },
      { def: { id: 'shared', paste(t) { return /SHARED/.test(t) ? { text: 'Found one.', render() {} } : null; } } },
    ]; } };
    const hit = R.process('SHARED task');
    assert.strictEqual(hit.kind, 'shared');
    assert.strictEqual(hit.text, 'Found one.');
    assert.strictEqual(typeof hit.render, 'function');
    assert.strictEqual(hit.added, 0);
    assert.deepStrictEqual(seen, ['ai']);
    const miss = R.process('DESK-7Q3K\nL1 | Fits.');
    assert.strictEqual(miss.kind, 'saved', 'an answer still goes the normal way');
  } finally { Desk.slots = saved; }
});
