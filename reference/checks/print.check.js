// checks/print.check.js  (the check for the one-page summary)
Desk.check('print', (t, f) => {
  const L = f.logic;
  const TODAY = '2026-10-16';

  t.eq(f.id, 'print', 'the feature has its id');
  t.eq(f.types, [], 'it owns no record types');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  // todayKey and dayOf
  t.eq(L.todayKey(new Date(2026, 9, 16, 9, 30)), TODAY, 'a local date becomes YYYY-MM-DD');
  t.eq(L.dayOf('2026-10-20T18:30'), '2026-10-20', 'a date and time keeps its day');
  t.eq(L.dayOf('nope'), '', 'a bad text gives no day');
  t.eq(L.daysFrom(TODAY, '2026-10-22'), 6, 'days are counted across the month');

  // weekDates
  const jobs = [
    { title: 'Zed', stage: 'applied', followUp: '2026-10-16' },
    { title: 'Ana', stage: 'interview', interviewAt: '2026-10-22T14:00', followUp: '2026-10-22' },
    { title: 'Bob', stage: 'saved', closes: '2026-10-21' },
    { title: 'Old', stage: 'applied', followUp: '2026-10-10' },
    { title: 'Far', stage: 'saved', closes: '2026-10-24' }, // 8 days out: not in the week,
    { title: 'Shut', stage: 'closed', followUp: '2026-10-18' },
  ];
  const before = JSON.stringify(jobs);
  const week = L.weekDates(jobs, TODAY);
  t.eq(week.map((x) => x.job.title + ':' + x.kind + ':' + x.date), [
    'Zed:followUp:2026-10-16',
    'Bob:closes:2026-10-21',
    'Ana:followUp:2026-10-22',
    'Ana:interview:2026-10-22',
  ], 'dates this week are listed earliest first, and a closed job gives nothing');
  t.eq(JSON.stringify(jobs), before, 'weekDates does not change the jobs it is given');
  t.eq(L.weekDates([], TODAY), [], 'no jobs give no dates');

  // lateJobs
  const late = L.lateJobs(jobs, TODAY);
  t.eq(late.map((j) => j.title), ['Old'], 'a follow-up before today is late, a closed job is not');
  t.eq(JSON.stringify(jobs), before, 'lateJobs does not change the jobs it is given');

  // starredThisWeek
  const marks = [
    { status: 'starred', copy: { title: 'Fair', start: '2026-10-18T10:00', venue: 'Hall' } },
    { status: 'starred', copy: { title: 'Long', start: '2026-10-10', end: '2026-10-17' } },
    { status: 'starred', copy: { title: 'Later', start: '2026-10-30' } },
    { status: 'dismissed', copy: { title: 'Hidden', start: '2026-10-16' } },
    { status: 'starred', deleted: true, copy: { title: 'Gone', start: '2026-10-16' } },
    { status: 'starred', copy: { title: 'Ended', start: '2026-10-01', end: '2026-10-05' } },
  ];
  const marksBefore = JSON.stringify(marks);
  const stars = L.starredThisWeek(marks, TODAY);
  t.eq(stars.map((m) => m.copy.title), ['Long', 'Fair'], 'starred events on now or in the next 7 days are kept, in start order');
  t.eq(JSON.stringify(marks), marksBefore, 'starredThisWeek does not change the marks it is given');
  t.eq(L.starredThisWeek([], TODAY), [], 'no marks give nothing');

  // strings used by the screen exist
  ['tabLabel', 'heading', 'todayLine', 'printButton', 'lateHeading', 'lateLine', 'weekHeading',
    'followUp', 'interview', 'closes', 'starredHeading', 'venueLine', 'nothing'].forEach((k) => {
    t.ok(typeof f.strings[k] === 'string' && f.strings[k].length > 0, 'the string ' + k + ' is set');
  });
});
