// checks/recipe-events.check.js
Desk.check('recipe-events', (t, f) => {
  const L = f.logic;
  const TODAY = '2026-10-16';
  t.eq(f.id, 'recipe-events', 'the feature has its id');
  t.eq(f.types, [], 'it owns no record types');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  // A fixture: 60 library events and 1,000 city events over 8 weeks, a few of each starred, dismissed or over.
  const day = (n) => L.addDays(TODAY, n);
  const events = [];
  for (let i = 0; i < 60; i++) events.push({ id: 'lib' + i, title: (i % 7 === 0 ? 'Office admin workshop ' : 'Library talk ') + i, start: day(i % 40) + 'T10:00', end: '', venue: 'Branch ' + i, tier: 'library', tags: [] });
  for (let i = 0; i < 1000; i++) events.push({ id: 'city' + i, title: (i % 50 === 0 ? 'Administration job fair ' : 'Concert ') + i, start: day((i % 60) - 3) + 'T19:00', end: '', venue: i % 9 === 0 ? 'Members only' : 'Hall ' + i, tier: 'city', tags: [] });
  const marks = [
    { type: 'event-mark', eventId: 'lib0', status: 'starred' },
    { type: 'event-mark', eventId: 'lib7', status: 'dismissed' },
    { type: 'event-mark', eventId: 'city50', status: 'starred' },
    { type: 'event-mark', eventId: 'city100', status: 'dismissed' },
    { type: 'event-mark', eventId: 'lib14', status: 'starred', deleted: true },
  ];
  const profile = { roles: 'Office administration', field: 'Finance' };

  const data = L.build(events, marks, profile, TODAY);
  const lrows = data.items.kinds.L, crows = data.items.kinds.C;
  t.ok(lrows.length > 0 && lrows.length <= 20, 'at most 20 library rows (' + lrows.length + ')');
  t.eq(crows.length, 20, 'at most 20 city rows, and the big feed fills them');
  const idsOf = (rows) => rows.map((r) => r.id);
  const all = idsOf(lrows).concat(idsOf(crows));
  ['lib0', 'lib7', 'city50', 'city100'].forEach((id) => t.ok(all.indexOf(id) < 0, id + ' is starred or hidden, so it is left out'));
  t.ok(L.pickRows(events, marks, profile, TODAY, { max: 60 }).L.some((e) => e.id === 'lib14'), 'a deleted mark does not hide an event');
  t.eq(new Set(all).size, all.length, 'no event is in the list twice');

  // window: not over, within 21 days
  const byId = {};
  events.forEach((e) => { byId[e.id] = e; });
  t.ok(all.every((id) => byId[id].start.slice(0, 10) >= TODAY && byId[id].start.slice(0, 10) <= day(20)), 'every row is today or within the next 21 days');
  const rest = L.pickRows(events, [], profile, TODAY, { max: 5000 });
  t.ok(rest.C.every((e) => e.start.slice(0, 10) >= TODAY && e.start.slice(0, 10) <= day(20)), 'old and far events are never rows');
  t.ok(rest.C.length > 20, 'the window itself holds more than 20 city events (so the cap matters)');

  // best fit first: the keyword events win a place before the plain ones
  t.ok(crows.some((r) => /^Administration/.test(r.cols[1])), 'city events that fit the profile are picked');
  const fits = crows.filter((r) => /^Administration/.test(r.cols[1])).length;
  const possible = rest.C.filter((e) => /^Administration/.test(e.title)).length;
  t.eq(fits, Math.min(20, possible), 'every fitting city event that can fit is picked before plain ones');
  const dates = (rows) => rows.map((r) => r.cols[0]);
  t.eq(dates(crows), dates(crows).slice().sort(), 'rows are in date order');

  // a ready-made row
  t.eq(L.row({ id: 'x', title: 'A | B', start: '2026-10-20T18:30', venue: 'V' }), { id: 'x', cols: ['2026-10-20 18:30', 'A | B', 'V'] }, 'a row is date, title, venue');
  t.eq(L.row({ id: 'x', title: 'T', start: '2026-10-20', venue: '' }).cols[0], '2026-10-20', 'a date with no time stays a date');
  t.ok(L.row({ id: 'x', title: 'T', start: '2026-10-20', venue: 'v'.repeat(100) }).cols[2].length <= 40, 'a long venue is cut');
  t.eq(L.pickRows([], [], profile, TODAY), { L: [], C: [] }, 'no events gives no rows');
  t.eq(L.pickRows(events, [], {}, TODAY).L.length, 20, 'with no profile words the earliest events are picked');
  t.eq(L.pickRows([{ id: 'a', title: 'Run', start: day(-2), end: day(1), tier: 'city' }], [], {}, TODAY).C.length, 1, 'an event that runs through today is kept');

  // the question fits the budget, with the real template
  const built = Desk.prompt.build({ id: 'events', template: L.TEMPLATE, answer: { L: ['why'], C: ['why'], NEW: ['title', 'url', 'why'] }, example: 'L1 | why' },
    Object.assign({ profile: ['What work: Office administration', 'Field: Finance'] }, data), { code: '7Q3K' });
  t.ok(built.size <= Desk.prompt.BUDGET, 'the question is within the budget (' + built.size + ' characters)');
  t.eq(built.missing, [], 'every placeholder has a value');
  t.ok(/\nL1 \| 20\d\d-/.test(built.text) && built.aliases.L1 && built.aliases['C' + (lrows.length + 1)], 'rows have the aliases L1.. and C<n>');

  // answers become suggestions
  const acc = [
    { kind: 'L', alias: 'L1', id: 'lib3', fields: { why: 'Fits.' }, marks: [] },
    { kind: 'C', alias: 'C25', id: 'city9', fields: { why: 'Job fair.' }, marks: ['name'] },
    { kind: 'NEW', alias: null, id: null, fields: { title: 'Open Door Hub', url: 'https://example.org/hub', why: 'Drop-in help.' }, marks: [] },
  ];
  const s = L.suggestions(acc);
  t.eq(s[0], { kind: 'event', alias: 'L1', target: 'lib3', why: 'Fits.', marks: [] }, 'an L line is an event suggestion aimed at the event id');
  t.eq(s[1].target, 'city9', 'a C line points at the event id');
  t.eq(s[1].marks, ['name'], 'repair marks are kept');
  t.eq(s[2], { kind: 'lead', target: { title: 'Open Door Hub', url: 'https://example.org/hub' }, why: 'Drop-in help.', marks: [] }, 'a NEW line is a lead suggestion');
  t.eq(L.suggestions([]), [], 'no lines, no suggestions');

  // the id the core gives: s_<code>_<alias>
  if (Desk.recipes && Desk.recipes.suggestionRecord) {
    const rec = Desk.recipes.suggestionRecord({ id: 'events' }, 'DESK-7Q3K', s[0]);
    t.eq([rec.id, rec.recipe, rec.status, rec.source], ['s_7q3k_l1', 'events', 'new', 'ai'], 'the suggestion id is s_<code>_<alias>');
  }
});
