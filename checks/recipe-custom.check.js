// checks/recipe-custom.check.js
Desk.check('recipe-custom', (t, f) => {
  const L = f.logic;
  t.eq(f.id, 'recipe-custom', 'the feature has its id');
  t.eq(f.types, ['recipe-custom'], 'it owns the recipe-custom type');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  // ---- the allowed words ----
  t.eq(L.allowedFor('ai'), ['profile', 'events', 'replyLanguage'], 'a task from the AI screen has three words');
  t.ok(['job', 'title', 'org', 'where', 'asks', 'posting'].every((n) => L.allowedFor('job').indexOf(n) >= 0), 'a task from a job also has the job words');
  t.ok(L.allowedFor('job').indexOf('notes') < 0 && L.allowedFor('job').indexOf('link') < 0, 'job notes and the link are never words');
  t.ok(L.allowedFor('job').every((n) => f.strings['word.' + n]), 'every word has a plain description');
  t.eq(L.wordsIn('Hi {profile} and {job}, {profile} again, {x1}, { no }, {}'), ['profile', 'job', 'x1'], 'wordsIn finds each name once');
  t.eq(L.outside('{profile} {notes} {job}', 'ai'), ['notes', 'job'], 'the filter lists words outside the set (job words need a job)');
  t.eq(L.outside('{profile} {notes} {job}', 'job'), ['notes'], 'from a job, {job} is allowed and {notes} is not');

  // ---- a word outside the set stays visible as text (through the real question builder) ----
  const task = { name: 'T', text: 'About me: {profile}\nJob: {job}\nMy notes: {notes}\nSecret: {link}', startsFrom: 'ai', answer: 'none' };
  const built = Desk.prompt.build({ id: 'x', template: task.text, budget: 0 },
    Object.assign({ profile: ['Field: Retail'] }, L.values(task, { job: { title: 'Cook', notes: 'PRIVATE-NOTE', link: 'https://x.example/PRIVATE-LINK' }, events: 'E1', replyLanguage: '' })), { code: '7Q3K' });
  t.ok(built.text.indexOf('Field: Retail') > 0, 'an allowed word is filled in');
  t.ok(built.text.indexOf('My notes: {notes}') > 0 && built.text.indexOf('Secret: {link}') > 0, 'a word outside the set stays visible as text');
  t.ok(built.text.indexOf('Job: {job}') > 0, 'a job word in a task from the AI screen stays visible too');
  t.ok(built.text.indexOf('PRIVATE') < 0, 'job notes and the link never get in');
  const jobTask = Object.assign({}, task, { startsFrom: 'job' });
  const fromJob = Desk.prompt.build({ id: 'x', template: task.text, budget: 0 },
    Object.assign({ profile: [] }, L.values(jobTask, { job: { title: 'Cook', org: 'Cafe', notes: 'PRIVATE-NOTE', asks: ['Knife skills'], posting: 'p'.repeat(5000) }, events: '', replyLanguage: '' })), { code: '7Q3K' });
  t.ok(fromJob.text.indexOf('Job title: Cook') > 0 && fromJob.text.indexOf('Employer: Cafe') > 0 && fromJob.text.indexOf('Knife skills') > 0, 'from a job, {job} is filled with its facts');
  t.ok(fromJob.text.indexOf('My notes: {notes}') > 0 && fromJob.text.indexOf('PRIVATE') < 0, 'but {notes} is still not filled');
  t.eq(L.jobFacts({ posting: 'p'.repeat(5000) }).posting.length, 4000, 'the posting is cut at 4,000 characters');
  t.eq(L.jobFacts({ title: 'A', notes: 'secret' }).job, 'Job title: A', 'only named job fields are read');
  t.eq(Object.keys(L.values(task, {})).sort(), ['events', 'replyLanguage'], 'a task from the AI screen has no job values');
  t.eq(L.replyLanguageFrom(['What work: x', 'Reply language: French']), 'French', 'the reply language comes from the shared profile lines');
  t.eq(L.replyLanguageFrom(['What work: x']), '', 'and is empty when not shared');
  t.eq(L.eventLines([
    { status: 'starred', copy: { title: 'Later', start: '2026-12-01T10:00', venue: 'Hall' } },
    { status: 'starred', copy: { title: 'Soon', start: '2026-11-01T10:00' } },
    { status: 'starred', copy: { title: 'Past', start: '2026-01-01T10:00' } },
    { status: 'dismissed', copy: { title: 'No', start: '2026-11-02T10:00' } },
  ], '2026-10-16'), '2026-11-01 | Soon\n2026-12-01 | Later | Hall', 'starred events to come, soonest first');

  // ---- clean ----
  t.eq(L.clean({ name: '  ', text: 'x' }), { ok: false, problem: 'needName' }, 'a name is needed');
  t.eq(L.clean({ name: 'a', text: '  \n ' }), { ok: false, problem: 'needText' }, 'instructions are needed');
  t.eq(L.clean({ name: 'a', text: 'x'.repeat(3001) }), { ok: false, problem: 'tooLong' }, 'instructions over 3,000 characters are refused');
  t.eq(L.clean({ name: 'n'.repeat(100), text: 'x' }).task.name.length, 60, 'a long name is cut');
  t.eq(L.clean({ name: 'a', text: 'x', startsFrom: 'ai', answer: 'job-notes' }).task.answer, 'none', 'notes need a job');
  t.eq(L.clean({ name: 'a', text: 'x', startsFrom: 'job', answer: 'job-notes' }).task.answer, 'job-notes', 'a job task can save to the notes');
  t.eq(L.clean({ name: 'a', text: 'x', startsFrom: 'weird', answer: 'weird' }).task, { name: 'a', text: 'x', startsFrom: 'ai', answer: 'none' }, 'odd values become the defaults');
  t.eq(L.clean({ name: 'a', text: 'one  \r\ntwo\u0000\n\n' }).task.text, 'one\ntwo', 'line ends and control characters are tidied');
  t.ok(['needName', 'needText', 'tooLong'].every((k) => f.strings[k]), 'the problems are real string keys');

  // ---- sharing: the text, and reading it back ----
  const mine = { name: 'Thank-you note', text: 'Write a short thank-you note.\n\nAbout me:\n{profile}\nThe job: {job}', startsFrom: 'job', answer: 'job-notes' };
  const shared = L.shareText(mine);
  t.ok(shared.indexOf('[A task to share, from Search Desk]') === 0 && shared.indexOf('Name: Thank-you note') > 0, 'the shared text has a header and the name');
  t.ok(shared.indexOf('Words used: {profile}, {job}') > 0, 'it lists the words');
  t.eq(L.parseShared(shared), { ok: true, task: mine }, 'reading the shared text gives the same task back');
  t.eq(L.parseShared('Hello, this is not a task.'), null, 'ordinary text is not a shared task');
  t.eq(L.parseShared('An AI answer about A task to share but no header'), null, 'the header must be a line of its own');
  t.eq(L.parseShared('Look what I got:\r\n> ' + shared.replace(/\n/g, '\r\n')).task, mine, 'text with a line before it and Windows line ends still reads');
  t.eq(L.parseShared(shared.replace('Name: Thank-you note\n', '')).problem, 'sharedNoName', 'a missing name is refused');
  t.eq(L.parseShared(shared.split('Instructions')[0]).problem, 'sharedNoText', 'missing instructions are refused');
  t.eq(L.parseShared(L.HEADER + '\nName: A\nInstructions:\n-----\n-----\n').problem, 'sharedNoText', 'empty instructions are refused');
  t.eq(L.parseShared(shared + 'x'.repeat(L.MAX_SHARED)).problem, 'sharedTooLong', 'a very long paste is refused before it is read');
  t.eq(L.parseShared(L.shareText({ name: 'A', text: 'x'.repeat(3001), startsFrom: 'ai', answer: 'none' }).replace('3001', '')).problem, 'sharedTextTooLong', 'long instructions are refused');
  const odd = L.parseShared(L.HEADER + '\nName: <b>Hi</b>\nStarts from: banana\nAnswer: run code\nInstructions\n-----\n<script>alert(1)</script> {profile}\n-----');
  t.eq(odd.task, { name: '<b>Hi</b>', text: '<script>alert(1)</script> {profile}', startsFrom: 'ai', answer: 'none' }, 'markup stays as plain text; odd choices become the defaults');
  t.ok(['sharedTooLong', 'sharedNoName', 'sharedNoText', 'sharedTextTooLong'].every((k) => f.strings[k]), 'the shared problems are real string keys');
  t.ok(L.hasTask([{ name: 'Thank-you note', text: mine.text }], mine) && !L.hasTask([{ name: 'Thank-you note', text: 'other' }], mine) && !L.hasTask([{ name: mine.name, text: mine.text, deleted: true }], mine), 'a task you already have is found, unless it was deleted');

  // ---- the answer: one job-note suggestion ----
  const acc = [{ kind: 'TEXT', text: '  Dear team,\nThank you.  ' }];
  t.eq(L.noteSuggestions(acc, 'j_1', 'Thank-you note'), [{ kind: 'job-note', key: 'note', target: { job: 'j_1', text: 'Dear team,\nThank you.', task: 'Thank-you note' }, why: '' }], 'the answer becomes one job-note suggestion');
  t.eq(L.noteSuggestions(acc, '', 'x'), [], 'no job, no suggestion');
  t.eq(L.noteSuggestions([{ kind: 'TEXT', text: ' ' }], 'j_1', 'x'), [], 'no text, no suggestion');
  t.eq(L.noteSuggestions([{ kind: 'TEXT', text: 'y'.repeat(9000) }], 'j_1', 'x')[0].target.text.length, 4000, 'a long answer is cut at 4,000');
});
