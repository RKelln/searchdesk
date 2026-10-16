// checks/example.check.js  (the check for the example feature)
Desk.check('example', (t, f) => {
  const L = f.logic;

  t.eq(f.id, 'example', 'the feature has its id');
  t.eq(f.types, ['note'], 'it owns the note type');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  t.eq(L.sortNotes([]), [], 'an empty list stays empty');
  const sorted = L.sortNotes([
    { title: 'b', updated: '2026-10-01T10:00:00Z' },
    { title: 'a', updated: '2026-10-02T10:00:00Z' },
    { title: 'c', updated: '2026-10-01T10:00:00Z' },
  ]);
  t.eq(sorted.map((n) => n.title), ['a', 'b', 'c'], 'newest first, then by title');

  const input = [{ title: 'z', updated: '1' }, { title: 'y', updated: '2' }];
  L.sortNotes(input);
  t.eq(input[0].title, 'z', 'sorting does not change the list it was given');

  t.eq(L.cleanNote({ title: '   ', text: 'x' }), { ok: false, problem: 'needTitle' }, 'a blank title is refused');
  t.eq(L.cleanNote({ title: ' Call back ', text: ' soon ' }),
    { ok: true, note: { type: 'note', title: 'Call back', text: 'soon' } }, 'spaces are trimmed');
  t.ok(L.cleanNote({ title: 'ok' }).ok, 'the text may be left out');
  t.ok(f.strings[L.cleanNote({ title: '' }).problem], 'the problem is a real string key');

  const notes = [{ title: 'Library', text: 'Ask about coaching' }, { title: 'Bus', text: 'Route 25' }];
  t.eq(L.findNotes(notes, 'LIBRARY').length, 1, 'find ignores capital letters');
  t.eq(L.findNotes(notes, 'route').map((n) => n.title), ['Bus'], 'find looks in the text too');
  t.eq(L.findNotes(notes, '  ').length, 2, 'an empty search shows everything');
});
