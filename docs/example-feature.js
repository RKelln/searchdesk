// features/example.js  (a complete example feature: short notes)
Desk.register({
  id: 'example',
  name: 'Notes',
  purpose: 'Keep short notes about your job search.',
  types: ['note'],
  strings: {
    tabLabel: 'Notes',
    heading: 'Your notes',
    titleLabel: 'Title',
    textLabel: 'Note',
    add: 'Add note',
    remove: 'Remove',
    removed: 'Note removed.',
    added: 'Note added.',
    empty: 'No notes yet. Add your first one above.',
    needTitle: 'Please give your note a title.',
    searchLabel: 'Find a note',
  },
  css: `
    .example-form { display: grid; gap: 0.5rem; margin-bottom: 1rem; }
    .example-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
    .example-note { padding: 0.75rem; border: 1px solid currentColor; border-radius: 0.5rem; }
    .example-problem { font-weight: bold; }
  `,
  logic: {
    // Newest first. Notes with the same time are put in title order.
    sortNotes(notes) {
      return notes.slice().sort((a, b) => {
        if (a.updated !== b.updated) return a.updated < b.updated ? 1 : -1;
        return String(a.title).localeCompare(String(b.title));
      });
    },
    // Tidy what the person typed. Returns { ok: true, note } or { ok: false, problem },
    // where problem is a string key for ctx.t().
    cleanNote(input) {
      const title = String(input.title || '').trim();
      const text = String(input.text || '').trim();
      if (!title) return { ok: false, problem: 'needTitle' };
      return { ok: true, note: { type: 'note', title: title, text: text } };
    },
    // Notes whose title or text contains the words typed, ignoring capital letters.
    findNotes(notes, query) {
      const q = String(query || '').trim().toLowerCase();
      if (!q) return notes;
      return notes.filter((n) => (n.title + ' ' + n.text).toLowerCase().indexOf(q) !== -1);
    },
  },
  mount(ctx) {
    const h = ctx.h;
    const logic = this.logic;
    ctx.slot('tab', {
      id: 'example',
      label: ctx.t('tabLabel'),
      order: 90,
      render(el) {
        let query = '';
        const problem = h('p', { class: 'example-problem', role: 'alert' });
        const title = h('input', { type: 'text', id: 'example-title' });
        const text = h('textarea', { id: 'example-text', rows: '3' });
        const list = h('ul', { class: 'example-list' });

        function draw() {
          const notes = logic.findNotes(logic.sortNotes(ctx.store.all('note')), query);
          list.textContent = '';
          if (notes.length === 0) list.append(h('li', {}, ctx.t('empty')));
          notes.forEach((n) => {
            list.append(h('li', { class: 'example-note' },
              h('strong', {}, n.title),
              h('p', {}, n.text),
              h('button', { type: 'button', on: { click: () => {
                ctx.store.batch('Remove note', () => ctx.store.remove(n.id));
                ctx.ui.toast(ctx.t('removed'));
                draw();
              } } }, ctx.t('remove'))));
          });
        }

        el.append(
          h('h2', {}, ctx.t('heading')),
          h('form', { class: 'example-form', on: { submit: (e) => {
            e.preventDefault();
            const result = logic.cleanNote({ title: title.value, text: text.value });
            problem.textContent = result.ok ? '' : ctx.t(result.problem);
            if (!result.ok) return;
            ctx.store.put(result.note);
            title.value = '';
            text.value = '';
            ctx.ui.toast(ctx.t('added'));
            draw();
          } } },
            h('label', { for: 'example-title' }, ctx.t('titleLabel')), title,
            h('label', { for: 'example-text' }, ctx.t('textLabel')), text,
            problem,
            h('button', { type: 'submit' }, ctx.t('add'))),
          h('label', { for: 'example-search' }, ctx.t('searchLabel')),
          h('input', { type: 'search', id: 'example-search', on: { input: (e) => {
            query = e.target.value;
            draw();
          } } }),
          list);
        draw();
      },
    });
  },
});
