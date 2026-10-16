// checks/recipe-posting.check.js
Desk.check('recipe-posting', (t, f) => {
  const L = f.logic;
  t.eq(f.id, 'recipe-posting', 'the feature has its id');
  t.eq(f.types, [], 'it owns no record types');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  // ---- the posting is cut at 8,000 characters ----
  t.eq(L.POSTING_MAX, 8000, 'the limit is 8,000');
  t.eq(L.cutPosting('x'.repeat(20000)).length, 8000, 'a long posting is cut at 8,000 characters');
  t.eq(L.cutPosting('  Hello\r\nthere  \n\n\n\nbye '), 'Hello\nthere\n\nbye', 'line ends are fixed and blank runs shortened');
  t.eq(L.cutPosting(undefined), '', 'nothing gives nothing');
  t.eq(L.build({ posting: 'y'.repeat(9000) }).posting.length, 8000, 'build cuts it too');

  // ---- the link comes from the person only ----
  t.eq(L.cleanLink(' https://example.org/jobs/1 '), 'https://example.org/jobs/1', 'a typed https link is kept');
  t.eq(L.cleanLink('javascript:alert(1)'), '', 'a bad link is dropped');
  t.eq(L.cleanLink('example.org'), '', 'a link with no https:// is dropped');

  // ---- fields parse to a draft (through the real parser) ----
  const prompts = [{ code: 'P4RT', recipe: 'posting', aliases: {}, created: '2026-10-16T12:00:00.000Z' }];
  const ctx = { recipe: 'posting', prompts, answer: L.ANSWER, required: L.REQUIRED, quota: L.QUOTA, types: L.TYPES, example: L.EXAMPLE, now: '2026-10-16' };
  const parse = (text) => Desk.reply.parse(text, ctx);
  const given = { posting: 'The posting text.', link: 'https://example.org/p/1' };
  const clean = parse('```\nDESK-P4RT\nTITLE | Accounts Payable Clerk\nORG | Northside Foods\nWHERE | Scarborough, ON\nCLOSES | 2026-11-02\n' +
    'PAY | $22 an hour\nAI-SCREENING | No\nASKS | Three years of AP; Excel; English\nFIT | Her six years of AP work match well.\n```');
  const sug = L.suggestions(clean.accepted, given);
  t.eq(sug.length, 1, 'apply gives exactly one suggestion');
  t.eq(sug[0].kind, 'job-draft', 'it is a job-draft');
  const d = sug[0].target;
  t.eq([d.title, d.org, d.where, d.closes], ['Accounts Payable Clerk', 'Northside Foods', 'Scarborough, ON', '2026-11-02'], 'the fields make a draft');
  t.eq(d.asks, ['Three years of AP', 'Excel', 'English'], 'ASKS is a list');
  t.eq([d.link, d.posting], ['https://example.org/p/1', 'The posting text.'], 'the link and posting are the ones the person gave');
  t.ok(d.notes.indexOf('Pay: $22 an hour') >= 0 && d.notes.indexOf('AI screening: no') >= 0 && d.notes.indexOf('How it fits you') >= 0, 'pay, screening and fit go in the notes');
  t.eq(sug[0].why, 'Her six years of AP work match well.', 'the reason is the FIT line');

  // ---- synonyms and any order ----
  const syn = L.draft(parse('DESK-P4RT\nFIT: Matches her AP years.\nSalary - $22 an hour\nDeadline: Nov 2\nLocation | Scarborough, ON\nEmployer | Northside Foods\n' +
    '**Job title:** Accounts Payable Clerk\nWage | $25\nREQUIREMENTS | Excel, AP\nAI SCREENING | no\nCompany | Ignored duplicate\nAPPLY BY | 2026-12-01').accepted, given);
  t.eq([syn.title, syn.org, syn.where, syn.closes], ['Accounts Payable Clerk', 'Northside Foods', 'Scarborough, ON', '2026-11-02'], 'synonyms map, in any order, and a repeat keeps the first');
  t.ok(syn.notes.indexOf('$22 an hour') >= 0 && syn.notes.indexOf('$25') < 0, 'the first pay line wins');

  // ---- CLOSES unknown leaves the date empty ----
  const unk = L.draft(parse('DESK-P4RT\nTITLE | Clerk\nCLOSES | unknown\nPAY | not stated\nORG | not stated').accepted, given);
  t.eq(unk.closes, '', 'CLOSES "unknown" leaves the date empty');
  t.eq([unk.pay, unk.org, unk.notes], ['', '', ''], '"not stated" leaves a field empty');
  t.eq(L.draft(parse('DESK-P4RT\nTITLE | Clerk\nCLOSES | 11/02').accepted, given).closes, '', 'an ambiguous date is left empty too');

  // ---- no invented link, one suggestion, nothing from nothing ----
  t.eq(L.draft(parse('DESK-P4RT\nTITLE | Clerk\nORG | https://evil.example/x').accepted, {}).link, '', 'with no typed link the draft has none');
  t.eq(L.suggestions([], given), [], 'no lines read gives no suggestion');
  t.eq(L.suggestions(parse('DESK-P4RT\nTITLE | Clerk').accepted, given).length, 1, 'a title alone is enough');
  t.eq(parse('DESK-P4RT\nORG | Acme').accepted.map((a) => a.kind), ['ORG'], 'a line without a title is still read');
  t.eq(L.splitAsks('a | b | c'), ['a', 'b', 'c'], 'pipes split ASKS');

  // ---- the question fits and holds the posting ----
  const data = Object.assign({ profile: ['What work: Office administration'] }, L.build({ posting: 'p'.repeat(9000) }));
  const built = Desk.prompt.build({ id: 'posting', template: L.TEMPLATE, answer: L.ANSWER, example: L.EXAMPLE, budget: 12000 }, data, { code: '7Q3K' });
  t.eq(built.missing, [], 'every placeholder is filled');
  t.ok(built.text.indexOf('p'.repeat(8000)) > 0 && built.text.indexOf('p'.repeat(8001)) < 0, 'the question holds 8,000 characters of the posting');
  t.ok(built.size <= 12000, 'the question is within its budget (' + built.size + ' characters)');
  t.ok(/TITLE \| /.test(built.text) && /AI-SCREENING \|/.test(built.text), 'the answer format is in the question');

  // ---- through mount, with a stand-in ctx ----
  const recipes = [], noString = [], went = [];
  const store = [];
  const fake = {
    h: (tag, attrs, ...kids) => ({ tag, attrs, kids }),
    recipe: (def) => recipes.push(def),
    t: (k) => { if (typeof f.strings[k] !== 'string') noString.push(k); return f.strings[k]; },
    store: { all: () => store }, ui: { go: (to) => went.push(to) },
  };
  f.mount(fake);
  const def = recipes[0];
  t.eq(recipes.length, 1, 'it registers one recipe');
  t.eq(def.id, 'posting', 'the recipe is "posting"');
  t.eq(def.inputs.map((i) => i.id), ['posting', 'link'], 'two inputs: the posting and the link');
  t.eq(Desk.prompt.missingPlaceholders(def.template, def.placeholders), [], 'every placeholder is described');
  t.eq(Desk.prompt.absentPlaceholders(def.template, def.placeholders), [], 'every described placeholder is used');
  t.eq(def.needs({}, { inputs: { posting: '  ' } }).length, 1, 'an empty posting gives a message');
  t.eq(def.needs({}, { inputs: { posting: 'A job.' } }), [], 'a posting is enough');
  t.eq(def.data({}, { inputs: { posting: 'z'.repeat(9000) } }).posting.length, 8000, 'data cuts the posting');
  t.eq(def.keep({}, { inputs: { posting: 'A job.', link: 'nope' } }), { posting: 'A job.', link: '' }, 'keep saves the posting and a good link');
  const applied = def.apply({ accepted: clean.accepted, prompt: { keep: given }, bareCode: 'P4RT' }, {});
  t.eq(applied.suggestions.length, 1, 'apply gives one suggestion');
  t.eq(applied.suggestions[0].target.link, given.link, 'the link comes from the prompt record');
  store.push({ id: 's_p4rt_x', kind: 'job-draft', recipe: 'posting', code: 'P4RT', status: 'new', target: d });
  const el = { kids: [], append(...k) { this.kids.push(...k); } };
  applied.render(el);
  const btn = JSON.stringify(el.kids).indexOf('posting-take') >= 0;
  t.ok(btn, 'the result has a Take it button');
  const take = (function find(n) { if (!n || typeof n !== 'object') return null; if (n.attrs && n.attrs['data-test'] === 'posting-take') return n; for (const k of [].concat(n.kids || [])) { const r = find(k); if (r) return r; } return null; })({ kids: el.kids });
  take.attrs.on.click();
  t.eq(went, ['jobs/new/s_p4rt_x'], 'Take it opens the job form with that draft');
  t.eq(noString, [], 'every ctx.t key is a real string');
});
