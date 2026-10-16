// features/recipe-custom.js  (T3.8, DESIGN 9.11) Your own AI tasks.
//
// Anyone can make a task with no code: a name, the instructions with {words} from a short list, where it starts (the AI
// screen, or a job), and what happens to the answer (nothing, or "add it to this job's notes").
//
// RECORDS. This feature owns the `recipe-custom` type: {name, text, startsFrom: 'ai' | 'job', answer: 'none' | 'job-notes'}.
// (DESIGN 6 lists the owner as "core (recipes)"; a feature that owns its own type needs no change to core's rules.)
// Each record is registered as a recipe with ctx.recipe(), using the record id as the recipe id. sync() keeps the
// registered recipes in step with the records (at start, and after every change, undo and import).
//
// THE WORDS a task may use ({name} is filled in; any other {name} stays in the question as plain text):
//   starts from the AI screen: {profile} {events} {replyLanguage}
//   starts from a job:         the same, and {job} {title} {org} {where} {asks} {posting}
// Job notes and contacts are never offered as a word. {posting} is cut at 4,000 characters.
//
// THE ANSWER. "none": the question is copied and nothing is read back. "job-notes": the answer is read as text (the code
// block, whole) and becomes ONE `job-note` suggestion {target: {job, text, task}}. This feature cannot write `job`
// records (jobs owns them), so the person takes it in that job's detail view ("Add to notes"; features/jobs.js appends
// it with a date). The AI never edits a record by itself.
//
// SHARING. "Copy this recipe" copies logic.shareText(task). Pasting that text anywhere on the AI screen or the Data
// screen's paste box shows what is in it and "Add it as my task" (logic.parseShared). It is text, never code.
Desk.register({
  id: 'recipe-custom',
  name: 'AI: your own tasks',
  purpose: 'Make your own AI task from instructions you write, and share it as text.',
  types: ['recipe-custom'],
  strings: {
    slotTitle: 'Your own tasks',
    slotHelp: 'Write your own instructions for an AI chat and keep them as a task.',
    make: 'Make your own task',
    change: 'Change this task',
    remove: 'Delete this task',
    removed: 'Task deleted.',
    saved: 'Task saved.',
    added: 'Task added.',
    formNew: 'Make your own task',
    formEdit: 'Change your task',
    fName: 'Name of the task',
    fStart: 'Where does it start?',
    startAi: 'From the AI screen',
    startJob: 'From a job',
    fText: 'Instructions',
    fTextHelp: 'Write what you want the AI to do. You can use the words below. The page fills them in.',
    fAnswer: 'What happens to the answer?',
    answerNone: 'Nothing. I will read it in the chat.',
    answerNotes: 'Save it to the job\'s notes',
    wordsHeading: 'Words you can use',
    wordIn: 'in your instructions',
    wordOut: 'not used yet',
    outsideWord: '{name} is not a word this task can fill in. It stays in the question as plain text.',
    save: 'Save the task',
    cancel: 'Cancel',
    needName: 'Please give the task a name.',
    needText: 'Please write the instructions.',
    tooLong: 'The instructions are too long. Keep them under {n} characters.',
    panelTitle: 'Your own AI tasks',
    panelMake: 'Make a task for this job',
    panelHelp: 'Pick one of your tasks to use it with this job.',
    needJob: 'Open this task from a job.',
    answerReady: 'Your answer is ready. Open the job to add it to the notes.',
    answerEmpty: 'The job for this answer is not here any more.',
    openJob: 'Open the job',
    sharedFound: 'This is a shared task. You can add it as your own.',
    sharedTooLong: 'That shared task is too long to read.',
    sharedNoName: 'That shared task has no name.',
    sharedNoText: 'That shared task has no instructions.',
    sharedTextTooLong: 'The instructions in that shared task are too long.',
    sharedName: 'Name: {name}',
    sharedStart: 'Starts from: {where}',
    sharedAnswer: 'The answer: {what}',
    sharedOutside: 'These words will not be filled in: {names}.',
    sharedAdd: 'Add it as my task',
    sharedAlready: 'You already have this task.',
    sharedDone: 'Added. It is in your list of tasks.',
    sharedDoneJob: 'Added. Open a job to use it.',
    shareLabel: 'Copy this recipe',
    shareDone: 'Copied. Send it to a friend. They paste it on the AI screen to add it.',
    blurbAi: 'Your own task.',
    blurbJob: 'Your own task, for a job.',
    'word.profile': 'what you chose to share in About me',
    'word.job': 'the job: title, company, place, stage and what they ask for',
    'word.title': 'the job title',
    'word.org': 'the company or place',
    'word.where': 'where the job is',
    'word.asks': 'what the job asks for',
    'word.posting': 'the posting text, if you pasted it',
    'word.events': 'the events you starred',
    'word.replyLanguage': 'the language you want answers in',
    noEvents: '(no starred events coming up)',
  },
  css: `
    .custom-form { display: grid; gap: .25rem; max-width: 40rem; }
    .custom-words { margin: .25rem 0; padding-left: 1.25rem; }
    .custom-words .custom-out { color: var(--muted); }
    .custom-warn { color: var(--danger); font-weight: 600; margin: .25rem 0; }
    .custom-problem { color: var(--danger); font-weight: 600; margin: 0; }
    .custom-text { white-space: pre-wrap; overflow-wrap: anywhere; }
    .custom-buttons { display: flex; flex-wrap: wrap; gap: .5rem; margin: .5rem 0; }
  `,
  logic: {
    MAX_NAME: 60,
    MAX_TEXT: 3000,        // characters in the instructions
    MAX_SHARED: 6000,      // characters in a pasted shared task; more than this is refused unread
    POSTING_MAX: 4000,
    EVENTS_MAX: 10,
    HEADER: '[A task to share, from Search Desk]',
    DIVIDER: '-----',
    WORDS_AI: ['profile', 'events', 'replyLanguage'],
    WORDS_JOB: ['profile', 'job', 'title', 'org', 'where', 'asks', 'posting', 'events', 'replyLanguage'],

    // The words a task may use, by where it starts.
    allowedFor(startsFrom) {
      return startsFrom === 'job' ? this.WORDS_JOB.slice() : this.WORDS_AI.slice();
    },
    // The {names} in a text, once each, in order.
    wordsIn(text) {
      const out = [], re = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
      let m;
      while ((m = re.exec(String(text == null ? '' : text)))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
      return out;
    },
    // The words in the text that this kind of task cannot fill in. They stay visible as {name} in the question.
    outside(text, startsFrom) {
      const ok = this.allowedFor(startsFrom);
      return this.wordsIn(text).filter((n) => ok.indexOf(n) < 0);
    },

    oneLine(v, max) {
      let t = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F​-‍⁠﻿]/g, ' ').replace(/\s+/g, ' ').trim();
      if (max && t.length > max) t = t.slice(0, max).trim();
      return t;
    },
    // Tidy what a person typed. -> { ok: true, task: {name, text, startsFrom, answer} } or { ok: false, problem } where
    // problem is a string key. "Save to the job's notes" only makes sense for a task that starts from a job.
    clean(input) {
      const i = input || {};
      const name = this.oneLine(i.name, this.MAX_NAME);
      if (!name) return { ok: false, problem: 'needName' };
      const text = String(i.text == null ? '' : i.text).replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‍⁠﻿]/g, '')
        .split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
      if (!text.trim()) return { ok: false, problem: 'needText' };
      if (text.length > this.MAX_TEXT) return { ok: false, problem: 'tooLong' };
      const startsFrom = i.startsFrom === 'job' ? 'job' : 'ai';
      const answer = startsFrom === 'job' && i.answer === 'job-notes' ? 'job-notes' : 'none';
      return { ok: true, task: { name: name, text: text, startsFrom: startsFrom, answer: answer } };
    },

    // ---- sharing ----
    // The task as plain text. "Words used" is only for the reader; reading ignores it.
    shareText(task) {
      const used = this.wordsIn(task.text).map((n) => '{' + n + '}').join(', ') || 'none';
      return [
        this.HEADER,
        'Name: ' + task.name,
        'Starts from: ' + (task.startsFrom === 'job' ? 'job' : 'ai'),
        'Answer: ' + (task.answer === 'job-notes' ? 'job-notes' : 'none'),
        'Words used: ' + used,
        '',
        'Instructions (between the lines):',
        this.DIVIDER,
        task.text,
        this.DIVIDER,
        '',
      ].join('\n');
    },
    // Read pasted text. -> null when it is not a shared task (so the app can try other readings),
    // { ok: false, problem } (a string key) when it is one but cannot be used, or { ok: true, task }.
    // The text is untrusted: it is only ever read as text, and the length is checked before anything else.
    parseShared(raw) {
      let t = String(raw == null ? '' : raw);
      if (t.indexOf('A task to share') < 0) return null;
      t = t.replace(/\r\n?/g, '\n').replace(/[​-‍⁠﻿]/g, '').replace(/ /g, ' ');
      const head = /^[ \t>*`]*\[A task to share, from Search Desk\][ \t`*]*$/im.exec(t);
      if (!head) return null;
      if (t.length > this.MAX_SHARED) return { ok: false, problem: 'sharedTooLong' };
      const lines = t.slice(head.index + head[0].length).split('\n');
      let at = -1;
      for (let i = 0; i < lines.length && at < 0; i++) if (/^\s*instructions\b/i.test(lines[i])) at = i;
      if (at < 0) return { ok: false, problem: 'sharedNoText' };
      const field = (label) => {
        const re = new RegExp('^\\s*' + label + '\\s*:\\s*(.*)$', 'i');
        for (let i = 0; i < at; i++) { const m = re.exec(lines[i]); if (m) return m[1].trim(); }
        return '';
      };
      const body = lines.slice(at + 1);
      let first = -1, last = -1;
      body.forEach((l, i) => { if (/^\s*-{5,}\s*$/.test(l)) { if (first < 0) first = i; last = i; } });
      if (first < 0) return { ok: false, problem: 'sharedNoText' };
      const text = body.slice(first + 1, last === first ? body.length : last).join('\n');
      const r = this.clean({
        name: field('name'), text: text,
        startsFrom: /^job/i.test(field('starts from')) ? 'job' : 'ai',
        answer: /job.?notes/i.test(field('answer')) ? 'job-notes' : 'none',
      });
      if (r.ok) return r;
      return { ok: false, problem: { needName: 'sharedNoName', needText: 'sharedNoText', tooLong: 'sharedTextTooLong' }[r.problem] };
    },
    // The same name and instructions are already saved.
    hasTask(records, task) {
      return (records || []).some((r) => r && !r.deleted && r.name === task.name && r.text === task.text);
    },

    // ---- the values for the words ----
    // Only these job fields are ever read: never the notes, the link, the dates or the next step.
    jobFacts(job) {
      const j = job || {};
      const title = this.oneLine(j.title, 200), org = this.oneLine(j.org, 200), where = this.oneLine(j.where, 200);
      const asks = (Array.isArray(j.asks) ? j.asks : (j.asks ? [j.asks] : [])).map((a) => this.oneLine(a, 300)).filter(Boolean).join('; ').slice(0, 1000);
      const lines = [];
      [['Job title', title], ['Employer', org], ['Where', where], ['Stage', this.oneLine(j.stage, 20)], ['What they ask for', asks]]
        .forEach((p) => { if (p[1]) lines.push(p[0] + ': ' + p[1]); });
      let posting = String(j.posting == null ? '' : j.posting).replace(/\r\n?/g, '\n').trim();
      if (posting.length > this.POSTING_MAX) {
        posting = posting.slice(0, this.POSTING_MAX);
        const last = posting.charCodeAt(posting.length - 1);
        if (last >= 0xd800 && last <= 0xdbff) posting = posting.slice(0, -1);
        posting = posting.replace(/\s+$/, '');
      }
      return { job: lines.join('\n'), title: title, org: org, where: where, asks: asks, posting: posting };
    },
    // Starred events that have not started: "2026-11-02 | Title | Venue", soonest first, at most EVENTS_MAX.
    eventLines(marks, today) {
      const rows = [];
      (marks || []).forEach((m) => {
        const c = m && !m.deleted && m.status === 'starred' && m.copy;
        if (!c || !c.title || !c.start || String(c.start).slice(0, 10) < today) return;
        rows.push({ start: String(c.start), line: [String(c.start).slice(0, 10), this.oneLine(c.title, 80), this.oneLine(c.venue, 80)].filter(Boolean).join(' | ') });
      });
      rows.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
      return rows.slice(0, this.EVENTS_MAX).map((r) => r.line).join('\n');
    },
    // The reply language from the profile lines the person chose to share ('' when not shared).
    replyLanguageFrom(lines) {
      let out = '';
      (lines || []).forEach((l) => { const m = /^Reply language:\s*(.+)$/.exec(String(l)); if (m && !out) out = m[1].trim(); });
      return out;
    },
    // Everything a task's question is filled with (profile is added by the page). A task that starts from the AI screen
    // gets no job words, so a {job} in it stays visible.
    values(task, sources) {
      const s = sources || {};
      const out = { events: s.events || '', replyLanguage: s.replyLanguage || '' };
      if (task.startsFrom === 'job') Object.assign(out, this.jobFacts(s.job));
      return out;
    },
    dateKey(date) {
      const p = (n) => (n < 10 ? '0' : '') + n;
      return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
    },
    // The suggestion an answer makes: one `job-note`, for the job the question was about. -> array (empty if nothing)
    noteSuggestions(accepted, jobId, taskName) {
      const hit = (accepted || []).filter((a) => a.kind === 'TEXT')[0];
      const text = hit ? String(hit.text || '').trim().slice(0, 4000) : '';
      if (!text || !jobId) return [];
      return [{ kind: 'job-note', key: 'note', target: { job: jobId, text: text, task: String(taskName || '').slice(0, 100) }, why: '' }];
    },
  },

  mount(ctx) {
    const h = ctx.h;
    const L = this.logic;
    let editor = null;                 // the form being filled in: {id, name, text, startsFrom, answer, jobId}
    const registered = {};             // record id -> a stamp of what is registered

    const hashNow = () => { const r = ctx.route(); return [r.tab].concat(r.args).join('/'); };
    const redraw = () => ctx.ui.go(hashNow());
    const wordNote = (name) => ctx.t('word.' + name);
    const placeholdersFor = (startsFrom) => {
      const o = {};
      L.allowedFor(startsFrom).forEach((n) => { o[n] = wordNote(n); });
      return o;
    };

    // ---- the recipe for one saved task ----
    function recipeFor(rec, task) {
      const isJob = task.startsFrom === 'job';
      const jobIn = (opts) => ((opts && opts.args) || [])[0];
      return {
        id: rec.id,
        custom: true,
        title: task.name,
        blurb: ctx.t(isJob ? 'blurbJob' : 'blurbAi'),
        listed: !isJob,              // a task that starts from a job opens from that job
        noEdit: true,                // it has its own "Change this task"
        template: task.text,
        placeholders: placeholdersFor(task.startsFrom),
        budget: 0,
        needs(c, opts) {
          if (!isJob) return [];
          const id = jobIn(opts);
          const job = id ? c.store.get(id) : null;
          return job && job.type === 'job' && !job.deleted ? [] : [{ text: ctx.t('needJob'), go: 'jobs' }];
        },
        data(c, opts) {
          const id = jobIn(opts), job = isJob && id ? c.store.get(id) : null;
          return L.values(task, {
            job: job && job.type === 'job' && !job.deleted ? job : null,
            events: L.eventLines(c.store.all('event-mark'), L.dateKey(c.now())) || ctx.t('noEvents'),
            replyLanguage: L.replyLanguageFrom(c.profileLines()),
          });
        },
        answer: task.answer === 'job-notes' ? 'text' : null,
        keep(c, opts) { return task.answer === 'job-notes' ? { job: jobIn(opts) || '' } : {}; },
        apply(result) {
          const jobId = (result.prompt && result.prompt.keep && result.prompt.keep.job) || '';
          const job = jobId ? ctx.store.get(jobId) : null;
          if (!job || job.type !== 'job' || job.deleted) return { suggestions: [], text: ctx.t('answerEmpty') };
          const sug = L.noteSuggestions(result.accepted, jobId, task.name);
          if (!sug.length) return { suggestions: [], text: ctx.t('answerEmpty') };
          return {
            suggestions: sug, text: ctx.t('answerReady'),
            render(el) {
              el.append(h('p', { class: 'custom-text', 'data-test': 'custom-answer' }, sug[0].target.text),
                h('button', { type: 'button', 'data-test': 'custom-open-job', on: { click: () => ctx.ui.go('jobs/' + jobId) } }, ctx.t('openJob')));
            },
          };
        },
        copies: [{ id: 'share', label: ctx.t('shareLabel'), done: ctx.t('shareDone'), text: () => L.shareText(task) }],
      };
    }

    // Keep the registered recipes the same as the saved tasks: add new ones, replace changed ones, drop deleted ones.
    function sync() {
      const seen = {};
      ctx.store.all('recipe-custom').forEach((rec) => {
        const r = L.clean(rec);
        if (!r.ok) return;
        seen[rec.id] = true;
        const stamp = rec.updated + '|' + rec.id;
        if (registered[rec.id] === stamp) return;
        ctx.recipe(recipeFor(rec, r.task));
        registered[rec.id] = stamp;
      });
      Object.keys(registered).forEach((id) => {
        if (!seen[id]) { ctx.removeRecipe(id); delete registered[id]; }
      });
    }
    sync();
    ctx.store.subscribe(sync);

    const taskOf = (id) => { const rec = ctx.store.get(id); const r = rec && rec.type === 'recipe-custom' && !rec.deleted ? L.clean(rec) : null; return r && r.ok ? r.task : null; };

    // ---- saving and deleting ----
    function save() {
      const e = editor;
      const r = L.clean(e);
      if (!r.ok) return { problem: r.problem };
      let saved;
      ctx.store.batch('Save a task', () => {
        const old = e.id ? ctx.store.get(e.id) : null;
        saved = ctx.store.put(Object.assign({}, old || {}, r.task, { type: 'recipe-custom' }));
      });
      sync();
      editor = null;
      ctx.ui.toast(ctx.t('saved'), { undo: true });
      const job = e.jobId || ctx.route().args[1] || '';
      ctx.ui.go(r.task.startsFrom === 'job' ? (job ? 'ai/' + saved.id + '/' + job : 'ai') : 'ai/' + saved.id);
      return null;
    }
    function remove(id) {
      ctx.store.batch('Delete a task', () => ctx.store.remove(id));
      sync();
      ctx.ui.toast(ctx.t('removed'), { undo: true });
      ctx.ui.go('ai');
    }

    // ---- the form ----
    function drawForm(el) {
      const e = editor;
      const problem = h('p', { class: 'custom-problem', role: 'alert', 'data-test': 'custom-problem' });
      const name = h('input', { type: 'text', id: 'custom-name', maxlength: String(L.MAX_NAME), 'data-test': 'custom-name' });
      name.value = e.name;
      name.addEventListener('input', () => { e.name = name.value; });
      const start = h('select', { id: 'custom-start', 'data-test': 'custom-start' },
        h('option', { value: 'ai' }, ctx.t('startAi')), h('option', { value: 'job' }, ctx.t('startJob')));
      start.value = e.startsFrom;
      start.addEventListener('change', () => {
        e.startsFrom = start.value;
        if (e.startsFrom !== 'job') e.answer = 'none';
        redraw();
      });
      const text = h('textarea', { id: 'custom-text', rows: '8', maxlength: String(L.MAX_TEXT), 'data-test': 'custom-text' });
      text.value = e.text;
      const wordsBox = h('div', {}), warnBox = h('div', { role: 'status', 'data-test': 'custom-warnings' });
      function fillWords() {
        wordsBox.textContent = '';
        warnBox.textContent = '';
        const used = L.wordsIn(text.value);
        const ul = h('ul', { class: 'custom-words', 'data-test': 'custom-words' });
        L.allowedFor(e.startsFrom).forEach((n) => {
          const on = used.indexOf(n) >= 0;
          ul.append(h('li', { class: on ? '' : 'custom-out' }, h('code', {}, '{' + n + '}'), ' - ' + wordNote(n) + ' (' + ctx.t(on ? 'wordIn' : 'wordOut') + ')'));
        });
        wordsBox.append(ul);
        L.outside(text.value, e.startsFrom).forEach((n) => {
          warnBox.append(h('p', { class: 'custom-warn', 'data-test': 'custom-warn' }, ctx.t('outsideWord', { name: '{' + n + '}' })));
        });
      }
      text.addEventListener('input', () => { e.text = text.value; fillWords(); });
      fillWords();
      const parts = [
        h('h3', {}, ctx.t(e.id ? 'formEdit' : 'formNew')),
        h('label', { for: 'custom-name' }, ctx.t('fName')), name,
        h('label', { for: 'custom-start' }, ctx.t('fStart')), start,
        h('label', { for: 'custom-text' }, ctx.t('fText')), h('p', { class: 'muted' }, ctx.t('fTextHelp')), text,
        h('h4', {}, ctx.t('wordsHeading')), wordsBox, warnBox,
      ];
      if (e.startsFrom === 'job') {
        const ans = h('select', { id: 'custom-answer', 'data-test': 'custom-answer-kind' },
          h('option', { value: 'none' }, ctx.t('answerNone')), h('option', { value: 'job-notes' }, ctx.t('answerNotes')));
        ans.value = e.answer;
        ans.addEventListener('change', () => { e.answer = ans.value; });
        parts.push(h('label', { for: 'custom-answer' }, ctx.t('fAnswer')), ans);
      }
      parts.push(problem, h('div', { class: 'custom-buttons' },
        h('button', { type: 'submit', class: 'primary', 'data-test': 'custom-save' }, ctx.t('save')),
        h('button', { type: 'button', 'data-test': 'custom-cancel', on: { click: () => { editor = null; redraw(); } } }, ctx.t('cancel'))));
      el.append(h('form', { class: 'custom-form', 'data-test': 'custom-form', novalidate: 'novalidate', on: { submit: (ev) => {
        ev.preventDefault();
        e.name = name.value; e.text = text.value;
        const out = save();
        if (out) {
          problem.textContent = ctx.t(out.problem, { n: L.MAX_TEXT });
        }
      } } }, parts));
    }

    function openForm(init) {
      editor = Object.assign({ id: '', name: '', text: '', startsFrom: 'ai', answer: 'none', jobId: '' }, init);
    }

    // ---- the AI screen block ----
    ctx.slot('ai', {
      id: 'custom',
      title: ctx.t('slotTitle'),
      order: 50,
      render(el, info) {
        if (editor) { drawForm(el); return; }
        const sel = info && info.selected;
        const mine = sel && sel.custom && taskOf(sel.id);
        const row = h('div', { class: 'custom-buttons' },
          h('button', { type: 'button', 'data-test': 'custom-new', on: { click: () => { openForm({}); redraw(); } } }, ctx.t('make')));
        if (mine) {
          row.append(
            h('button', { type: 'button', 'data-test': 'custom-edit', on: { click: () => {
              openForm(Object.assign({ id: sel.id }, mine, { jobId: ctx.route().args[1] || '' })); redraw();
            } } }, ctx.t('change')),
            h('button', { type: 'button', 'data-test': 'custom-delete', on: { click: () => remove(sel.id) } }, ctx.t('remove')));
        }
        el.append(h('p', { class: 'muted' }, ctx.t('slotHelp')), row);
      },
      // Pasted text that is a shared task: show what is in it and offer to add it. Nothing is saved until the tap.
      paste(raw) {
        const r = L.parseShared(raw);
        if (!r) return null;
        if (!r.ok) return { text: ctx.t(r.problem) };
        const task = r.task, state = { added: false };
        return {
          text: ctx.t('sharedFound'),
          render(el) {
            const outside = L.outside(task.text, task.startsFrom);
            const have = L.hasTask(ctx.store.all('recipe-custom'), task);
            el.append(h('div', { 'data-test': 'custom-shared' },
              h('p', {}, h('strong', {}, ctx.t('sharedName', { name: task.name }))),
              h('p', {}, ctx.t('sharedStart', { where: ctx.t(task.startsFrom === 'job' ? 'startJob' : 'startAi') })),
              h('p', {}, ctx.t('sharedAnswer', { what: ctx.t(task.answer === 'job-notes' ? 'answerNotes' : 'answerNone') })),
              h('pre', { class: 'custom-text', tabindex: '0', 'data-test': 'custom-shared-text' }, task.text),
              outside.length ? h('p', { class: 'custom-warn' }, ctx.t('sharedOutside', { names: outside.map((n) => '{' + n + '}').join(', ') })) : null,
              state.added || have
                ? h('p', { role: 'status', 'data-test': 'custom-shared-done' }, ctx.t(state.added ? (task.startsFrom === 'job' ? 'sharedDoneJob' : 'sharedDone') : 'sharedAlready'))
                : h('button', { type: 'button', class: 'primary', 'data-test': 'custom-shared-add', on: { click: () => {
                  let saved;
                  ctx.store.batch('Add a shared task', () => { saved = ctx.store.put(Object.assign({}, task, { type: 'recipe-custom' })); });
                  sync();
                  state.added = true;
                  ctx.ui.toast(ctx.t('added'), { undo: true });
                  ctx.ui.go(task.startsFrom === 'job' ? 'ai' : 'ai/' + saved.id);
                } } }, ctx.t('sharedAdd'))));
          },
        };
      },
    });

    // ---- on a job: use your job tasks, or make one for this job ----
    ctx.slot('job.panel', {
      id: 'custom-tasks',
      title: ctx.t('panelTitle'),
      order: 50,
      render(el, job) {
        const list = ctx.store.all('recipe-custom').map((rec) => ({ rec: rec, r: L.clean(rec) }))
          .filter((x) => x.r.ok && x.r.task.startsFrom === 'job');
        const row = h('div', { class: 'custom-buttons', 'data-test': 'custom-job-tasks' });
        list.forEach((x) => row.append(h('button', { type: 'button', 'data-test': 'custom-use', 'data-id': x.rec.id,
          on: { click: () => ctx.ui.go('ai/' + x.rec.id + '/' + job.id) } }, x.r.task.name)));
        row.append(h('button', { type: 'button', 'data-test': 'custom-job-new', on: { click: () => {
          openForm({ startsFrom: 'job', jobId: job.id });
          ctx.ui.go('ai');
        } } }, ctx.t('panelMake')));
        if (list.length) el.append(h('p', { class: 'muted' }, ctx.t('panelHelp')));
        el.append(row);
      },
    });
  },
});
