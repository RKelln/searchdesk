// features/sites.js  (Job sites: keep the sites you use, plus places to look that the AI suggested)
// Owns `site` = {name, url, note}. Lists `suggestion` only to change a lead's status ('taken' | 'dismissed').
// data-test hooks: sites-form, sites-name, sites-url, sites-note, sites-save, sites-cancel, sites-problem, sites-add,
// site-row (data-id), site-link, site-edit, site-delete, sites-start (list), start-row (data-site-id), start-add,
// sites-leads (lane), lead-row (data-id), lead-domain, lead-have, lead-ai-mark, lead-take, lead-dismiss, sites-empty.
Desk.register({
  id: 'sites',
  name: 'Job sites',
  purpose: 'Keep the job sites you use in one place, with a note about each.',
  types: ['site', 'suggestion'],
  strings: {
    tabLabel: 'Job sites',
    heading: 'Your job sites',
    addHeading: 'Add a site',
    editHeading: 'Change this site',
    nameLabel: 'Name',
    urlLabel: 'Link (optional)',
    noteLabel: 'Note',
    save: 'Save',
    cancel: 'Cancel',
    addButton: 'Add a site',
    edit: 'Change',
    remove: 'Delete',
    openLink: 'Open {name}',
    needName: 'Please give the site a name.',
    badLink: 'The link must start with https:// or http://.',
    haveLink: 'You already have a site with this link.',
    added: 'Site added.',
    saved: 'Site saved.',
    removed: 'Site deleted.',
    startHeading: 'To start with',
    startIntro: 'These sites are a good place to begin.',
    addToMine: 'Add to my sites',
    leadsHeading: 'New places to look, from AI',
    fromAi: 'From AI, not checked',
    domainLine: 'Site: {domain}',
    youHave: 'You have this one',
    take: 'Take it',
    notForMe: 'Not for me',
    taken: 'Site added from the AI list.',
    takenHave: 'You already had this one, so nothing was added.',
    leadAway: 'Put away.',
    mySites: 'My sites',
    emptyAll: 'You have no sites yet. Add one above.',
  },
  css: `
    .sites-form { display: grid; gap: 0.5rem; margin: 0 0 1rem; max-width: 32rem; }
    .sites-list { list-style: none; padding: 0; margin: 0 0 1.25rem; display: grid; gap: 0.75rem; }
    .sites-row { padding: 0.75rem; border: 1px solid currentColor; border-radius: 0.5rem; }
    .sites-row h4 { margin: 0 0 0.25rem; }
    .sites-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .sites-problem { font-weight: bold; margin: 0; }
    .sites-ai { font-size: 0.85em; margin-left: 0.5rem; font-weight: normal; }
  `,
  logic: {
    // A new list sorted by name, ignoring capital letters.
    sortSites(list) {
      return (Array.isArray(list) ? list : []).slice().sort((a, b) => {
        const x = String(a.name || '').toLowerCase();
        const y = String(b.name || '').toLowerCase();
        if (x !== y) return x < y ? -1 : 1;
        return String(a.id || '') < String(b.id || '') ? -1 : (String(a.id || '') > String(b.id || '') ? 1 : 0);
      });
    },
    // -> {ok: true, site} or {ok: false, problem: 'needName' | 'badLink'}
    cleanSite(input) {
      const i = input || {};
      const name = String(i.name || '').trim();
      const url = String(i.url || '').trim();
      const note = String(i.note || '').trim();
      if (!name) return { ok: false, problem: 'needName' };
      if (url && !/^https?:\/\/\S+$/i.test(url)) return { ok: false, problem: 'badLink' };
      return { ok: true, site: { type: 'site', name: name, url: url, note: note } };
    },
    // The link made plain for comparing: lower case, no scheme-case, no www., no last slash. '' for no link.
    plainLink(url) {
      const u = String(url || '').trim().toLowerCase();
      if (!/^https?:\/\/\S+$/.test(u)) return '';
      return u.replace(/^(https?:\/\/)www\./, '$1').replace(/\/+$/, '');
    },
    sameLink(a, b) {
      const x = this.plainLink(a);
      return x !== '' && x === this.plainLink(b);
    },
    // 'example.com' for 'https://www.example.com/a/b'; '' for junk or empty.
    domainOf(url) {
      const m = /^https?:\/\/([^\/?#\s]+)/i.exec(String(url || '').trim());
      if (!m) return '';
      let host = m[1].toLowerCase().replace(/^[^@]*@/, '').replace(/:\d+$/, '').replace(/^www\./, '');
      if (!host || host.indexOf('.') === -1) return '';
      return host;
    },
    // True when some site (not deleted) has this link.
    haveLink(sites, url, exceptId) {
      return (Array.isArray(sites) ? sites : []).some((s) => s && !s.deleted && !(exceptId && s.id === exceptId) && this.sameLink(s.url, url));
    },
    // The title and link of a lead: target first, then the top-level fields.
    leadParts(s) {
      const t = s && s.target && typeof s.target === 'object' ? s.target : {};
      const title = String(t.title || s.title || '').trim();
      const raw = String(t.url || s.url || '').trim();
      return { title: title, url: /^https?:\/\/\S+$/i.test(raw) ? raw : '', why: String(s.why || '').trim() };
    },
    // Leads still new, each marked with `have` and its plain parts. Newest first is not needed: keep given order.
    newLeads(suggestions, sites) {
      const out = [];
      (Array.isArray(suggestions) ? suggestions : []).forEach((s) => {
        if (!s || s.type !== 'suggestion' || s.deleted || s.kind !== 'lead' || s.status !== 'new') return;
        const p = this.leadParts(s);
        out.push(Object.assign({}, s, { title: p.title, link: p.url, why: p.why, have: this.haveLink(sites, p.url) }));
      });
      return out;
    },
    // The locale's sites that are not added yet.
    startingSites(localeSites, sites) {
      return (Array.isArray(localeSites) ? localeSites : []).filter((l) => l && l.name && !this.haveLink(sites, l.url));
    },
  },
  mount(ctx) {
    const h = ctx.h;
    const logic = this.logic;
    let editing = null; // 'new', a site id, or null. Kept here because the screen is drawn again after every change.

    function btn(test, label, fn, extra) {
      return h('button', Object.assign({ type: 'button', 'data-test': test, on: { click: fn } }, extra || {}), label);
    }

    function form(el, site) {
      const isNew = !site;
      const name = h('input', { type: 'text', id: 'sites-name', 'data-test': 'sites-name', value: site ? site.name : '' });
      const url = h('input', { type: 'url', id: 'sites-url', 'data-test': 'sites-url', value: site ? site.url || '' : '' });
      const note = h('textarea', { id: 'sites-note', 'data-test': 'sites-note', rows: '2' }, site ? site.note || '' : '');
      const problem = h('p', { class: 'sites-problem', role: 'alert', 'data-test': 'sites-problem' });
      el.append(h('form', { class: 'sites-form', 'data-test': 'sites-form', novalidate: 'novalidate', on: { submit: (e) => {
        e.preventDefault();
        const r = logic.cleanSite({ name: name.value, url: url.value, note: note.value });
        if (!r.ok) { problem.textContent = ctx.t(r.problem); return; }
        if (logic.haveLink(ctx.store.all('site'), r.site.url, site && site.id)) { problem.textContent = ctx.t('haveLink'); return; }
        ctx.store.batch(isNew ? 'Add site' : 'Change site', () => {
          ctx.store.put(isNew ? r.site : Object.assign({}, site, r.site));
        });
        editing = null;
        ctx.ui.toast(ctx.t(isNew ? 'added' : 'saved'), { undo: true });
        ctx.ui.go('sites');
      } } },
        h('h3', {}, ctx.t(isNew ? 'addHeading' : 'editHeading')),
        h('label', { for: 'sites-name' }, ctx.t('nameLabel')), name,
        h('label', { for: 'sites-url' }, ctx.t('urlLabel')), url,
        h('label', { for: 'sites-note' }, ctx.t('noteLabel')), note,
        problem,
        h('div', { class: 'sites-buttons' },
          h('button', { type: 'submit', 'data-test': 'sites-save' }, ctx.t('save')),
          btn('sites-cancel', ctx.t('cancel'), () => { editing = null; ctx.ui.go('sites'); }))));
    }

    function siteRow(s) {
      return h('li', { class: 'sites-row', 'data-test': 'site-row', 'data-id': s.id },
        h('h4', {}, s.name),
        s.note ? h('p', {}, s.note) : null,
        s.url ? h('a', { href: s.url, 'data-test': 'site-link' }, ctx.t('openLink', { name: s.name })) : null,
        h('div', { class: 'sites-buttons' },
          btn('site-edit', ctx.t('edit'), () => { editing = s.id; ctx.ui.go('sites'); }),
          btn('site-delete', ctx.t('remove'), () => {
            ctx.store.batch('Delete site', () => ctx.store.remove(s.id));
            ctx.ui.toast(ctx.t('removed'), { undo: true });
          })));
    }

    function startRow(l) {
      return h('li', { class: 'sites-row', 'data-test': 'start-row', 'data-site-id': l.id || '' },
        h('h4', {}, l.name),
        l.url ? h('a', { href: l.url }, ctx.t('openLink', { name: l.name })) : null,
        h('div', { class: 'sites-buttons' },
          btn('start-add', ctx.t('addToMine'), () => {
            ctx.store.batch('Add site', () => ctx.store.put({ type: 'site', name: l.name, url: l.url || '', note: l.note || '' }));
            ctx.ui.toast(ctx.t('added'), { undo: true });
          })));
    }

    function leadRow(l) {
      const domain = logic.domainOf(l.link);
      return h('li', { class: 'sites-row', 'data-test': 'lead-row', 'data-id': l.id },
        h('h4', {}, l.title || ctx.t('mySites'), h('span', { class: 'sites-ai', 'data-test': 'lead-ai-mark' }, ctx.t('fromAi'))),
        domain ? h('p', { 'data-test': 'lead-domain' }, ctx.t('domainLine', { domain: domain })) : null,
        l.why ? h('p', {}, l.why) : null,
        l.have ? h('p', { 'data-test': 'lead-have' }, ctx.t('youHave')) : null,
        h('div', { class: 'sites-buttons' },
          btn('lead-take', ctx.t('take'), () => {
            const orig = ctx.store.get(l.id);
            ctx.store.batch('Take a place to look', () => {
              if (!l.have) ctx.store.put({ type: 'site', name: l.title, url: l.link, note: l.why });
              ctx.store.put(Object.assign({}, orig, { status: 'taken' }));
            });
            ctx.ui.toast(ctx.t(l.have ? 'takenHave' : 'taken'), { undo: true });
          }),
          btn('lead-dismiss', ctx.t('notForMe'), () => {
            const orig = ctx.store.get(l.id);
            ctx.store.batch('Put a lead away', () => ctx.store.put(Object.assign({}, orig, { status: 'dismissed' })));
            ctx.ui.toast(ctx.t('leadAway'), { undo: true });
          })));
    }

    ctx.slot('tab', {
      id: 'sites',
      label: ctx.t('tabLabel'),
      order: 60,
      render(el) {
        const sites = logic.sortSites(ctx.store.all('site'));
        const leads = logic.newLeads(ctx.store.all('suggestion'), sites).filter((l) => l.title || l.link);
        const start = logic.startingSites((ctx.locale && ctx.locale.sites) || [], sites);
        el.append(h('h2', {}, ctx.t('heading')));

        if (leads.length) {
          el.append(h('section', { 'data-test': 'sites-leads' }, h('h3', {}, ctx.t('leadsHeading')),
            h('ul', { class: 'sites-list' }, leads.map(leadRow))));
        }

        const editSite = editing && editing !== 'new' ? sites.find((s) => s.id === editing) : null;
        if (editing === 'new' || editSite) form(el, editSite);
        else el.append(h('p', {}, btn('sites-add', ctx.t('addButton'), () => { editing = 'new'; ctx.ui.go('sites'); })));

        if (sites.length) {
          el.append(h('section', { 'data-test': 'sites-mine' }, h('h3', {}, ctx.t('mySites')),
            h('ul', { class: 'sites-list' }, sites.map(siteRow))));
        }
        if (start.length) {
          el.append(h('section', { 'data-test': 'sites-start' }, h('h3', {}, ctx.t('startHeading')),
            h('p', {}, ctx.t('startIntro')), h('ul', { class: 'sites-list' }, start.map(startRow))));
        }
        if (!sites.length && !leads.length) el.append(h('p', { 'data-test': 'sites-empty' }, ctx.t('emptyAll')));
      },
    });
  },
});
