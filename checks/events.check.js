// checks/events.check.js
Desk.check('events', (t, f) => {
  const L = f.logic;
  const NOW = new Date(2026, 9, 16, 15, 0); // Fri Oct 16 2026, 3pm local
  const TODAY = L.todayKey(NOW);
  const ev = (id, start, o) => Object.assign({ id: id, title: 'Event ' + id, start: start, end: '', venue: 'V', address: '', url: 'https://example.org/' + id, tier: 'library', tags: [] }, o);
  const ids = (list) => list.map((e) => e.id);

  t.eq(f.id, 'events', 'the feature has its id');
  t.eq(f.types, ['event-mark', 'suggestion'], 'it owns event-mark, and writes suggestion status');
  t.ok(typeof f.mount === 'function', 'it has a mount function');
  t.eq(TODAY, '2026-10-16', 'todayKey is the local date');

  // weeks: this = today..today+6, next = +7..+13
  t.eq(L.weekOf(ev('a', '2026-10-16T09:00'), TODAY), 'this', 'earlier today still counts as this week');
  t.eq(L.weekOf(ev('a', '2026-10-22'), TODAY), 'this', 'today+6 is this week');
  t.eq(L.weekOf(ev('a', '2026-10-23'), TODAY), 'next', 'today+7 is next week');
  t.eq(L.weekOf(ev('a', '2026-10-29T18:00'), TODAY), 'next', 'today+13 is next week');
  t.eq(L.weekOf(ev('a', '2026-10-30'), TODAY), 'later', 'today+14 is later');
  t.eq(L.weekOf(ev('a', '2026-10-15T18:00'), TODAY), 'past', 'yesterday is over');
  t.eq(L.weekOf(ev('a', '2026-10-15', { end: '2026-10-17' }), TODAY), 'this', 'an event that runs through today counts as today');
  t.eq(L.weekOf(ev('a', '2026-10-14', { end: '2026-10-15T20:00' }), TODAY), 'past', 'an event that ended yesterday is over');
  t.eq(L.weekOf(ev('a', '2026-10-25', { end: '2026-10-20' }), TODAY), 'next', 'an end before the start is ignored');
  t.eq(L.weekOf({ id: 'x', start: 'garbage' }, TODAY), 'past', 'a bad date is not shown');
  t.ok(L.inWeek(ev('a', '2026-12-01'), 'all', TODAY) && !L.inWeek(ev('a', '2026-10-01'), 'all', TODAY), 'All is everything not over');

  // the lists
  const events = [
    ev('late', '2026-11-20T10:00'), ev('past', '2026-10-01T10:00'), ev('n2', '2026-10-24T10:00', { tier: 'city' }),
    ev('t2', '2026-10-18T10:00', { tier: 'city' }), ev('t1', '2026-10-17T10:00'), ev('n1', '2026-10-23', { title: 'B' }), ev('n0', '2026-10-23', { title: 'a' }),
  ];
  t.eq(ids(L.listed(events, [], 'this', TODAY)), ['t1', 't2'], 'this week, in date order');
  t.eq(ids(L.listed(events, [], 'next', TODAY)), ['n0', 'n1', 'n2'], 'next week; same day goes by title');
  t.eq(ids(L.listed(events, [], 'all', TODAY)), ['t1', 't2', 'n0', 'n1', 'n2', 'late'], 'all: not over, in date order');
  const marks = [
    { type: 'event-mark', eventId: 't1', status: 'starred', copy: { title: 'Event t1', start: '2026-10-17T10:00' } },
    { type: 'event-mark', eventId: 't2', status: 'dismissed' },
    { type: 'event-mark', eventId: 'n0', status: 'starred', deleted: true },
  ];
  t.eq(ids(L.listed(events, marks, 'this', TODAY)), [], 'starred and hidden events are not in the tier lists');
  t.eq(ids(L.listed(events, marks, 'next', TODAY)), ['n0', 'n1', 'n2'], 'a deleted mark counts for nothing');
  t.eq(events.length, 7, 'filtering does not change the list it was given');

  // tiers
  const tiers = [{ id: 'library', name: 'At the library' }, { id: 'city', name: 'Around the city' }];
  const g = L.groupByTier(L.listed(events, [], 'all', TODAY), tiers);
  t.eq(g.map((x) => x.id + ':' + ids(x.events).join('+')), ['library:t1+n0+n1+late', 'city:t2+n2'], 'events are grouped by tier, in the locale order');
  t.eq(L.groupByTier([ev('z', '2026-10-17', { tier: 'mystery' })], tiers)[1].events.length, 1, 'an unknown tier goes in the last group');
  t.eq(L.groupByTier([], tiers).map((x) => x.events.length), [0, 0], 'empty tiers are still listed');

  // marks and copies
  t.eq(L.markId('01ABC'), 'em_01ABC', 'a mark has a fixed id per event');
  t.eq(L.copyOf(ev('a', '2026-10-17T10:00', { end: '2026-10-17T11:00', url: 'http://x.org/a' })),
    { title: 'Event a', start: '2026-10-17T10:00', end: '2026-10-17T11:00', venue: 'V', url: '', tier: 'library' }, 'the copy keeps six fields and only an https link');
  const starred = L.markedEvents(marks, events, 'starred', TODAY);
  t.eq(ids(starred), ['t1'], 'starred events: only live marks');
  t.eq(L.markedEvents(marks, events, 'dismissed', TODAY).length, 1, 'hidden events are found too');

  // a starred event outlives the feed
  const gone = [{ type: 'event-mark', eventId: 'x9', status: 'starred', copy: { title: 'Hiring fair', start: '2026-10-20T13:00', end: '', venue: 'Hall', url: 'https://example.org/fair', tier: 'city' } }];
  const keep = L.markedEvents(gone, [], 'starred', TODAY);
  t.eq(keep.length, 1, 'a starred event the feed no longer has still shows');
  t.eq([keep[0].id, keep[0].title, keep[0].venue, keep[0].tier, keep[0].url], ['x9', 'Hiring fair', 'Hall', 'city', 'https://example.org/fair'], 'it comes from the copy');
  t.eq(L.markedEvents([{ type: 'event-mark', eventId: 'x8', status: 'starred', copy: { title: 'Old', start: '2026-10-01' } }], [], 'starred', TODAY).length, 0, 'a starred event that is over is not listed');
  t.eq(L.markedEvents(gone, [ev('x9', '2026-10-21T09:00', { title: 'Fresh title' })], 'starred', TODAY)[0].title, 'Fresh title', 'the feed wins when it still has the event');

  // suggestions
  const sg = (id, o) => Object.assign({ id: id, type: 'suggestion', recipe: 'events', kind: 'event', target: 't2', why: 'Fits you', status: 'new' }, o);
  const list = [
    sg('s1', { target: 'n1' }), sg('s2', { target: 'zzz' }), sg('s3', { status: 'taken', target: 'n2' }), sg('s4', { recipe: 'posting', target: 'n2' }),
    sg('s5', { target: 'n0' }), sg('s6', { target: 'past' }), sg('s7', { deleted: true, target: 'n2' }), sg('s8', { kind: 'lead', target: 'n2' }), sg('s9', { target: 't1' }),
  ];
  const sug = L.suggested(list, events, marks, TODAY);
  t.eq(sug.map((x) => x.suggestion.id), ['s1', 's5'], 'suggestions: new, events recipe, event kind, still in the feed, not over, not marked; same day goes by id');
  t.eq(sug[0].why, 'Fits you', 'the reason comes along');
  t.eq(L.suggested(undefined, events, marks, TODAY), [], 'no suggestions is fine');

  // match words (a locale tier's `match`)
  const W = ['job', 'english conversation', 'résumé'];
  t.ok(L.matchesWords(ev('a', '2026-10-20', { title: 'Jobs Fair' }), W), 'a word matches at the start of a word, any case');
  t.ok(!L.matchesWords(ev('a', '2026-10-20', { title: 'Banjo night' }), W), 'not inside a word');
  t.ok(L.matchesWords(ev('a', '2026-10-20', { title: 'Big job-ready day' }), W), 'after a space, before a dash');
  t.ok(L.matchesWords(ev('a', '2026-10-20', { title: 'Free English Conversation Circle' }), W), 'a phrase matches');
  t.ok(L.matchesWords(ev('a', '2026-10-20', { title: 'Mon Résumé' }), W), 'accents match');
  t.ok(L.matchesWords(ev('a', '2026-10-20', { title: 'Talk', tags: ['job fairs'] }), W), 'tags count');
  t.ok(L.matchesWords(ev('a', '2026-10-20', { title: 'Anything' }), []) && L.matchesWords(ev('a', '2026-10-20'), undefined), 'no words means all match');
  t.ok(L.matchesWords(ev('a', '2026-10-20', { title: 'C++ (a+b)' }), ['c++', '(a+b)']), 'words with symbols are taken literally');

  // strings used by the screen
  ['tabLabel', 'weekThis', 'weekNext', 'weekAll', 'star', 'unstar', 'dismiss', 'listing', 'fromAi', 'why', 'suggestedHeading', 'starredHeading', 'matchedOnly', 'matchShowAll', 'matchShowFew'].forEach((k) => {
    t.ok(typeof f.strings[k] === 'string' && f.strings[k], 'string ' + k + ' exists');
  });
});
