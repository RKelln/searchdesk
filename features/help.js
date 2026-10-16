// features/help.js: free help from the locale pack, people first.
Desk.register({
  id: 'help',
  name: 'Free help',
  purpose: 'People who help you look for work, for free.',
  types: [],
  strings: {
    tabLabel: 'Free help',
    heading: 'Free help',
    intro: 'These people and places help you look for work. They do not cost money.',
    people: 'Free, from people',
    online: 'Free, on your own',
    how: 'How to reach them',
    who: 'Who it is for',
    source: 'Where this comes from',
    empty: 'No help is listed for this place yet.',
  },
  css: `
    .help-list { list-style: none; padding: 0; margin: 0 0 1.5rem; display: grid; gap: 0.75rem; }
    .help-entry { padding: 0.75rem; border: 1px solid currentColor; border-radius: 0.5rem; }
    .help-entry h4 { margin: 0 0 0.25rem; }
    .help-entry p { margin: 0.25rem 0; }
  `,
  logic: {
    // Entries of one kind, in the order the locale lists them. Entries without a name or an https source are left out.
    entriesOfKind(help, kind) {
      return (Array.isArray(help) ? help : []).filter((e) =>
        e && e.kind === kind && e.name && /^https:\/\//.test(String(e.source || '')));
    },
  },
  mount(ctx) {
    const h = ctx.h;
    const logic = this.logic;
    const loc = ctx.locale || {};
    const notes = loc.helpNotes || {};
    function section(titleKey, kind) {
      const items = logic.entriesOfKind(loc.help, kind);
      if (!items.length) return null;
      return h('section', {},
        h('h3', {}, ctx.t(titleKey)),
        h('ul', { class: 'help-list' }, items.map((e) =>
          h('li', { class: 'help-entry', 'data-test': 'help-entry', 'data-help-id': e.id },
            h('h4', {}, e.name),
            h('p', {}, e.what),
            h('p', {}, h('strong', {}, ctx.t('how') + ': '), e.how),
            e.phone && e.phone.tel ? h('p', {}, h('a', { href: 'tel:' + e.phone.tel, 'data-test': 'help-call' }, e.phone.label)) : null,
            h('p', {}, h('strong', {}, ctx.t('who') + ': '), e.who),
            h('p', {}, h('a', { href: e.source, 'data-test': 'help-source' }, ctx.t('source')))))));
    }
    ctx.slot('tab', {
      id: 'help',
      label: ctx.t('tabLabel'),
      order: 50,
      render(el) {
        el.append(h('h2', {}, ctx.t('heading')), h('p', {}, ctx.t('intro')));
        const a = section('people', 'person');
        const b = section('online', 'online');
        if (!a && !b) el.append(h('p', {}, ctx.t('empty')));
        if (a) el.append(a);
        if (notes.status) el.append(h('p', { 'data-test': 'help-status' }, notes.status));
        if (b) el.append(b);
        if (notes.libraryClasses) el.append(h('p', { 'data-test': 'help-classes' }, notes.libraryClasses));
      },
    });
  },
});
