// checks/recipe-coach.check.js
Desk.check('recipe-coach', (t, f) => {
  const L = f.logic;
  t.eq(f.id, 'recipe-coach', 'the feature has its id');
  t.eq(f.types, [], 'it owns no record types');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  // ---- the cap: at most 1,500 characters for every combination of options ----
  const combos = L.allOptions();
  const sizes = combos.map((o) => L.instructions(o).length);
  const max = Math.max.apply(null, sizes), min = Math.min.apply(null, sizes);
  t.eq(combos.length, 2 * 4 * 2 * (1 + L.LANGUAGES.length), 'every combination of the options is tried');
  t.ok(max <= L.CAP, 'the instructions are at most ' + L.CAP + ' characters for every combination (longest ' + max + ', shortest ' + min + ')');
  t.eq(L.CAP, 1500, 'the cap is 1,500');
  t.eq(L.instructions({}).length, 1481, 'the default instructions are the 1,481 characters of prompt v4');
  t.ok(L.instructions().endsWith('Invent no facts.\n'), 'the instructions end with v4\'s last sentence and a newline');
  t.ok(!/[^\x00-\x7f]/.test(L.instructions({ language: 'Persian' })), 'the instructions are plain ASCII (characters = bytes)');
  t.ok(L.LANGUAGES.every((n) => n.length <= 8), 'language names stay short enough to fit');

  // ---- the order, and research off ----
  const on = L.instructions({ research: 'on' }), off = L.instructions({ research: 'off' });
  t.ok(on.indexOf('If search is available') < on.indexOf('Ask 3 main questions'), 'research comes before the interview');
  t.ok(on.indexOf('Ask 3 main questions') < on.indexOf('switch to coach'), 'the interview comes before the feedback');
  t.ok(on.indexOf('search') >= 0 && on.indexOf('employer') >= 0, 'with research on, the research step is there');
  t.ok(off.indexOf('search') < 0 && off.indexOf('employer') < 0 && off.indexOf('research') < 0, 'with research off, the research step is gone');
  t.ok(off.startsWith('Run a mock interview') && off.indexOf('\n\n\n') < 0 && off.indexOf('details.\n\nAsk 3 main') > 0, 'with research off, no gap is left');
  t.ok(off.length < on.length - 150, 'with research off the instructions are shorter');

  // ---- the other options replace words inside v4's sentences ----
  const five = L.instructions({ questions: '5' });
  t.ok(five.indexOf('Ask 5 main questions') >= 0 && five.indexOf('After 5 questions and follow-ups') >= 0 && five.length === 1481, 'five questions changes two digits only');
  t.ok(five.indexOf('At most one follow-up per main question') > 0, 'the follow-up rule stays');
  const beh = L.instructions({ kind: 'behavioural' });
  t.ok(beh.indexOf('each asking for a past example') > 0 && beh.indexOf('at least one past example') < 0, 'behavioural questions all ask for a past example');
  t.eq(L.instructions({ language: 'French' }).indexOf('never my own details. Reply in French.\n\n'), L.instructions().indexOf('never my own details.\n\n'), 'a language adds one short sentence to the first paragraph');
  t.eq(L.options({ kind: 'x', questions: '9', research: 'maybe', language: 'Klingon' }), { kind: 'general', questions: '3', research: 'on', language: '' }, 'unknown option values become the defaults');
  t.eq(L.fill('{a} {b}', { a: '{b}', b: 'x' }), '{b} x', 'filling is one pass');
  t.ok(L.fullTemplate().indexOf('{context}') > 0 && L.fullTemplate().startsWith(L.TEMPLATE), 'the template is the instructions then the context');

  // ---- the context ----
  const job = { type: 'job', id: 'j_1', title: 'Office Administrator', org: 'Kingsway Dental Group', where: 'Scarborough', stage: 'interview',
    asks: 'QuickBooks; scheduling', posting: 'x'.repeat(5000), notes: 'SECRET-NOTE-TEXT', nextStep: 'SECRET-NEXT', link: 'https://example.com/secret-link', tags: ['SECRET-TAG'] };
  const ctxText = L.contextText({ profile: ['What work: Office administration', 'Field: Finance'], job });
  t.ok(ctxText.startsWith('---\n\nCandidate profile:\nWhat work: Office administration\nField: Finance\n\nJob posting:\nJob title: Office Administrator\n'), 'the context has the two labelled blocks below a line');
  t.ok(ctxText.indexOf('Employer: Kingsway Dental Group') > 0 && ctxText.indexOf('Where: Scarborough') > 0 && ctxText.indexOf('Stage: interview') > 0 && ctxText.indexOf('What they ask for: QuickBooks; scheduling') > 0, 'the job facts are there');
  t.ok(!/SECRET/.test(ctxText), 'the context never includes notes, the next step, tags or the link');
  t.eq(ctxText.split('Posting text:\n')[1].length, 4000, 'the posting is cut to 4,000 characters');
  t.eq(L.cutPosting('a'.repeat(3999) + '😀').length, 3999, 'a cut never splits an emoji');
  t.eq(L.contextText({ profile: [], job: null }), '', 'no profile and no job gives no context');
  t.ok(L.contextText({ profile: [], job: { title: 'Clerk' } }).startsWith('---\n\nJob posting:\nJob title: Clerk'), 'a job without a profile still gives the job block');
  t.ok(L.contextText({ profile: ['Field: X'], job: null }).indexOf('Job posting:') < 0, 'no job means no Job posting block');
  const withStory = L.contextText({ profile: [], stories: [{ title: 'Fixed a backlog', text: 'I cleared 40 invoices.', notes: 'SECRET' }], job: null });
  t.ok(withStory.indexOf('Example from my work: Fixed a backlog: I cleared 40 invoices.') > 0 && withStory.indexOf('SECRET') < 0, 'stories are added to the profile block, without their notes');
  t.eq(L.contextText({ profile: [], stories: Array.from({ length: 9 }, (_, i) => ({ title: 'S' + i })), job: null }).split('Example from my work').length - 1, 5, 'at most five stories');

  // ---- what the recipe does, through mount with a stand-in ctx ----
  const recipes = [], slots = [], went = [], noString = [];
  const records = { j_1: job, n_1: { type: 'note', id: 'n_1' } };
  const fake = {
    recipe: (d) => recipes.push(d), slot: (n, d) => slots.push({ n, d }),
    t: (k) => { if (typeof f.strings[k] !== 'string') noString.push(k); return f.strings[k]; },
    ui: { go: (to) => went.push(to) },
  };
  f.mount(fake);
  const def = recipes[0];
  t.eq(recipes.length, 1, 'it registers one recipe');
  t.eq(def.id, 'coach', 'the recipe is "coach" (the address is #ai/coach/<jobId>)');
  t.eq(def.answer, null, 'no answer is read back');
  t.eq(def.options.map((o) => o.id), ['kind', 'questions', 'research', 'language'], 'four options');
  t.ok(def.options.every((o) => o.choices.some((c) => String(c.value) === String(o.default))), 'every default is one of its choices');
  t.eq(Desk.prompt.missingPlaceholders(def.template, def.placeholders), [], 'every placeholder in the template is described');
  t.eq(Desk.prompt.absentPlaceholders(def.template, def.placeholders), [], 'every described placeholder is used');
  t.ok(def.tips.length >= 2 && def.tips.join(' ').indexOf('voice') >= 0 && def.tips.join(' ').indexOf('Keep these instructions') >= 0, 'the voice and keep-these-instructions tips are there');
  t.eq(def.copies[0].text(null, { options: {} }), L.instructions({}), '"Copy only the instructions" copies the instructions alone');
  t.ok(def.copies[0].text(null, { options: {} }).indexOf('Job posting') < 0, 'and none of the context');
  t.eq(slots.length, 1, 'it adds one slot');
  t.eq(slots[0].n, 'job.actions', 'the slot is job.actions');
  t.eq(slots[0].d.label, 'Practise an interview for this job', 'the button says what it does');
  slots[0].d.run(job);
  t.eq(went, ['ai/coach/j_1'], 'the button opens the coach for that job');

  const rc = (route) => ({
    store: { get: (id) => records[id] || null, all: () => [{ title: 'A story', text: 'Told it.', notes: 'SECRET' }] },
    profileLines: () => ['What work: Clerk'], route: () => ({ tab: 'ai', args: route }),
  });
  t.eq(def.needs(rc(['coach'])), [], 'no job in the address is fine (the AI asks for the posting)');
  t.eq(def.needs(rc(['coach', 'j_1'])), [], 'a job that exists is fine');
  t.eq(def.needs(rc(['coach', 'j_gone'])).length, 1, 'a missing job gives a message');
  t.eq(def.needs(rc(['coach', 'n_1'])).length, 1, 'an id that is not a job gives a message');
  t.eq(noString, [], 'every ctx.t key is a real string');
  const data = def.data(rc(['coach', 'j_1']), { options: {}, args: ['j_1'] });
  t.ok(data.context.indexOf('Job title: Office Administrator') > 0 && data.context.indexOf('What work: Clerk') > 0 && data.context.indexOf('A story: Told it.') > 0, 'data brings the profile, a story and the job');
  t.ok(!/SECRET/.test(JSON.stringify(data)), 'data never includes notes');
  t.eq(def.data(rc(['coach']), { options: {}, args: [] }).context.indexOf('Job posting:'), -1, 'no job id means no job block');
  const built = Desk.prompt.build({ id: 'coach', template: def.template, answer: null, budget: def.budget }, data, { code: '2222', now: 0 });
  t.ok(built.text.indexOf(L.instructions({}).replace(/\n$/, '')) > 0, 'the whole question carries the instructions exactly');
  t.ok(built.text.indexOf('Invent no facts.\n\n---\n\nCandidate profile:\nWhat work: Clerk') > 0, 'the context follows the instructions below a line');
  t.eq(built.missing, [], 'nothing is left as {name}');
  t.ok(built.text.indexOf('HOW TO ANSWER') < 0, 'there is no answer block');
});
