// checks/recipe-coach.check.js
Desk.check('recipe-coach', (t, f) => {
  const L = f.logic;
  t.eq(f.id, 'recipe-coach', 'the feature has its id');
  t.eq(f.types, [], 'it owns no record types');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  // ---- the cap: at most 1,500 characters for every combination of options, in both modes ----
  const combos = L.allOptions();
  t.eq(combos.length, 2 * 4 * 2 * (1 + L.LANGUAGES.length), 'every combination of the options is tried');
  t.eq(L.CAP, 1500, 'the cap is 1,500');
  [['workshop', true], ['normal', false]].forEach((m) => {
    const sizes = combos.map((o) => L.instructions(o, m[1]).length);
    const max = Math.max.apply(null, sizes), min = Math.min.apply(null, sizes);
    t.ok(max <= L.CAP, m[0] + ': at most ' + L.CAP + ' characters for every combination (default ' + L.instructions({}, m[1]).length + ', longest ' + max + ', shortest ' + min + ')');
  });
  t.eq(L.instructions({}, true).length, 1481, 'workshop default: the 1,481 characters of prompt v4');
  t.eq(L.instructions({}, true), L.instructions({ kind: 'general', questions: '3', research: 'on', language: '' }, true), 'workshop default is 3 questions');
  t.eq(L.instructions({}, false), L.instructions({ questions: '5' }, false), 'normal default is 5 questions');
  t.ok(L.instructions({}, false).indexOf('Ask 5 main questions') > 0 && L.instructions({}, false).indexOf('After 5 questions') > 0, 'normal default says 5');
  t.ok(L.instructions({}, true).indexOf('Workshops: fictional person only, never my own details.') > 0, 'the workshop sentence is there in workshop mode');
  t.ok(L.instructions({}, false).indexOf('Workshop') < 0 && L.instructions({ questions: '3' }, false).indexOf('fictional') < 0, 'and not in a normal copy');
  t.ok(L.instructions({}, true).endsWith('Invent no facts.\n'), 'the instructions end with v4\'s last sentence and a newline');
  t.ok(!/[^\x00-\x7f]/.test(L.instructions({ language: 'Persian' }, true)), 'the instructions are plain ASCII (characters = bytes)');
  t.ok(L.LANGUAGES.every((n) => n.length <= 8), 'language names stay short enough to fit');

  // ---- the order, and research off ----
  const on = L.instructions({ research: 'on' }, true), off = L.instructions({ research: 'off' }, true);
  t.ok(on.indexOf('If search is available') < on.indexOf('Ask 3 main questions'), 'research comes before the interview');
  t.ok(on.indexOf('Ask 3 main questions') < on.indexOf('switch to coach'), 'the interview comes before the feedback');
  t.ok(on.indexOf('search') >= 0 && on.indexOf('employer') >= 0, 'with research on, the research step is there');
  t.ok(off.indexOf('search') < 0 && off.indexOf('employer') < 0 && off.indexOf('research') < 0, 'with research off, the research step is gone');
  t.ok(off.startsWith('Run a mock interview') && off.indexOf('\n\n\n') < 0 && off.indexOf('details.\n\nAsk 3 main') > 0, 'with research off, no gap is left');
  t.ok(off.length < on.length - 150, 'with research off the instructions are shorter');

  // ---- the other options replace words inside v4's sentences ----
  const five = L.instructions({ questions: '5' }, true);
  t.ok(five.indexOf('Ask 5 main questions') >= 0 && five.indexOf('After 5 questions and follow-ups') >= 0 && five.length === 1481, 'five questions changes two digits only');
  t.ok(five.indexOf('At most one follow-up per main question') > 0, 'the follow-up rule stays');
  const beh = L.instructions({ kind: 'behavioural' }, true);
  t.ok(beh.indexOf('each asking for a past example') > 0 && beh.indexOf('at least one past example') < 0, 'behavioural questions all ask for a past example');
  t.eq(L.instructions({ language: 'French' }, true).indexOf('never my own details. Reply in French.\n\n'), L.instructions({}, true).indexOf('never my own details.\n\n'), 'a language adds one short sentence to the first paragraph');
  t.eq(L.options({ kind: 'x', questions: '9', research: 'maybe', language: 'Klingon' }, true), { kind: 'general', questions: '3', research: 'on', language: '' }, 'unknown option values become the workshop defaults');
  t.eq(L.options({ questions: '9' }, false).questions, '5', 'and the normal defaults');
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
  let workshop = true;
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
  const rctx = (w, edited) => ({ workshop: () => w, edited: () => edited || null });
  const dflt = (o, w) => (typeof o.default === 'function' ? o.default(rctx(w)) : o.default);
  t.ok([true, false].every((w) => def.options.every((o) => o.choices.some((c) => String(c.value) === String(dflt(o, w))))), 'every default is one of its choices, in both modes');
  const qopt = def.options.filter((o) => o.id === 'questions')[0];
  t.eq([dflt(qopt, true), dflt(qopt, false)], ['3', '5'], 'the questions default is 3 in a workshop and 5 otherwise');
  t.eq(Desk.prompt.missingPlaceholders(def.template, def.placeholders), [], 'every placeholder in the template is described');
  t.eq(Desk.prompt.absentPlaceholders(def.template, def.placeholders), [], 'every described placeholder is used');
  t.ok(def.tips.length >= 2 && def.tips.join(' ').indexOf('voice') >= 0 && def.tips.join(' ').indexOf('Keep these instructions') >= 0, 'the voice and keep-these-instructions tips are there');
  t.eq(def.copies[0].text(rctx(true), { options: {} }), L.instructions({}, true), '"Copy only the instructions" copies the instructions alone');
  t.eq(def.copies[0].text(rctx(false), { options: {} }), L.instructions({}, false), 'and follows the mode');
  t.ok(def.copies[0].text(rctx(true), { options: {} }).indexOf('Job posting') < 0, 'and none of the context');
  // (T3.7) the person's changed instructions are what "Copy only the instructions" copies
  const mine = 'My coach words. Ask {questions} questions.{language}\n\n{research}Be kind.\n\n{context}';
  t.eq(def.copies[0].text(rctx(true, mine), { options: { questions: '4', research: 'off', language: 'French' } }), 'My coach words. Ask 4 questions. Reply in French.\n\nBe kind.\n', 'an edit is filled with the options, without the context');
  t.eq(L.instructionsFrom(L.fullTemplate(), { language: 'French' }, true), L.instructions({ language: 'French' }, true), 'the original template through instructionsFrom gives the same text');
  t.eq(slots.length, 1, 'it adds one slot');
  t.eq(slots[0].n, 'job.actions', 'the slot is job.actions');
  t.eq(slots[0].d.label, 'Practise an interview for this job', 'the button says what it does');
  slots[0].d.run(job);
  t.eq(went, ['ai/coach/j_1'], 'the button opens the coach for that job');

  const rc = (route) => ({
    workshop: () => workshop,
    store: { get: (id) => records[id] || null, all: () => [{ title: 'A story', text: 'Told it.', notes: 'SECRET' }] },
    profileLines: () => ['What work: Clerk'], route: () => ({ tab: 'ai', args: route }),
  });
  t.eq(def.needs(rc(['coach'])), [], 'no job in the address is fine (the AI asks for the posting)');
  t.eq(def.needs(rc(['coach', 'j_1'])), [], 'a job that exists is fine');
  t.eq(def.needs(rc(['coach', 'j_gone'])).length, 1, 'a missing job gives a message');
  t.eq(def.needs(rc(['coach', 'n_1'])).length, 1, 'an id that is not a job gives a message');
  t.eq(noString, [], 'every ctx.t key is a real string');
  const data = def.data(rc(['coach', 'j_1']), { options: { questions: '3' }, args: ['j_1'] });
  t.ok(data.context.indexOf('Job title: Office Administrator') > 0 && data.context.indexOf('What work: Clerk') > 0 && data.context.indexOf('A story: Told it.') > 0, 'data brings the profile, a story and the job');
  t.ok(!/SECRET/.test(JSON.stringify(data)), 'data never includes notes');
  t.eq(def.data(rc(['coach']), { options: {}, args: [] }).context.indexOf('Job posting:'), -1, 'no job id means no job block');
  const built = Desk.prompt.build({ id: 'coach', template: def.template, answer: null, budget: def.budget }, data, { code: '2222', now: 0 });
  t.ok(built.text.indexOf(L.instructions({}, true).replace(/\n$/, '')) > 0, 'the whole question carries the instructions exactly (workshop)');
  workshop = false;
  const normal = Desk.prompt.build({ id: 'coach', template: def.template, answer: null, budget: def.budget }, def.data(rc(['coach']), { options: { questions: '5' }, args: [] }), { code: '2222', now: 0 });
  t.ok(normal.text.indexOf(L.instructions({}, false).replace(/\n$/, '')) > 0 && normal.text.indexOf('Workshops') < 0, 'a normal copy carries the normal instructions');
  workshop = true;
  t.ok(built.text.indexOf('Invent no facts.\n\n---\n\nCandidate profile:\nWhat work: Clerk') > 0, 'the context follows the instructions below a line');
  t.eq(built.missing, [], 'nothing is left as {name}');
  t.ok(built.text.indexOf('HOW TO ANSWER') < 0, 'there is no answer block');

  // ---- the edit screen's length (1,500 warning) ----
  const hook = (text) => L.instructionsFrom(text, {}, false).replace(/\s+$/, '').length;
  t.eq(hook(L.fullTemplate()), L.instructions({}, false).replace(/\s+$/, '').length, 'the full template counts as the filled instructions, without the context');
  t.ok(hook(L.fullTemplate()) <= L.CAP, 'the original is within 1,500');
  t.ok(hook(L.fullTemplate() + ' ' + 'x'.repeat(100)) > L.CAP, 'added words push it over');
});
