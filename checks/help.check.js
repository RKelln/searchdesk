Desk.check('help', (t, f) => {
  const L = f.logic;
  t.eq(f.id, 'help', 'the feature has its id');
  t.eq(f.types, [], 'it owns no types');
  // Everything here comes from the locale pack, so the shell shows a stub when there is no pack.
  t.eq(f.needsLocale, true, 'it says it needs a place');
  t.ok(typeof f.mount === 'function', 'it has a mount function');
  const help = [
    { kind: 'online', name: 'B', source: 'https://b.example/' },
    { kind: 'person', name: 'A', source: 'https://a.example/' },
    { kind: 'person', name: 'C', source: 'https://c.example/' },
    { kind: 'person', name: 'D', source: 'http://d.example/' },
    { kind: 'person', source: 'https://e.example/' },
  ];
  t.eq(L.entriesOfKind(help, 'person').map((e) => e.name), ['A', 'C'], 'people keep their order; non-https and unnamed are left out');
  t.eq(L.entriesOfKind(help, 'online').map((e) => e.name), ['B'], 'online entries are separate');
  t.eq(L.entriesOfKind(undefined, 'person'), [], 'a missing list is empty');
  ['people', 'online', 'how', 'who', 'source', 'tabLabel'].forEach((k) => t.ok(f.strings[k], 'string ' + k + ' exists'));
});
