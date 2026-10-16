// checks/sites.check.js
Desk.check('sites', (t, f) => {
  const L = f.logic;
  t.eq(f.id, 'sites', 'the feature has its id');
  t.eq(f.types, ['site', 'suggestion'], 'it owns site and may change suggestion');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  t.eq(L.sortSites([]), [], 'an empty list stays empty');
  const input = [{ name: 'beta' }, { name: 'Alpha' }, { name: 'charlie' }];
  t.eq(L.sortSites(input).map((s) => s.name), ['Alpha', 'beta', 'charlie'], 'sorted by name, ignoring capitals');
  t.eq(input[0].name, 'beta', 'sorting does not change the input');

  t.eq(L.cleanSite({ name: '  ', url: '' }), { ok: false, problem: 'needName' }, 'a name is needed');
  t.eq(L.cleanSite({ name: ' Job Bank ', url: ' https://jobbank.gc.ca ', note: ' good ' }),
    { ok: true, site: { type: 'site', name: 'Job Bank', url: 'https://jobbank.gc.ca', note: 'good' } }, 'text is trimmed');
  t.ok(L.cleanSite({ name: 'x' }).ok, 'link and note may be left out');
  t.eq(L.cleanSite({ name: 'x', url: 'ftp://a.b' }), { ok: false, problem: 'badLink' }, 'ftp is refused');
  t.eq(L.cleanSite({ name: 'x', url: 'javascript:alert(1)' }).problem, 'badLink', 'script links are refused');
  t.eq(L.cleanSite({ name: 'x', url: 'example.com' }).problem, 'badLink', 'a link without https:// is refused');
  t.ok(f.strings.needName && f.strings.badLink, 'problems are real string keys');

  t.ok(L.sameLink('https://www.Example.com/', 'https://example.com'), 'www, capitals and a last slash are ignored');
  t.ok(!L.sameLink('https://a.com', 'https://b.com'), 'different sites differ');
  t.ok(!L.sameLink('', ''), 'two empty links are not the same');
  t.ok(!L.sameLink('junk', 'junk'), 'junk is not a link');

  t.eq(L.domainOf('https://www.example.com/a/b'), 'example.com', 'domain without www');
  t.eq(L.domainOf('junk'), '', 'junk gives nothing');
  t.eq(L.domainOf(''), '', 'empty gives nothing');
  t.eq(L.domainOf(undefined), '', 'missing gives nothing');

  const sites = [{ id: 's1', type: 'site', name: 'A', url: 'https://example.com/' }];
  const sug = [
    { id: 'a', type: 'suggestion', kind: 'lead', status: 'new', why: 'w', target: { title: 'Ex', url: 'https://www.example.com' } },
    { id: 'b', type: 'suggestion', kind: 'lead', status: 'new', why: 'v', target: { title: 'Other', url: '' } },
    { id: 'c', type: 'suggestion', kind: 'lead', status: 'taken', target: { title: 'T', url: 'https://t.com' } },
    { id: 'd', type: 'suggestion', kind: 'event', status: 'new', target: 'x' },
    { id: 'e', type: 'suggestion', kind: 'lead', status: 'new', deleted: true, target: { title: 'D', url: 'https://d.com' } },
    { id: 'f', type: 'suggestion', kind: 'lead', status: 'new', title: 'Flat', url: 'http://flat.org' },
    { id: 'g', type: 'suggestion', kind: 'lead', status: 'new', target: { title: 'Bad', url: 'ftp://x.y' } },
  ];
  const leads = L.newLeads(sug, sites);
  t.eq(leads.map((l) => l.id), ['a', 'b', 'f', 'g'], 'only new, undeleted leads');
  t.eq(leads.map((l) => l.have), [true, false, false, false], 'have is true when the link matches a site');
  t.eq(leads[2].title, 'Flat', 'falls back to the top-level title');
  t.eq(leads[3].link, '', 'a link that is not https is dropped');

  const loc = [{ id: 'jobbank', name: 'Job Bank', url: 'https://www.jobbank.gc.ca/' }, { id: 'o', name: 'Other', url: 'https://o.ca' }];
  t.eq(L.startingSites(loc, []).length, 2, 'all start sites when none are added');
  t.eq(L.startingSites(loc, [{ url: 'https://jobbank.gc.ca' }]).map((s) => s.id), ['o'], 'added ones are left out');
  t.eq(L.startingSites(undefined, []), [], 'no locale sites is fine');
});
