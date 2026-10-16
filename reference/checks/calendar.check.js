// checks/calendar.check.js  (reference check for the calendar feature)
Desk.check('calendar', (t, f) => {
  const L = f.logic;
  const now = new Date(Date.UTC(2026, 9, 16, 12, 0, 0));
  const ics = (o) => L.icsFor(Object.assign({ uid: 'job-j1@searchdesk', title: 'Interview', now: now }, o));
  const lines = (text) => text.split('\r\n');

  t.eq(f.id, 'calendar', 'the feature has its id');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  // escaping
  t.eq(L.escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne', 'commas, semicolons, backslashes and line breaks are escaped');
  t.eq(L.escapeText('Cook, line; day 2'), 'Cook\\, line\\; day 2', 'a title with a comma and semicolon is escaped');

  // folding
  const long = 'x'.repeat(200);
  const folded = L.foldLine(long).split('\r\n');
  t.ok(folded[0].length === 75, 'the first folded line is 75 characters');
  t.ok(folded.slice(1).every((l) => l[0] === ' '), 'each folded line starts with one space');
  t.eq(L.foldLine('short'), 'short', 'a short line is not folded');

  // file names
  t.eq(L.fileName('Cook, line / day 2'), 'Cook-line-day-2.ics', 'a file name keeps letters, numbers and dashes');
  t.ok(/^[A-Za-z0-9-]+\.ics$/.test(L.fileName('Cook, line / day 2')), 'the file name has only safe characters');
  t.ok(L.fileName('!!!').endsWith('.ics'), 'a name with no safe characters still ends in .ics');
  t.ok(L.fileName('x'.repeat(300)).length <= 80, 'a long file name is at most 80 characters');

  // ids
  const job = { id: 'j1', type: 'job', title: 'Line cook', org: 'Maple Cafe' };
  t.eq(L.uidFor(job), L.uidFor(Object.assign({}, job)), 'the same job always gives the same id');
  t.ok(L.uidFor(job) !== L.uidFor({ id: 'j2', type: 'job' }), 'different jobs give different ids');
  t.ok(L.uidFor({ id: 'e1' }) !== L.uidFor(job), 'an event id does not clash with a job id');

  // job titles
  t.eq(L.jobTitle(job, 'Interview'), 'Interview: Line cook at Maple Cafe', 'a job title has the organisation');
  t.eq(L.jobTitle({ title: 'Cook' }, 'Interview'), 'Interview: Cook', 'a job with no organisation has no "at"');

  // the file itself
  const timed = ics({ start: '2026-10-22T18:30', end: '', title: 'Interview: Cook at Cafe' });
  t.ok(timed.startsWith('BEGIN:VCALENDAR'), 'the file starts with BEGIN:VCALENDAR');
  t.ok(timed.endsWith('END:VCALENDAR\r\n'), 'the file ends with END:VCALENDAR and a line break');
  t.ok(timed.indexOf('\n') === timed.indexOf('\r\n') + 1, 'lines are joined with \\r\\n');
  t.ok(lines(timed).includes('DTSTART:20261022T183000'), 'a timed start has no Z and no zone');
  t.ok(lines(timed).includes('DTSTAMP:20261016T120000Z'), 'the stamp is UTC from ctx.now()');
  t.ok(lines(timed).includes('UID:job-j1@searchdesk'), 'the UID is written');

  // ends
  t.ok(lines(timed).includes('DTEND:20261022T193000'), 'a timed entry with no end lasts 1 hour');
  const allDay = ics({ start: '2026-10-22', end: '' });
  t.ok(lines(allDay).includes('DTSTART;VALUE=DATE:20261022'), 'a date-only start is an all-day entry');
  t.ok(lines(allDay).includes('DTEND;VALUE=DATE:20261023'), 'an all-day entry ends the next day');
  const hourCross = ics({ start: '2026-10-22T23:30', end: '' });
  t.ok(lines(hourCross).includes('DTEND:20261023T003000'), 'a 1 hour end can cross midnight');
  const withEnd = ics({ start: '2026-10-22T10:00', end: '2026-10-22T11:30' });
  t.ok(lines(withEnd).includes('DTEND:20261022T113000'), 'a given end time is used');

  // text fields
  const full = ics({ start: '2026-10-22T10:00', title: 'Cook, line; day 2', where: '1 Main St', url: 'https://example.org/a' });
  t.ok(lines(full).includes('SUMMARY:Cook\\, line\\; day 2'), 'the title is escaped in the entry');
  t.ok(lines(full).includes('LOCATION:1 Main St'), 'the place is in the entry');
  t.ok(lines(full).includes('URL:https://example.org/a'), 'the link is in the entry');
  const bare = ics({ start: '2026-10-22', title: 'Plain' });
  t.ok(!bare.includes('LOCATION:') && !bare.includes('URL:'), 'empty place and link are left out');

  // bad dates
  t.eq(L.icsFor({ uid: 'x', title: 'x', start: '2026-02-30', now: now }), null, 'a date that does not exist gives null');
  t.eq(L.icsFor({ uid: 'x', title: 'x', start: 'soon', now: now }), null, 'a word instead of a date gives null');
  t.eq(L.icsFor({ uid: 'x', title: 'x', start: '', now: now }), null, 'an empty start gives null');

  // the slots exist
  t.ok(typeof f.strings.jobButton === 'string' && typeof f.strings.eventButton === 'string', 'both button labels are strings');
  t.ok(f.strings.noInterview === 'This job has no interview date yet.', 'the no-interview toast is the brief\'s words');
});
