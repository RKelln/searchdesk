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

  // ---- the board: one column per stage ----
  const D = '2026-10-16';
  const bj = (o) => Object.assign({ type: 'job', title: 'x', stage: 'saved' }, o);
  const cols = L.boardColumns([
    bj({ id: '1', title: 'Saved one', stage: 'saved' }),
    bj({ id: '2', title: 'Applied one', stage: 'applied', followUp: '2026-10-20' }),
    bj({ id: '3', title: 'Interview one', stage: 'interview', interviewAt: '2026-10-18T09:00' }),
    bj({ id: '4', title: 'Offer one', stage: 'offer' }),
    bj({ id: '5', title: 'Closed one', stage: 'closed' }),
    bj({ id: '6', title: 'Odd one', stage: 'waiting' }),
    bj({ id: '7', title: 'Gone', stage: 'saved', deleted: true }),
  ], D);
  t.eq(cols.map((c) => c.stage), ['saved', 'applied', 'interview', 'offer', 'closed', 'other'], 'the five stages in order, then Other when a job needs one');
  t.eq(cols[0].jobs.map((j) => j.id), ['1'], 'a deleted job is left out');
  t.eq(L.boardColumns([bj({ id: 'a', stage: 'saved' })], D).length, 5, 'with nothing odd there is no Other column');
  t.eq(L.boardColumns([], D).map((c) => c.jobs.length), [0, 0, 0, 0, 0], 'no jobs gives five empty columns');

  const sorted = L.boardSort([
    bj({ title: 'Zebra', stage: 'applied', followUp: '2026-10-18' }),
    bj({ title: 'Yak', stage: 'applied', followUp: '2026-10-25' }),
    bj({ title: 'Wolf', stage: 'applied' }),
    bj({ title: 'Ant', stage: 'applied', followUp: '2026-10-18' }),
  ], D);
  t.eq(sorted.map((j) => j.title), ['Ant', 'Zebra', 'Yak', 'Wolf'], 'soonest next date first, then title, and no date last');
  const sortIn = [bj({ title: 'B' }), bj({ title: 'A', followUp: '2026-10-17' })];
  L.boardSort(sortIn, D);
  t.eq(sortIn.map((j) => j.title), ['B', 'A'], 'sorting does not change the list it was given');

  const closedOld = bj({ id: 'o', stage: 'closed', updated: '2026-09-01T10:00:00Z' });
  const closedNew = bj({ id: 'n', stage: 'closed', updated: '2026-10-10T10:00:00Z' });
  t.eq(L.olderClosed([closedOld, closedNew, bj({ id: 'x', stage: 'saved', updated: '2026-01-01T00:00:00Z' })], D).map((j) => j.id), ['o'], 'a closed job older than 30 days is tucked away, and only closed ones count');
  t.eq(L.olderClosed([closedOld], 'not a date'), [], 'a bad today lists nothing');
  t.eq(L.olderClosed([closedOld], '2026-10-01'), [], 'exactly 30 days old is still shown');
  t.eq(L.olderClosed([closedOld], '2026-10-02').map((j) => j.id), ['o'], '31 days old is tucked away');
  t.eq(L.CLOSED_KEEP, 30, 'the board keeps 30 days of closed jobs');

  t.ok(f.strings.viewList && f.strings.viewBoard && f.strings.viewLabel, 'the list-or-board buttons have their words');
  t.ok(f.strings.boardNone && f.strings.stageOther && f.strings.showOlderClosed, 'the board has its words');

  // ---- finding a job by words ----
  const words = bj({ id: 'w', title: 'Line Cook', org: 'Baker Cafe', where: 'Toronto', notes: 'Assessment on the first day' });
  t.eq(L.searchText(words), 'line cook baker cafe toronto assessment on the first day', 'the words are the job, in one line');
  t.eq(L.searchText({ title: 'Only Title' }), 'only title', 'missing fields are simply not there');
  t.eq(L.searchText(null), '', 'no job is no words');
  t.eq(L.matches(words, ''), true, 'an empty search matches everything');
  t.eq(L.matches(words, '   '), true, 'so does whitespace');
  t.eq(L.matches(words, 'cook'), true, 'one word found');
  t.eq(L.matches(words, 'COOK'), true, 'case does not matter');
  t.eq(L.matches(words, 'cook toronto'), true, 'every word found, in any order');
  t.eq(L.matches(words, 'cook toronto bakery'), false, 'a word that is not there fails the whole search');
  t.eq(L.matches(words, 'assessment'), true, 'the notes are searched too');
  t.eq(L.matches(words, 'nonsense'), false, 'nothing found');
  t.eq(L.filterByText([words, bj({ id: 'z', title: 'Other' })], 'cook').map((j) => j.id), ['w'], 'only the matching job is kept');
  const kept = [words];
  t.eq(L.filterByText(kept, ''), kept, 'an empty search keeps them all');
  t.ok(L.filterByText(kept, '') !== kept, 'and gives back a new list, so nothing downstream edits it');
  t.eq(L.filterByText(undefined, 'x'), [], 'a missing list is empty, not a crash');
  t.eq(L.filterByText([words], 'cook').length, 1, 'one match out of one');

  // ---- late ----
  const late = bj({ id: 'l', stage: 'applied', followUp: '2026-09-01' });     // 45 days before D
  const justLate = bj({ id: 'j', stage: 'applied', followUp: '2026-09-25' }); // exactly 21
  const nearly = bj({ id: 'n', stage: 'applied', followUp: '2026-09-26' });  // 20
  t.eq(L.daysBefore('2026-10-16', '2026-10-16'), 0, 'a date is 0 days before today');
  t.eq(L.daysBefore('2026-09-25', '2026-10-16'), 21, '21 days');
  t.eq(L.daysBefore('2026-10-17', '2026-10-16'), -1, 'a date after today is a negative number of days');
  t.eq(L.daysBefore('nope', '2026-10-16'), null, 'a bad date is null, not NaN');
  t.eq(L.daysBefore('2026-10-16', 'nope'), null, 'a bad today is null too');
  t.eq(L.isLate(late, D), true, 'a follow-up 45 days past is late, with no number given');
  t.eq(L.isLate(justLate, D), true, 'exactly at the threshold counts');
  t.eq(L.isLate(nearly, D), false, 'one day short does not');
  t.eq(L.isLate(nearly, D, 20), true, 'unless the person chose a shorter wait');
  t.eq(L.isLate(late, D, 90), false, 'a longer wait hides it again');
  t.eq(L.isLate(bj({ id: 'c', stage: 'closed', followUp: '2026-01-01' }), D), false, 'a closed job is never late');
  t.eq(L.isLate(bj({ id: 'g', stage: 'applied' }), D), false, 'no date cannot be late');
  t.eq(L.isLate(bj({ id: 'i', stage: 'applied', followUp: '2026-01-01', deleted: true }), D), false, 'a deleted job is not late');
  t.eq(L.isLate(bj({ id: 'iv', stage: 'interview', interviewAt: '2026-01-01' }), D), false, 'an interview date is not the person being late');
  t.eq(L.isLate(late, 'not a date'), false, 'a bad today marks nothing late');
  t.eq(L.isLate(null, D), false, 'no job is not late');
  t.eq(L.LATE_AFTER, 21, 'the default wait is three weeks');
  t.ok(f.strings.lateBadge && f.strings.lateWhy && f.strings.lateAfterLabel, 'the late mark has its words');
  t.ok(f.strings.lateWeeks2 && f.strings.lateWeeks3 && f.strings.lateMonth1, 'the three choices have their words');
  t.ok(f.strings.searchLabel && f.strings.searchHint, 'the find-a-job box has its words');
});
