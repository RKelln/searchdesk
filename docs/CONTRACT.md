# The feature contract

This file is all you need to write a Search Desk feature. A feature is one file that follows the rules below. If it
follows them, it cannot break the rest of the app, and the app's self-test can check it.

Search Desk is a job-search helper that runs in a browser with no install and no server. There are no packages, no
frameworks and no build step. Every file is a plain script.

## 1. A feature is one file

```js
// features/sites.js
Desk.register({
  id: 'sites',                       // matches the file name; lowercase, a-z and hyphens
  name: 'Job sites',                 // plain words, shown to people
  purpose: 'Keep the job sites you use in one place.',
  types: ['site'],                   // record types this feature owns (may be empty)
  uses: ['calendar'],                // optional: other features it adds a nicety to when present
  strings: { addSite: 'Add a site', /* ... */ },
  css: `.sites-list { /* ... */ }`,
  logic: {                           // pure functions only: no DOM, no Desk globals, no time or random
    sortSites(sites) { /* ... */ },
  },
  mount(ctx) {                       // called once at start; register slots here
    ctx.slot('tab', { id: 'sites', label: ctx.t('tabLabel'), render: (el) => { /* ... */ } });
  },
});
```

The file does nothing at load time except call `Desk.register`. Nothing touches the DOM until `mount` runs. That is
what lets the check runner load the file with no page, and test `logic`.

To add a feature: put the file in `features/`, add its id to the list in `features/list.js`, and write
`checks/<id>.check.js`.

## 2. What `ctx` gives a feature

`mount(ctx)` receives `ctx`. It is the only way a feature talks to the app. The shell calls it as `def.mount(ctx)`, so inside `mount`, `this` is your registered object and `this.logic` is your `logic` (the example uses this). Undo belongs to the shell: `ctx.store` has no `undo`.

| `ctx.` | What it does |
|---|---|
| `store.all(type)` / `store.get(id)` | read records; deleted ones are hidden unless you pass `{withDeleted: true}` |
| `store.put(record)` | create or update a record of a type you own; sets `id` (if missing), `updated`, and `source` (default `user`) |
| `store.remove(id)` | mark one of your records as deleted |
| `store.ext(id, patch)` | set this feature's `ext.<id>` on any record |
| `store.batch(label, fn)` | group writes into one undo step |
| `slot(name, def)` | add UI at a named place (section 3) |
| `h(tag, attrs, ...children)` | build elements safely (section 4) |
| `t(key, vars)` | this feature's strings, then the core strings; `{name}` in a string is replaced from `vars` |
| `ui.toast(text, {undo})`, `ui.confirm(text, {yes, no}?)`, `ui.go(tab)` | small interface helpers. `ui.toast` with `{undo: true}` shows an Undo button for 10 seconds; it goes away if a newer change is made. `ui.confirm` asks a yes/no question and returns a Promise that resolves to `true` or `false`; `yes` and `no` are optional button words. |
| `renderSlot(name, el, ...args)` | show the entries other features put in a slot (for example `ctx.renderSlot('job.panel', el, job)`); each gets its own empty block, an empty one is left out, and one that fails shows a short plain line instead. Buttons for `job.actions` and `event.actions` are made for you |
| `route()` | the current screen and its parts, from the address: `#jobs/j_abc/edit` gives `{tab: 'jobs', args: ['j_abc', 'edit']}`; change it with `ui.go('jobs/j_abc')` |
| `fmt.date(v)`, `fmt.time(v)`, `fmt.dateTime(v)`, `fmt.relative(v, now)`, `fmt.daysFrom(v, now)` | show dates in plain words ("Thu Oct 22", "6:30pm", "in 3 days", "2 days late"); `v` is `YYYY-MM-DD`, `YYYY-MM-DDTHH:MM` or an ISO time |
| `has(featureId)` | whether another feature is loaded, for soft `uses` |
| `locale` | the locale pack (local help, sites, rules), read-only |
| `now()` | the current time (tests can fix it) |
| `profile()` | the profile record |
| `profileLines(profile?)` | the profile lines an AI question will contain: only fields whose "send to AI" switch is on (the same function the recipes use) |
| `backupNudge()` | whether to remind the person to save a copy: `{show, text, days}` (`show` is true when there are changes since the last export and either 7 days have passed or there are 10 or more records; `days` is null if never exported). Used by Home |
| `recipe(def)` | register an AI recipe |

Records are plain objects. Every record has `id`, `type`, `updated`, `source` (`user`, `ai`, `example`, `feed` or
`import`), and sometimes `deleted: true` and `ext`. Unknown types and unknown `ext` keys are kept and exported
untouched, so never delete what you do not own.

## 3. Slots

| Slot | Where it shows | `def` |
|---|---|---|
| `tab` | a screen in the main menu | `{id, label, order?, render(el)}` |
| `home` | a block on Home, under "Today" | `{id, order?, render(el)}`; render nothing to hide it |
| `job.panel` | a section in a job's detail view | `{id, title, render(el, job)}` |
| `job.actions` | a button on a job's detail view | `{id, label, run(job)}` |
| `event.actions` | a button on an event row | `{id, label, run(event)}` |
| `settings` | a block on the Data and settings screen | `{id, title, render(el)}` |
| `print` | a section in the printable summary (if `print` is loaded) | `{id, title, render(el)}` |

New slots are added to core, never improvised inside a feature. If a feature needs a slot that is not here, stop and
say so.

## 4. `h()`: the only way to make elements

- Children that are strings become text nodes. There is no way to pass HTML.
- `href` must be `https:`, `http:` or `mailto:`; anything else is dropped. Links get `rel="noopener noreferrer"` and
  open in a new tab.
- `on: { click: fn }` attaches handlers. `class`, `aria-*`, `data-*` and form attributes pass through.

```js
h('a', { href: job.link }, 'Open the posting')
h('button', { type: 'button', on: { click: save } }, ctx.t('save'))
```

## 5. Rules

1. **Talk to the app only through `ctx`.** No globals of your own, no reaching into another feature's DOM, no calling
   another feature.
2. **Read anything; write only your own types and your own `ext`.**
3. **Never** use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `fetch`,
   `XMLHttpRequest`, `import()`, `localStorage` or timers that run forever. The store and `net` do the storage and
   network work. The self-test scans every loaded feature's source for these words and fails the feature if it finds
   one.
4. **Pure logic goes in `logic`**, and `mount` only does the DOM work. Checks test `logic`.
5. **Plain-word strings** go in `strings`.
6. **Missing is fine.** Guard soft uses with `ctx.has('id')`. If a feature listed in `list.js` fails to load, the
   shell shows a stub with its `name` and `purpose` (taken from `Desk.planned` or the list) and the line "This part is
   not built yet." The rest of the app works normally.
7. **Registering is idempotent.** Registering the same id twice replaces the first and logs a warning.
8. **One file.** No other files except `checks/<id>.check.js` and `docs/features/<id>.md`.

## 6. Checks

```js
// checks/sites.check.js
Desk.check('sites', (t, f) => {          // f = the registered feature
  t.ok(f.logic.sortSites([]).length === 0, 'an empty list stays empty');
  t.eq(f.logic.sortSites([{name:'b'},{name:'a'}])[0].name, 'a', 'sites sort by name');
});
```

- `t.ok(condition, message)` and `t.eq(actual, expected, message)`. `t.eq` compares plain data deeply.
- Test the functions in `logic`. They are pure, so no page is needed.
- Run one check: `node checks/run.js <id>` (needs Node). On a Mac with no Node: `bash checks/check.sh <id>`, which
  uses the built-in `osascript` (this script arrives with task T1.6, so it may not exist yet). It prints
  `PASS`/`FAIL` lines and a summary. If the id is not plain a-z and hyphens, or the file is missing, it prints a
  `STOP:` sentence.
- The app's own self-test page (`#selftest`, also T1.6) runs the same checks for every loaded feature.

## 7. How the contract is enforced

- **`AGENTS.md`** is the primary rule. For most agents most of the time it is enough.
- **The self-test** catches what slips through, wherever the app runs and whoever wrote the code. It scans each
  feature's source for the banned words in rule 3.
- **In a workshop folder,** edits under `features/` and `checks/` are pre-approved. Edits to `core/`, `locale/` and
  `data/` ask first. Core may need a fix nobody expected, so the person can still say yes, but "I am about to change
  the app's core" is a visible moment.

## 8. A complete example

This feature keeps short notes. It uses every part of the contract. Its source is `docs/example-feature.js` and its
check is `docs/example-feature.check.js`; the copies below are identical to those files. Run it with:

```
node checks/run.js example
```

`checks/run.js` uses the two files in `docs/` when the id is `example`. For any other id it uses `features/<id>.js`
and `checks/<id>.check.js`. You can also pass paths: `node checks/run.js <id> <featureFile> <checkFile>`.

### The feature

```js
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
```

### Its check

```js
// checks/example.check.js  (the check for the example feature)
Desk.check('example', (t, f) => {
  const L = f.logic;

  t.eq(f.id, 'example', 'the feature has its id');
  t.eq(f.types, ['note'], 'it owns the note type');
  t.ok(typeof f.mount === 'function', 'it has a mount function');

  t.eq(L.sortNotes([]), [], 'an empty list stays empty');
  const sorted = L.sortNotes([
    { title: 'b', updated: '2026-10-01T10:00:00Z' },
    { title: 'a', updated: '2026-10-02T10:00:00Z' },
    { title: 'c', updated: '2026-10-01T10:00:00Z' },
  ]);
  t.eq(sorted.map((n) => n.title), ['a', 'b', 'c'], 'newest first, then by title');

  const input = [{ title: 'z', updated: '1' }, { title: 'y', updated: '2' }];
  L.sortNotes(input);
  t.eq(input[0].title, 'z', 'sorting does not change the list it was given');

  t.eq(L.cleanNote({ title: '   ', text: 'x' }), { ok: false, problem: 'needTitle' }, 'a blank title is refused');
  t.eq(L.cleanNote({ title: ' Call back ', text: ' soon ' }),
    { ok: true, note: { type: 'note', title: 'Call back', text: 'soon' } }, 'spaces are trimmed');
  t.ok(L.cleanNote({ title: 'ok' }).ok, 'the text may be left out');
  t.ok(f.strings[L.cleanNote({ title: '' }).problem], 'the problem is a real string key');

  const notes = [{ title: 'Library', text: 'Ask about coaching' }, { title: 'Bus', text: 'Route 25' }];
  t.eq(L.findNotes(notes, 'LIBRARY').length, 1, 'find ignores capital letters');
  t.eq(L.findNotes(notes, 'route').map((n) => n.title), ['Bus'], 'find looks in the text too');
  t.eq(L.findNotes(notes, '  ').length, 2, 'an empty search shows everything');
});
```

Things to copy from it:

- `logic` holds the thinking (sorting, tidying, finding). It has no DOM, no `Desk`, no clock.
- `logic` returns a string key for a problem (`needTitle`), and `mount` turns it into words with `ctx.t`.
- Every word a person sees is in `strings`, in plain short words.
- All elements come from `h()`. Text goes in as children, never as HTML.
- Only the `note` type is written, because that is the only type in `types`.
- Changes that touch records go through `ctx.store`, and removal is one `batch` so it can be undone.
