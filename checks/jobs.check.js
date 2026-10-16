// checks/jobs.check.js
Desk.check('jobs', (t, f) => {
  const L = f.logic;
  const TODAY = '2026-10-16';
  const mk = (o) => Object.assign({ type: 'job', title: 'T', stage: 'saved', updated: '2026-10-01T10:00:00Z' }, o);

  t.eq(f.id, 'jobs', 'the feature has its id');
  t.eq(f.types, ['job', 'suggestion'], 'it owns the job type, and suggestions (to take a job draft)');
  t.ok(typeof f.mount === 'function', 'it has a mount function');
  t.eq(L.STAGES, ['saved', 'applied', 'interview', 'offer', 'closed'], 'the five stages');

  // dates
  t.ok(L.isDate('2026-02-28') && !L.isDate('2026-02-30') && !L.isDate('26-1-1') && !L.isDate(''), 'isDate checks the calendar');
  t.ok(L.isDateTime('2026-10-20T09:30') && L.isDateTime('2026-10-20') && !L.isDateTime('2026-10-20T25:00') && !L.isDateTime('2026-10-20T9:30'), 'isDateTime takes a date or date and HH:MM');
  t.eq(L.dateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05', 'dateKey uses the local date');
  t.eq(L.daysBetween('2026-10-16', '2026-10-17'), 1, 'daysBetween: tomorrow is 1');
  t.eq(L.daysBetween('2026-10-16', '2026-10-09T10:00'), -7, 'daysBetween: a week ago is -7');
  t.eq(L.daysBetween('2026-10-24', '2026-11-02'), 9, 'daysBetween crosses a month');

  // nextDate
  t.eq(L.nextDate(mk({ stage: 'saved', closes: '2026-10-20' }), TODAY), { kind: 'closes', date: '2026-10-20' }, 'saved: closes');
  t.eq(L.nextDate(mk({ stage: 'saved', closes: '2026-10-10' }), TODAY), null, 'saved: a closed posting is not shown');
  t.eq(L.nextDate(mk({ stage: 'saved', closes: '2026-10-20', followUp: '2026-10-18' }), TODAY).kind, 'followUp', 'saved: the sooner of follow-up and closes');
  t.eq(L.nextDate(mk({ stage: 'applied', followUp: '2026-10-10' }), TODAY), { kind: 'followUp', date: '2026-10-10' }, 'applied: an overdue follow-up is shown');
  t.eq(L.nextDate(mk({ stage: 'applied', followUp: '2026-10-30', interviewAt: '2026-10-22T10:00' }), TODAY).kind, 'interview', 'applied: an interview sooner than the follow-up wins');
  t.eq(L.nextDate(mk({ stage: 'applied', closes: '2026-10-20' }), TODAY), null, 'applied: closes does not count');
  t.eq(L.nextDate(mk({ stage: 'interview', interviewAt: '2026-10-16T09:00' }), TODAY), { kind: 'interview', date: '2026-10-16T09:00' }, 'interview: today counts');
  t.eq(L.nextDate(mk({ stage: 'interview', interviewAt: '2026-10-15T09:00' }), TODAY), null, 'interview: one that has passed is not shown');
  t.eq(L.nextDate(mk({ stage: 'interview', interviewAt: '2026-10-15', followUp: '2026-10-17' }), TODAY).kind, 'followUp', 'interview: falls to the follow-up');
  t.eq(L.nextDate(mk({ stage: 'offer', followUp: '2026-10-20', closes: '2026-10-18' }), TODAY).kind, 'followUp', 'offer: follow-up only');
  t.eq(L.nextDate(mk({ stage: 'closed', followUp: '2026-10-20' }), TODAY), null, 'closed: nothing');
  t.eq(L.nextDate(mk({ stage: 'applied', followUp: 'soon' }), TODAY), null, 'a bad date is ignored');
  t.eq(L.nextDate(mk({ stage: 'weird', followUp: '2026-10-20' }), TODAY), null, 'an unknown stage gives nothing');

  // sort
  const list = [
    mk({ title: 'Closed one', stage: 'closed', updated: '2026-10-15T00:00:00Z' }),
    mk({ title: 'No date old', updated: '2026-09-01T00:00:00Z' }),
    mk({ title: 'Later', stage: 'applied', followUp: '2026-10-30' }),
    mk({ title: 'No date new', updated: '2026-10-10T00:00:00Z' }),
    mk({ title: 'Overdue', stage: 'applied', followUp: '2026-10-01' }),
    mk({ title: 'Soon', stage: 'interview', interviewAt: '2026-10-18T14:00' }),
  ];
  const copy = list.map((j) => j.title);
  t.eq(L.sortJobs(list, TODAY).map((j) => j.title), ['Overdue', 'Soon', 'Later', 'No date new', 'No date old', 'Closed one'],
    'dated jobs first (overdue on top), then the rest newest first, then closed');
  t.eq(list.map((j) => j.title), copy, 'sorting does not change the list it was given');
  t.eq(L.sortJobs([], TODAY), [], 'an empty list stays empty');
  t.eq(L.sortJobs([mk({ title: 'b', stage: 'applied', followUp: '2026-10-20T10:00' }), mk({ title: 'a', stage: 'applied', followUp: '2026-10-20' })], TODAY).map((j) => j.title),
    ['a', 'b'], 'same day: ties go by the full text, then title');

  // filter and counts
  t.eq(L.filterByStage(list, 'applied').map((j) => j.title), ['Later', 'Overdue'], 'filter by stage');
  t.eq(L.filterByStage(list, 'all').length, 6, 'all shows everything');
  t.ok(L.filterByStage(list, 'all') !== list, 'filter returns a new list');
  t.eq(L.stageCounts(list), { all: 6, saved: 2, applied: 2, interview: 1, offer: 0, closed: 1 }, 'counts per stage');
  t.eq(L.stageCounts([mk({ stage: 'odd' })]), { all: 1, saved: 0, applied: 0, interview: 0, offer: 0, closed: 0 }, 'an odd stage counts only in all');

  // stage patch
  t.eq(L.stagePatch(mk({}), 'applied', TODAY), { stage: 'applied', applied: TODAY }, 'applied sets the applied date');
  t.eq(L.stagePatch(mk({ applied: '2026-10-01' }), 'applied', TODAY), { stage: 'applied' }, 'an existing applied date is kept');
  t.eq(L.stagePatch(mk({}), 'offer', TODAY), { stage: 'offer' }, 'other stages change only the stage');

  // cleanJob
  t.eq(L.cleanJob({ title: '   ' }), { ok: false, problem: 'needTitle' }, 'a blank title is refused');
  t.eq(L.cleanJob({}), { ok: false, problem: 'needTitle' }, 'no title is refused');
  t.ok(f.strings[L.cleanJob({}).problem], 'the problem is a real string key');
  const r = L.cleanJob({ title: ' Cook ', link: 'https://example.com/a', stage: 'applied', followUp: '2026-11-02', interviewDate: '2026-11-05', interviewTime: '14:30', notes: ' hi ' });
  t.ok(r.ok && r.warnings.length === 0, 'a good job is ok');
  t.eq(r.job.title, 'Cook', 'the title is trimmed');
  t.eq(r.job.interviewAt, '2026-11-05T14:30', 'the interview date and time are joined');
  t.eq(r.job.notes, 'hi', 'notes are trimmed');
  t.eq(r.job.stage, 'applied', 'the stage is kept');
  t.eq(L.cleanJob({ title: 'x', interviewDate: '2026-11-05' }).job.interviewAt, '2026-11-05', 'a date with no time is fine');
  t.eq(L.cleanJob({ title: 'x', interviewTime: '14:30' }).job.interviewAt, '', 'a time with no date is dropped');
  t.eq(L.cleanJob({ title: 'x', interviewDate: '2026-11-05', interviewTime: '99:99' }).job.interviewAt, '2026-11-05', 'a bad time is dropped');
  t.eq(L.cleanJob({ title: 'x' }).job.stage, 'saved', 'the stage defaults to saved');
  t.eq(L.cleanJob({ title: 'x', stage: 'nope' }).job.stage, 'saved', 'an unknown stage becomes saved');
  t.eq(L.cleanJob({ title: 'x', applied: '2026-02-30' }).job.applied, '', 'an impossible date is dropped');
  const bad = L.cleanJob({ title: 'x', link: 'javascript:alert(1)' });
  t.eq(bad.job.link, '', 'a javascript link is dropped');
  t.eq(bad.warnings, ['linkDropped'], 'and a warning is given');
  t.ok(f.strings.linkDropped && f.strings.savedNoLink, 'the link messages exist');
  t.eq(L.cleanJob({ title: 'x', link: 'example.com' }).warnings, ['linkDropped'], 'a link with no https:// is dropped');
  t.eq(L.cleanJob({ title: 'x', link: 'HTTP://example.com' }).job.link, 'HTTP://example.com', 'http is allowed');
  t.eq(L.cleanJob({ title: 'x', link: '' }).warnings, [], 'no link, no warning');
  t.eq(L.cleanJob({ title: 'y'.repeat(500) }).job.title.length, 200, 'the title is cut at 200');

  // applyForm
  const merged = L.applyForm({ id: 'j_1', type: 'job', title: 'Old', org: 'Acme', tags: ['a'], posting: 'p', asks: ['x'], ext: { z: 1 } },
    L.cleanJob({ title: 'New', org: '' }).job);
  t.eq(merged.title, 'New', 'the form changes the title');
  t.ok(!('org' in merged), 'an emptied field is removed');
  t.eq(merged.tags, ['a'], 'tags are kept');
  t.eq([merged.posting, merged.asks, merged.ext, merged.id], ['p', ['x'], { z: 1 }, 'j_1'], 'posting, asks, ext and id are kept');
  t.eq(L.applyForm(null, L.cleanJob({ title: 'N' }).job).type, 'job', 'a new record gets the job type');
  t.ok(!('link' in L.applyForm(null, L.cleanJob({ title: 'N' }).job)), 'empty fields are not stored on a new record');

  t.eq(L.splitInterview('2026-11-05T14:30'), { date: '2026-11-05', time: '14:30' }, 'splitInterview with time');
  t.eq(L.splitInterview('2026-11-05'), { date: '2026-11-05', time: '' }, 'splitInterview without time');
  t.eq(L.splitInterview(undefined), { date: '', time: '' }, 'splitInterview of nothing');
  t.eq(L.lines(['a', '', 'b']), ['a', 'b'], 'lines from a list');
  t.eq(L.lines('x'), ['x'], 'lines from text');
  t.eq(L.lines(undefined), [], 'lines from nothing');

  // job drafts (T3.5)
  const sug = (id, status, updated, kind) => ({ type: 'suggestion', id: id, kind: kind || 'job-draft', status: status, updated: updated });
  t.eq(L.drafts([sug('a', 'new', '1'), sug('b', 'taken', '2'), sug('c', 'new', '3'), sug('d', 'new', '4', 'event'), { type: 'suggestion', id: 'e', kind: 'job-draft', status: 'new', deleted: true }]).map((x) => x.id),
    ['c', 'a'], 'only new job drafts are listed, newest first');
  t.eq(L.draftToForm({ title: 'T', org: 'O', where: 'W', link: 'https://x.org', closes: '2026-11-02', notes: 'N', posting: 'P' }),
    { title: 'T', org: 'O', where: 'W', link: 'https://x.org', closes: '2026-11-02', notes: 'N' }, 'a draft fills the form fields');
  t.eq(L.draftToForm({ title: 'T', closes: 'unknown' }).closes, '', 'a closing date that is not a date is left out');
  t.eq(L.draftToForm(null).title, '', 'no draft gives an empty form');
  t.eq(L.draftExtras({ posting: ' text ', asks: ['a', '', 'b'] }), { posting: 'text', asks: ['a', 'b'] }, 'the posting and asks are kept');
  t.eq(L.draftExtras({ posting: 'x'.repeat(9000) }).posting.length, 8000, 'the posting is cut at 8,000');
  t.eq(L.draftExtras({ title: 'T' }), {}, 'nothing extra when the draft has none');
  t.ok(f.strings.takeIt && f.strings.notForMe && f.strings.draftsHeading, 'the draft lane has its words');
  // ---- answers for the notes (T3.8): a dated append ----
  t.eq(L.appendNote('', 'Dear team,\nThank you.', '2026-10-18'), { ok: true, notes: 'AI answer, 2026-10-18:\nDear team,\nThank you.' }, 'empty notes get the dated answer');
  t.eq(L.appendNote('Call Sam.  \n', ' Be brief. ', '2026-10-18').notes, 'Call Sam.\n\nAI answer, 2026-10-18:\nBe brief.', 'it goes after the old notes, after a blank line');
  t.eq(L.appendNote('a', 'b', 'not a date').notes, 'a\n\nAI answer, today:\nb', 'a bad date says "today"');
  t.eq(L.appendNote('a', '   ', '2026-10-18').ok, false, 'an empty answer adds nothing');
  const full = L.appendNote('n'.repeat(4900), 'x'.repeat(500), '2026-10-18');
  t.ok(full.ok && full.notes.length <= 5000 && full.notes.endsWith('…'), 'a long answer is cut so the notes stay within 5,000 characters');
  t.eq(L.appendNote('n'.repeat(4990), 'x'.repeat(500), '2026-10-18'), { ok: false, problem: 'noteNoRoom' }, 'with no room nothing is added');
  t.ok(f.strings.noteNoRoom && f.strings.noteAdd && f.strings.notesReadyHeading, 'the note lane has its words');
  const sg = (o) => Object.assign({ type: 'suggestion', kind: 'job-note', status: 'new', updated: '1', target: { job: 'j1', text: 'hi' } }, o);
  t.eq(L.readyNotes([sg({ id: 'a' }), sg({ id: 'b', status: 'taken' }), sg({ id: 'c', target: { job: 'j2', text: 'x' } }), sg({ id: 'd', kind: 'job-draft' }), sg({ id: 'e', deleted: true }), sg({ id: 'f', target: { job: 'j1', text: ' ' } })], 'j1').map((x) => x.id), ['a'], 'only new job-note suggestions for that job are listed');
});
