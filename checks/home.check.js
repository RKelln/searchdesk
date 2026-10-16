// checks/home.check.js
Desk.check('home', (t, f) => {
  const L = f.logic;
  const NOW = new Date(2026, 9, 16, 15, 0); // Fri Oct 16 2026, 3pm local
  const job = (o) => Object.assign({ type: 'job', title: 'J', stage: 'applied' }, o);
  const kinds = (items) => items.map((i) => i.kind + (i.jobId ? ':' + i.jobId : '') + (i.markId ? ':' + i.markId : ''));

  t.eq(f.id, 'home', 'the feature has its id');
  t.eq(f.types, [], 'it owns no record type');
  t.ok(typeof f.mount === 'function', 'it has a mount function');
  t.eq(L.today([], NOW), [], 'no records, no items');
  t.eq(L.today(undefined, NOW), [], 'a missing list is no items');

  // follow-ups
  const fu = L.today([
    job({ id: 'a', followUp: '2026-10-14' }),
    job({ id: 'b', followUp: '2026-10-16' }),
    job({ id: 'c', followUp: '2026-10-17' }),
    job({ id: 'd', followUp: '2026-10-01', stage: 'closed' }),
    job({ id: 'e', followUp: '2026-10-10', deleted: true }),
  ], NOW);
  t.eq(kinds(fu), ['followUp:a', 'followUp:b'], 'follow-ups: overdue and today only; closed and deleted jobs skipped');
  t.eq([fu[0].overdue, fu[0].days, fu[1].overdue, fu[1].days], [true, -2, false, 0], 'follow-ups: overdue and days');
  t.eq(L.today([job({ id: 'a', followUp: '2026-10-16', stage: 'offer' })], NOW).length, 1, 'an offer job still has follow-ups');

  // interviews and closing dates
  const win = L.today([
    job({ id: 'i1', interviewAt: '2026-10-18T10:00' }),
    job({ id: 'i2', interviewAt: '2026-10-23' }),
    job({ id: 'i3', interviewAt: '2026-10-24' }),
    job({ id: 'i4', interviewAt: '2026-10-15T09:00' }),
    job({ id: 'i5', interviewAt: '2026-10-17', stage: 'closed' }),
    job({ id: 'c1', stage: 'saved', closes: '2026-10-20' }),
    job({ id: 'c2', stage: 'saved', closes: '2026-10-15' }),
    job({ id: 'c3', stage: 'saved', closes: '2026-10-24' }),
    job({ id: 'c4', stage: 'applied', closes: '2026-10-20' }),
  ], NOW);
  t.eq(kinds(win), ['interview:i1', 'closes:c1', 'interview:i2'], 'interviews within 7 days and saved jobs closing within 7 days, soonest first');
  t.eq(win[0].date, '2026-10-18T10:00', 'an interview keeps its time');
  t.eq([win[0].days, win[1].days, win[2].days], [2, 4, 7], 'days from today');

  // events: today..today+6
  const mark = (id, status, start) => ({ type: 'event-mark', id: id, eventId: 'e_' + id, status: status, copy: { title: 'Fair ' + id, start: start } });
  const ev = L.today([
    mark('m1', 'starred', '2026-10-22T18:00'),
    mark('m2', 'starred', '2026-10-23T18:00'),
    mark('m3', 'dismissed', '2026-10-18T18:00'),
    mark('m4', 'starred', '2026-10-15T18:00'),
    mark('m5', 'starred', '2026-10-17'),
  ], NOW);
  t.eq(kinds(ev), ['event:m5', 'event:m1'], 'starred events in the next 7 days (today and six more), soonest first');
  t.eq(ev[0].eventId, 'e_m5', 'an event item carries the event id');

  // order: overdue first, then by day, then suggestions, then the question
  const all = L.today([
    { type: 'prompt', id: 'p1', code: 'DESK-AAAA', recipe: 'events', created: '2026-10-15T10:00:00Z' },
    { type: 'suggestion', id: 's1', recipe: 'events', code: 'DESK-OLD1', status: 'new' },
    { type: 'suggestion', id: 's2', recipe: 'events', code: 'DESK-OLD1', status: 'new' },
    { type: 'suggestion', id: 's3', recipe: 'events', code: 'DESK-OLD1', status: 'taken' },
    { type: 'suggestion', id: 's4', recipe: 'posting', code: 'DESK-OLD2', status: 'new' },
    mark('m1', 'starred', '2026-10-16T18:00'),
    job({ id: 'x', closes: '2026-10-17', stage: 'saved' }),
    job({ id: 'y', followUp: '2026-10-16' }),
    job({ id: 'z', followUp: '2026-10-12' }),
    job({ id: 'w', interviewAt: '2026-10-16T09:00' }),
  ], NOW);
  t.eq(kinds(all), ['followUp:z', 'followUp:y', 'interview:w', 'event:m1', 'closes:x', 'suggestions', 'suggestions', 'question'],
    'order: overdue, then by day (follow-up, interview, event on the same day), then suggestions, then the question');
  t.eq(all.filter((i) => i.kind === 'suggestions').map((i) => [i.recipe, i.count]), [['events', 2], ['posting', 1]], 'new suggestions are counted per recipe');
  t.eq(all[all.length - 1].code, 'DESK-AAAA', 'the question item carries its code');

  // pending question
  const pq = (rs) => L.today(rs, NOW).filter((i) => i.kind === 'question').map((i) => i.code);
  const prompt = (code, created) => ({ type: 'prompt', id: 'p_' + code, code: code, recipe: 'events', created: created });
  t.eq(pq([prompt('A', '2026-10-10T10:00:00Z'), prompt('B', '2026-10-15T10:00:00Z')]), ['B'], 'the newest question is the one waiting');
  t.eq(pq([prompt('A', '2026-10-15T10:00:00Z'), { type: 'suggestion', code: 'A', status: 'dismissed', recipe: 'events' }]), [], 'a question with a suggestion is answered');
  t.eq(pq([prompt('A', '2026-10-01T10:00:00Z')]), [], 'a question older than 7 days is not shown');
  t.eq(pq([prompt('A', 'junk')]), [], 'a prompt with a bad date is ignored');

  // times and inputs
  t.eq(L.today([job({ id: 'a', followUp: '2026-10-16' })], NOW.getTime()).length, 1, 'now may be milliseconds');
  const input = [job({ id: 'a', followUp: '2026-10-14' })];
  L.today(input, NOW);
  t.eq(input.length, 1, 'the list is not changed');
  t.eq(L.dayOf('2026-10-16T09:30'), '2026-10-16', 'dayOf: date and time text');
  t.eq(L.dayOf(new Date(2026, 9, 20, 18, 0).toISOString()), '2026-10-20', 'dayOf: an ISO time is shown as a local day');
  t.eq(L.dayOf('nope'), '', 'dayOf: junk is empty');
  t.eq(L.daysBetween('2026-10-30', '2026-11-02'), 3, 'daysBetween crosses a month');
  t.eq(L.today([job({ id: 'a', followUp: 'soon' })], NOW), [], 'a bad date is skipped');
});
