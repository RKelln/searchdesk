'use strict';
// Improving recipes (T3.7): the line diff, versions, edits, notes, and the "improve" task's round trip.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./_load');

const Desk = load(['core/strings.js', 'core/store.js', 'core/prompt.js', 'core/reply.js', 'core/recipes.js', 'core/recipe-edit.js']);
const R = Desk.recipes;
const E = Desk.recipeEdit;
const j = (x) => JSON.parse(JSON.stringify(x));
const NOW = Date.parse('2026-10-16T15:00:00Z');
Desk.now = () => new Date(NOW);

const def = {
  id: 'events', title: 'Find events',
  template: 'Pick events for:\n{profile}\nUp to {n} picks.\n{items}',
  placeholders: { profile: 'what you chose to share', n: 'how many picks', items: 'the events list' },
  answer: { L: ['why'] }, example: 'L1 | why',
  data: () => ({ n: 3, items: { header: 'alias | title', kinds: { L: [{ id: 'ev_a', cols: ['Resume Help'] }] } } }),
};
R.register(def);
function fresh() { Desk.store.init({ now: () => NOW, device: 'dtest' }); }

test('lineDiff: same text has no changed rows', () => {
  const rows = j(E.lineDiff('a\nb\nc', 'a\nb\nc'));
  assert.deepStrictEqual(rows, [{ a: 'a', b: 'a', changed: false }, { a: 'b', b: 'b', changed: false }, { a: 'c', b: 'c', changed: false }]);
  assert.strictEqual(E.changedCount(rows), 0);
});

test('lineDiff: a changed line is one changed row; added and removed lines have a missing side', () => {
  const rows = j(E.lineDiff('one\ntwo\nthree', 'one\n2\nthree'));
  assert.deepStrictEqual(rows[1], { a: 'two', b: '2', changed: true });
  assert.strictEqual(E.changedCount(rows), 1);
  const add = j(E.lineDiff('a\nc', 'a\nb\nc'));
  assert.deepStrictEqual(add.map((r) => [r.a, r.b, r.changed]), [['a', 'a', false], [null, 'b', true], ['c', 'c', false]]);
  const del = j(E.lineDiff('a\nb\nc', 'a\nc'));
  assert.deepStrictEqual(del.map((r) => [r.a, r.b, r.changed]), [['a', 'a', false], ['b', null, true], ['c', 'c', false]]);
});

test('lineDiff: pairs a run of changes in order, ignores spaces at the end, and handles empty text', () => {
  const rows = j(E.lineDiff('x\nold1\nold2\nold3\ny', 'x\nnew1\nnew2\ny'));
  assert.deepStrictEqual(rows.filter((r) => r.changed).map((r) => [r.a, r.b]), [['old1', 'new1'], ['old2', 'new2'], ['old3', null]]);
  assert.strictEqual(E.changedCount(E.lineDiff('a  \nb', 'a\nb')), 0);
  assert.strictEqual(E.changedCount(E.lineDiff('a\r\nb', 'a\nb')), 0);
  assert.deepStrictEqual(j(E.lineDiff('', '')), [{ a: '', b: '', changed: false }]);
  assert.strictEqual(E.changedCount(E.lineDiff('', 'new')), 1);
});

test('lineDiff: both sides always add back to the whole text, and a huge change stays quick', () => {
  const a = Array.from({ length: 40 }, (_, i) => 'line ' + i).join('\n');
  const b = a.replace('line 7', 'seven').replace('line 20\n', '').replace('line 33', 'line 33\nextra');
  const rows = E.lineDiff(a, b);
  assert.strictEqual(rows.map((r) => r.a).filter((x) => x !== null).join('\n'), a);
  assert.strictEqual(rows.map((r) => r.b).filter((x) => x !== null).join('\n'), b);
  const big1 = Array.from({ length: 2000 }, (_, i) => 'a' + i).join('\n'), big2 = Array.from({ length: 2000 }, (_, i) => 'b' + i).join('\n');
  const t0 = Date.now();
  const bigRows = E.lineDiff(big1, big2);
  assert.ok(Date.now() - t0 < 1000);
  assert.strictEqual(bigRows.length, 2000);
  assert.ok(bigRows.every((r) => r.changed));
});

test('addVersion keeps the newest 5, newest first, and one copy of each text', () => {
  let v = [];
  for (let i = 1; i <= 7; i++) v = E.addVersion(v, 'text ' + i, '2026-10-0' + i);
  assert.deepStrictEqual(j(v.map((x) => x.text)), ['text 7', 'text 6', 'text 5', 'text 4', 'text 3']);
  assert.deepStrictEqual(j(v[0]), { text: 'text 7', at: '2026-10-07' });
  v = E.addVersion(v, 'text 5', 'later');
  assert.deepStrictEqual(j(v.map((x) => x.text)), ['text 5', 'text 7', 'text 6', 'text 4', 'text 3']);
  assert.strictEqual(E.addVersion(null, 'a', 't').length, 1);
  assert.strictEqual(E.addVersion([{ text: 'a' }, 5, null, { nope: 1 }], 'b', 't').length, 2, 'bad entries are dropped');
  assert.strictEqual(E.addVersion([1, 2, 3].map((n) => ({ text: String(n) })), 'x', 't', 2).length, 2);
});

test('clean, effective and same', () => {
  assert.strictEqual(E.clean('a  \r\nb\t\n\n'), 'a\nb');
  assert.strictEqual(E.clean('a\u0000b'), 'ab');
  assert.strictEqual(E.clean('x'.repeat(9000)).length, E.MAX_TEXT);
  assert.strictEqual(E.effective('orig', null), 'orig');
  assert.strictEqual(E.effective('orig', { text: '   ' }), 'orig');
  assert.strictEqual(E.effective('orig', { text: 'mine' }), 'mine');
  assert.ok(E.same('a \nb', 'a\nb'));
});

test('makeEdit and resetEdit', () => {
  const first = E.makeEdit(null, 'events', 'New words {items}  ', ' because   it was wordy ', '2026-10-16T10:00:00.000Z');
  assert.deepStrictEqual(j(first), { type: 'recipe-edit', id: 're_events', recipe: 'events', text: 'New words {items}', why: 'because it was wordy',
    versions: [{ text: 'New words {items}', at: '2026-10-16T10:00:00.000Z' }] });
  const second = E.makeEdit(first, 'events', 'Newer {items}', '', '2026-10-17T10:00:00.000Z');
  assert.deepStrictEqual(j(second.versions.map((x) => x.text)), ['Newer {items}', 'New words {items}']);
  const back = E.resetEdit(second);
  assert.strictEqual(back.text, '');
  assert.strictEqual(back.versions.length, 2, 'the versions stay');
  assert.strictEqual(E.resetEdit(back), null, 'nothing to reset twice');
  assert.strictEqual(E.resetEdit(null), null);
  assert.strictEqual(E.editId('a b/c'), 're_a_b_c');
});

test('check: dropped and unknown placeholders', () => {
  assert.deepStrictEqual(j(E.check(def.template, def)), { absent: [], unknown: [] });
  assert.deepStrictEqual(j(E.check('Pick. {profile} {n}', def)), { absent: ['items'], unknown: [] });
  assert.deepStrictEqual(j(E.check('{profile} {n} {items} {nope}', def)), { absent: [], unknown: ['nope'] });
  assert.deepStrictEqual(j(E.check('{items}', { template: 'a {x} {items}' })), { absent: ['x'], unknown: [] }, 'with no list, the template names are the list');
  assert.deepStrictEqual(j(E.check('{profile} {items}', { placeholders: { n: 'x' } })), { absent: ['n'], unknown: [] });
});

test('notes: newest first, unused only, with a sentence, at most 10', () => {
  const notes = [];
  for (let i = 1; i <= 12; i++) notes.push({ id: 'n' + i, recipe: 'events', text: 'note ' + i, used: i === 3, updated: '2026-10-' + (i < 10 ? '0' + i : i) });
  notes.push({ id: 'x', recipe: 'other', text: 'no', used: false, updated: '2026-10-20' });
  notes.push({ id: 'y', recipe: 'events', text: '  ', used: false, updated: '2026-10-21' });
  notes.push({ id: 'z', recipe: 'events', text: 'gone', used: false, deleted: true, updated: '2026-10-22' });
  assert.strictEqual(E.notesFor(notes, 'events', false).length, 13, 'all of them, for the list under the task');
  assert.strictEqual(E.notesFor(notes, 'events', false)[0].id, 'y');
  const send = E.notesToSend(notes, 'events');
  assert.deepStrictEqual(j(send.map((n) => n.id)), ['n12', 'n11', 'n10', 'n9', 'n8', 'n7', 'n6', 'n5', 'n4', 'n2']);
  assert.strictEqual(E.noteLines([]), '(none yet)');
  assert.strictEqual(E.noteLines([{ text: ' a\n b ' }, { text: 'x'.repeat(400) }]).split('\n')[1].length, 2 + E.NOTE_CHARS);
});

test('an edit is used by the next question and reset brings back the original', () => {
  fresh();
  assert.ok(R.buildQuestion(def, {}, '7Q3K').text.includes('Pick events for:'));
  Desk.store.put(E.makeEdit(null, 'events', 'My own words {profile}\n{items}', '', Desk.now().toISOString()));
  const mine = R.buildQuestion(def, {}, '7Q3K').text;
  assert.ok(mine.includes('My own words') && !mine.includes('Pick events for:'));
  assert.ok(mine.includes('HOW TO ANSWER'), 'the answer block is still added');
  assert.strictEqual(R.ctx().edited('events'), 'My own words {profile}\n{items}');
  assert.strictEqual(R.ctx().edited('coach'), null);
  Desk.store.put(E.resetEdit(Desk.store.get('re_events')));
  assert.ok(R.buildQuestion(def, {}, '7Q4K').text.includes('Pick events for:'));
  assert.strictEqual(R.ctx().edited('events'), null);
});

test('the improve question carries the instructions, the kept words and the unused notes', () => {
  fresh();
  Desk.store.put({ type: 'recipe-note', recipe: 'events', code: 'AAAA', text: 'Picked events too far away.', used: false });
  Desk.store.put({ type: 'recipe-note', recipe: 'events', code: 'BBBB', text: 'Old note, already used.', used: true });
  const improve = R.get('improve');
  assert.ok(improve && improve.listed === false);
  assert.strictEqual(R.needs(improve, { options: {}, args: [], inputs: {} }).length, 1, 'no task chosen gives a message');
  const opts = { options: {}, args: ['events'], inputs: {} };
  assert.deepStrictEqual(j(R.needs(improve, opts)), []);
  const built = R.buildQuestion(improve, opts, '9ZZZ');
  const t = built.text;
  assert.ok(t.includes('for this task: Find events.'));
  assert.ok(t.includes('{profile} - what you chose to share') && t.includes('{items} - the events list'));
  assert.ok(t.includes('- Picked events too far away.') && !t.includes('Old note'));
  assert.ok(t.includes('-----\nPick events for:\n{profile}\nUp to {n} picks.\n{items}\n-----'), 'the current words, with their curly brackets as they are');
  assert.ok(t.includes('First line: DESK-9ZZZ') && t.includes('What changed:'));
  assert.ok(!t.includes('Write it in'), 'no reply language: the instructions stay in their own language');
  assert.deepStrictEqual(j(built.missing), []);
  const keep = improve.keep(R.ctx(), opts);
  assert.strictEqual(keep.target, 'events');
  assert.strictEqual(keep.notes.length, 1);
  // an edit is what gets improved
  Desk.store.put(E.makeEdit(null, 'events', 'Mine {items}', '', Desk.now().toISOString()));
  assert.ok(R.buildQuestion(improve, opts, '9ZZY').text.includes('-----\nMine {items}\n-----'));
});

test('an improved answer is read whole; the page shows it to choose, and saves nothing by itself', () => {
  fresh();
  Desk.store.put({ type: 'recipe-note', recipe: 'events', code: 'AAAA', text: 'Too far.', used: false });
  const improve = R.get('improve'), opts = { options: {}, args: ['events'], inputs: {} };
  const built = R.buildQuestion(improve, opts, '8YYY');
  R.remember(improve, built, opts);
  assert.deepStrictEqual(j(Desk.store.get('p_8yyy').keep.target), 'events');
  const answer = 'Here you go.\n```\nDESK-8YYY\nPick events near the person.\n{profile}\n\nUp to {n} picks.\n{items}\n```\nWhat changed: Added "near the person".';
  const res = R.process(answer);
  assert.strictEqual(res.recipe, 'improve');
  assert.strictEqual(res.kind, 'nothing', 'no suggestions are saved');
  assert.strictEqual(typeof res.render, 'function', 'there is a compare view');
  assert.strictEqual(Desk.store.all('recipe-edit').length, 0, 'the chat route never edits the person\'s records by itself');
  assert.strictEqual(Desk.store.all('suggestion').length, 0);
  assert.ok(Desk.store.get('p_8yyy').answeredAt, 'the question counts as answered');
  assert.strictEqual(res.text, 'The AI wrote new instructions. Look at them next to yours.');
});

test('an answer with no task on the question says so', () => {
  fresh();
  const improve = R.get('improve');
  const built = R.buildQuestion(improve, { options: {}, args: ['events'], inputs: {} }, '7NNN');
  R.remember(improve, built, { options: {}, args: [], inputs: {} }); // keep is empty
  const res = R.process('```\nDESK-7NNN\nSome words\n```');
  assert.strictEqual(res.render, null);
  assert.strictEqual(res.text, 'That task is not here any more. Nothing was changed.');
});

test('instructionsLength: as typed minus a trailing {context}; a recipe hook wins; tooLong is 0 at 1,500', () => {
  assert.strictEqual(E.instructionsLength('abc\n\n{context}\n', {}), 3);
  assert.strictEqual(E.instructionsLength('a {context} b', {}), 13);
  assert.strictEqual(E.tooLong('x'.repeat(1500), {}), 0);
  assert.strictEqual(E.tooLong('x'.repeat(1501), {}), 1501);
  assert.strictEqual(E.tooLong('x'.repeat(1500) + '\n\n{context}', {}), 0);
  assert.strictEqual(E.tooLong('x', { instructionsLength: () => 2000 }), 2000);
  assert.strictEqual(E.tooLong('x'.repeat(2000), { instructionsLength: () => { throw new Error('x'); } }), 2000);
});
