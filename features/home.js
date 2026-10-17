// features/home.js  (T2.3, DESIGN 8.1) The "Today" screen.
//
// Owns no record type. It reads job, event-mark, suggestion and prompt records and lists what needs the person.
// logic.today(records, now) is pure: records = every record (tombstones are skipped here too), now = Date or ms.
// It returns an ordered array of items. Every item has `kind` and `days` (whole local calendar days from today:
// 0 today, 2 in two days, -3 three days late; null when it has no day). Shapes by kind:
//   followUp   { kind, jobId, title, org, date, days, overdue }   a non-closed job with followUp <= today
//   interview  { kind, jobId, title, org, date, days }            non-closed job, interviewAt today..today+7
//                                                                 (date may include 'THH:MM')
//   closes     { kind, jobId, title, org, date, days }            a SAVED job whose closes is today..today+7
//   event      { kind, markId, eventId, title, date, days }       starred event starting today..today+6
//   jobNote    { kind, jobId, title, count, days: null }          a `job-note` suggestion waiting (from a custom task)
//                                                                 for a live job; one per job. Never counted below.
//   suggestions{ kind, recipe, count, days: null }                one per recipe, status 'new' (not job-note)
//   question   { kind, code, recipe, created, days: null }        the latest question still waiting for an answer
// Order: overdue follow-ups (most late first); then everything with a day, soonest first (ties: follow-up,
// interview, closes, event, then the time, then the title); then suggestions; then the question.
// "This week" for events means today and the next six days, not the calendar week, so the list is never empty
// just because it is Sunday.
// Pending question: the newest `prompt` created in the last 7 days whose code no suggestion carries. A prompt
// for a task that never makes suggestions stays "waiting" for those 7 days (a known limit; T3.x may add an
// "answered" mark to the prompt record).
// The backup nudge is not an item: it comes from ctx.backupNudge().
Desk.register({
  id: 'home',
  name: 'Today',
  purpose: 'See what needs you today: follow-ups, interviews and closing dates.',
  types: [],
  uses: ['jobs', 'events', 'profile', 'help'],
  strings: {
    tabLabel: 'Today',
    heading: 'Today',
    rowFollowUp: 'Follow up: {title} — {when}',
    rowInterview: 'Interview: {title} — {when}',
    rowCloses: 'Posting closes: {title} — {when}',
    rowEvent: 'Starred event: {title} — {when}',
    rowNoTitle: 'a job',
    rowJobNote: 'An answer is waiting for the notes on {title}',
    rowSuggestionsOne: '1 suggestion waiting: {what}',
    rowSuggestionsMany: '{n} suggestions waiting: {what}',
    rowQuestion: 'Waiting for an answer. Paste it in the AI helper.',
    'what.events': 'events worth going to',
    'what.posting': 'jobs from postings',
    'what.coach': 'interview practice',
    nudgeButton: 'Save a copy',
    emptyHeading: 'Nothing needs you today. Three good first steps:',
    stepJob: 'Add a job you are interested in',
    stepProfile: 'Say what work you look for',
    stepHelp: 'See free help near you',
    nowHeading: 'Needs you now',
    soonHeading: 'Coming up',
    waitingHeading: 'Waiting for you',
    jobsHeading: 'Where your jobs are',
    jobsAll: 'All jobs',
  },
  css: `
    .home-list { list-style: none; padding: 0; margin: 0 0 1.25rem; display: grid; gap: .5rem; }
    .home-item { background: var(--surface); border: 1px solid var(--line); border-left: .3rem solid var(--line-strong); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
    .home-item[data-kind="interview"] { border-left-color: var(--accent); }
    .home-item[data-kind="event"] { border-left-color: var(--ok); }
    .home-item[data-today="true"] { border-left-color: var(--warn-edge); }
    .home-item[data-kind="followUp"][data-overdue="true"] { border-left-color: var(--danger); }
    .home-open { display: flex; align-items: center; justify-content: space-between; gap: .75rem; width: 100%; text-align: left;
      border: 0; border-radius: 0; background: transparent; font: inherit; font-weight: 500; padding: .85rem 1rem; min-height: 3.25rem; }
    .home-open::after { content: ""; flex: none; width: .55rem; height: .55rem; border: solid var(--muted); border-width: 2px 2px 0 0; transform: rotate(45deg); margin-right: .25rem; }
    .home-open:hover { background: var(--surface-2); }
    .home-open:hover::after { border-color: var(--accent); }
    .home-nudge { padding: .85rem 1rem; border-radius: var(--radius); margin: 0 0 1.25rem; display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; justify-content: space-between;
      background: var(--warn-soft); color: var(--text); border: 1px solid transparent; }
    .home-nudge p { margin: 0; flex: 1 1 14rem; font-weight: 600; }
    .home-empty { display: grid; gap: .5rem; max-width: 32rem; margin: 0 0 1rem; }
    .home-empty p { margin: 0 0 .25rem; font-weight: 600; font-size: 1.05rem; }
    .home-empty button { display: flex; align-items: center; justify-content: space-between; gap: .75rem; text-align: left; padding: .85rem 1rem;
      min-height: 3.25rem; border-color: var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
    .home-empty button::after { content: ""; flex: none; width: .55rem; height: .55rem; border: solid var(--accent); border-width: 2px 2px 0 0; transform: rotate(45deg); margin-right: .25rem; }

    /* ---- The dashboard (see the layout kit in core/desk.css) ----
       On a wide screen the Today list takes the main column and the job pipeline sits beside it. On a phone the
       two are one under another, in the same order. */
    .home-group { margin: 0 0 1.5rem; }
    .home-group > h3 { margin: 0 0 .55rem; font-size: 1.05rem; }
    .home-group-count { color: var(--muted); font-weight: 600; }
    .home-pipe { list-style: none; padding: 0; margin: 0 0 1rem; display: grid; gap: .4rem; }
    .home-pipe-row { display: flex; align-items: center; gap: .75rem; padding: .5rem .7rem; background: var(--surface);
      border: 1px solid var(--line); border-radius: var(--radius-sm); box-shadow: var(--shadow); }
    .home-pipe-name { flex: 1 1 auto; font-weight: 600; font-size: .95rem; }
    /* A plain <progress>, so it reads out loud and needs no inline width. */
    .home-pipe-bar { flex: 0 1 7rem; width: 7rem; height: .5rem; appearance: none; border: 0; border-radius: 999px;
      background: var(--surface-2); overflow: hidden; }
    .home-pipe-bar::-webkit-progress-bar { background: var(--surface-2); border-radius: 999px; }
    .home-pipe-bar::-webkit-progress-value { background: var(--accent); border-radius: 999px; }
    .home-pipe-bar::-moz-progress-bar { background: var(--accent); border-radius: 999px; }
    .home-pipe-row[data-stage="closed"] .home-pipe-bar::-webkit-progress-value { background: var(--line-strong); }
    .home-pipe-row[data-stage="closed"] .home-pipe-bar::-moz-progress-bar { background: var(--line-strong); }
    .home-pipe-n { flex: none; min-width: 1.5rem; text-align: right; font-weight: 700; font-size: 1.05rem; }
  `,
  logic: {
    WINDOW: 7,
    KIND_ORDER: { followUp: 0, interview: 1, closes: 2, event: 3 },

    // 'YYYY-MM-DD' for a date text, a date-and-time text without a zone, or an ISO time (shown in local time).
    dayOf(v) {
      if (typeof v !== 'string' || !v) return '';
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v)) return v.slice(0, 10);
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : this.dateKey(d);
    },
    dateKey(date) {
      const p = (n) => (n < 10 ? '0' : '') + n;
      return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
    },
    // Whole days from day key a to day key b.
    daysBetween(a, b) {
      const n = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
      return Math.round(n(b) - n(a));
    },

    today(records, now) {
      const L = this;
      const nowDate = now instanceof Date ? now : new Date(now);
      const todayKey = L.dateKey(nowDate);
      const live = (Array.isArray(records) ? records : []).filter((r) => r && typeof r === 'object' && !r.deleted);
      const items = [];
      const diff = (v) => { const k = L.dayOf(v); return k ? L.daysBetween(todayKey, k) : null; };
      const inWindow = (d, last) => d !== null && d >= 0 && d <= last;

      live.filter((r) => r.type === 'job' && r.stage !== 'closed').forEach((j) => {
        const base = { jobId: j.id, title: j.title || '', org: j.org || '' };
        const f = diff(j.followUp);
        if (f !== null && f <= 0) items.push(Object.assign({ kind: 'followUp', date: j.followUp, days: f, overdue: f < 0 }, base));
        const iv = diff(j.interviewAt);
        if (inWindow(iv, L.WINDOW)) items.push(Object.assign({ kind: 'interview', date: j.interviewAt, days: iv }, base));
        const c = diff(j.closes);
        if (j.stage === 'saved' && inWindow(c, L.WINDOW)) items.push(Object.assign({ kind: 'closes', date: j.closes, days: c }, base));
      });

      live.filter((r) => r.type === 'event-mark' && r.status === 'starred' && r.copy).forEach((m) => {
        const d = diff(m.copy.start);
        if (inWindow(d, L.WINDOW - 1)) {
          items.push({ kind: 'event', markId: m.id, eventId: m.eventId, title: m.copy.title || '', date: m.copy.start, days: d });
        }
      });

      const key = (it) => (it.kind === 'followUp' && it.overdue ? 0 : 1);
      items.sort((a, b) => {
        if (key(a) !== key(b)) return key(a) - key(b);
        if (a.days !== b.days) return a.days - b.days;
        if (a.kind !== b.kind) return L.KIND_ORDER[a.kind] - L.KIND_ORDER[b.kind];
        if (String(a.date) !== String(b.date)) return String(a.date) < String(b.date) ? -1 : 1;
        return String(a.title).localeCompare(String(b.title));
      });

      // A waiting job-note suggestion: one row per live job. One for a job that is gone is left out.
      const jobsById = {};
      live.filter((r) => r.type === 'job').forEach((j) => { jobsById[j.id] = j; });
      const notes = {}, noteOrder = [];
      live.filter((r) => r.type === 'suggestion' && r.status === 'new' && r.kind === 'job-note').forEach((s) => {
        const id = s.target && typeof s.target === 'object' ? s.target.job : '';
        if (!id || !jobsById[id]) return;
        if (!notes[id]) { notes[id] = 0; noteOrder.push(id); }
        notes[id]++;
      });
      noteOrder.sort((a, b) => String(jobsById[a].title).localeCompare(String(jobsById[b].title)) || (a < b ? -1 : 1))
        .forEach((id) => items.push({ kind: 'jobNote', jobId: id, title: jobsById[id].title || '', count: notes[id], days: null }));

      const counts = {};
      live.filter((r) => r.type === 'suggestion' && r.status === 'new' && r.kind !== 'job-note').forEach((s) => {
        const k = s.recipe || '';
        counts[k] = (counts[k] || 0) + 1;
      });
      Object.keys(counts).sort().forEach((k) => items.push({ kind: 'suggestions', recipe: k, count: counts[k], days: null }));

      const q = L.pendingQuestion(live, nowDate);
      if (q) items.push({ kind: 'question', code: q.code, recipe: q.recipe || '', created: q.created, days: null });
      return items;
    },

    // The Today items in the three groups the dashboard shows, keeping the order they came in.
    //   now:     late or today          soon: dated, later this week
    //   waiting: no day at all (an answer, or a suggestion, is waiting on the person)
    // -> { now: [item], soon: [item], waiting: [item] }. Does not change the list it is given.
    groups(items) {
      const out = { now: [], soon: [], waiting: [] };
      (Array.isArray(items) ? items : []).forEach((it) => {
        if (!it || typeof it !== 'object') return;
        if (it.days === null || it.days === undefined) out.waiting.push(it);
        else if (it.days <= 0) out.now.push(it);
        else out.soon.push(it);
      });
      return out;
    },

    // How many jobs sit at each stage, and the biggest of those counts (so a bar can be drawn to scale).
    // -> { rows: [{stage, count}], top }
    pipeline(records) {
      const live = (Array.isArray(records) ? records : []).filter((r) => r && typeof r === 'object' && !r.deleted && r.type === 'job');
      const stages = String(this.STAGES || 'saved,applied,interview,offer,closed').split(',');
      const counts = {};
      live.forEach((j) => { counts[j.stage] = (counts[j.stage] || 0) + 1; });
      const rows = stages.map((stage) => ({ stage: stage, count: counts[stage] || 0 }));
      return { rows: rows, top: rows.reduce((m, r) => Math.max(m, r.count), 0) };
    },
    STAGES: 'saved,applied,interview,offer,closed',

    // The newest prompt from the last 7 days that no suggestion answers. -> the prompt record or null.
    pendingQuestion(records, nowDate) {
      const answered = {};
      records.forEach((r) => { if (r.type === 'suggestion' && r.code) answered[r.code] = true; });
      const nowMs = nowDate.getTime();
      let best = null, bestMs = -Infinity;
      records.forEach((r) => {
        if (r.type !== 'prompt' || !r.code || answered[r.code]) return;
        const ms = Date.parse(r.created);
        if (!isFinite(ms) || nowMs - ms > 7 * 86400000 || ms <= bestMs) return;
        best = r; bestMs = ms;
      });
      return best;
    },
  },

  mount(ctx) {
    const h = ctx.h;
    const logic = this.logic;

    // "today", "in 2 days", "3 days late", plus the time when there is one: "in 2 days, 10am".
    const when = (v) => {
      const rel = ctx.fmt.relative(v.slice(0, 10), ctx.now());
      const tm = ctx.fmt.time(v);
      return tm ? rel + ', ' + tm : rel;
    };

    function describe(it) {
      switch (it.kind) {
        case 'followUp': return { text: ctx.t('rowFollowUp', { title: it.title, when: when(it.date) }), go: 'jobs/' + it.jobId };
        case 'interview': return { text: ctx.t('rowInterview', { title: it.title, when: when(it.date) }), go: 'jobs/' + it.jobId };
        case 'closes': return { text: ctx.t('rowCloses', { title: it.title, when: when(it.date) }), go: 'jobs/' + it.jobId };
        case 'event': return { text: ctx.t('rowEvent', { title: it.title, when: when(it.date) }), go: 'events' };
        case 'jobNote': return { text: ctx.t('rowJobNote', { title: it.title || ctx.t('rowNoTitle') }), go: 'jobs/' + it.jobId };
        case 'suggestions': {
          const what = ctx.t('what.' + it.recipe) === 'what.' + it.recipe ? it.recipe : ctx.t('what.' + it.recipe);
          return { text: ctx.t(it.count === 1 ? 'rowSuggestionsOne' : 'rowSuggestionsMany', { n: it.count, what: what }),
            go: it.recipe === 'events' && ctx.has('events') ? 'events' : 'ai' };
        }
        default: return { text: ctx.t('rowQuestion'), go: 'ai' };
      }
    }

    function stepButton(feature, route, key, test) {
      if (!ctx.has(feature)) return null;
      return h('button', { type: 'button', 'data-test': test, on: { click: () => ctx.ui.go(route) } }, ctx.t(key));
    }

    ctx.slot('tab', {
      id: 'home',
      label: ctx.t('tabLabel'),
      order: 0,
      render(el) {
        const records = ctx.store.all('job')
          .concat(ctx.store.all('event-mark'), ctx.store.all('suggestion'), ctx.store.all('prompt'));
        const items = logic.today(records, ctx.now());
        const groups = logic.groups(items);
        const pipe = logic.pipeline(ctx.store.all('job'));

        // A wide screen gets a dashboard: what needs you on the left, where your jobs are on the right.
        const main = h('div', { class: 'dash-main' });
        const side = h('div', { class: 'dash-side' });
        el.append(h('h2', {}, ctx.t('heading')));
        el.append(h('div', { class: 'dash' }, main, side));

        // The Today items in the three groups. Each row is built where it is used, so every item gets its own row.
        function rowFor(it) {
          const d = describe(it);
          return h('li', { class: 'home-item', 'data-test': 'home-item', 'data-kind': it.kind, 'data-overdue': it.overdue ? 'true' : 'false',
            'data-today': it.days === 0 ? 'true' : 'false' },
            h('button', { type: 'button', class: 'home-open', 'data-test': 'home-open', on: { click: () => ctx.ui.go(d.go) } }, d.text));
        }
        function group(key, heading) {
          const mine = groups[key];
          if (!mine.length) return null;
          const ul = h('ul', { class: 'home-list' });
          mine.forEach((it) => ul.append(rowFor(it)));
          return h('section', { class: 'home-group', 'data-test': 'home-group', 'data-group': key },
            h('h3', {}, ctx.t(heading), ' ', h('span', { class: 'home-group-count' }, String(mine.length))), ul);
        }
        const grouped = [group('now', 'nowHeading'), group('soon', 'soonHeading'), group('waiting', 'waitingHeading')]
          .filter((x) => x);
        main.append(h('div', { 'data-test': 'home-list' }, grouped));

        const slotBox = h('div', { class: 'home-slots' });
        const slotShown = ctx.renderSlot('home', slotBox);

        let nudge = null;
        try { nudge = ctx.backupNudge(); } catch (e) { nudge = null; }
        if (nudge && nudge.show) {
          main.append(h('div', { class: 'home-nudge', 'data-test': 'home-nudge' },
            h('p', {}, nudge.text),
            h('button', { type: 'button', 'data-test': 'home-nudge-go', on: { click: () => ctx.ui.go('data') } }, ctx.t('nudgeButton'))));
        }
        if (pipe.top) {
          const rows = h('ul', { class: 'home-pipe', 'data-test': 'home-pipeline' }, pipe.rows.map((r) =>
            h('li', { class: 'home-pipe-row', 'data-stage': r.stage, 'data-test': 'home-pipe-row' },
              h('span', { class: 'home-pipe-name' }, ctx.t('stage.' + r.stage)),
              h('progress', { class: 'home-pipe-bar', value: String(r.count), max: String(pipe.top),
                'aria-label': ctx.t('stage.' + r.stage) + ': ' + r.count }),
              h('span', { class: 'home-pipe-n' }, String(r.count)))));
          side.append(h('section', { class: 'panel', 'data-test': 'home-pipeline-panel' },
            h('h3', {}, ctx.t('jobsHeading')),
            rows,
            h('p', {}, h('button', { type: 'button', 'data-test': 'home-all-jobs', on: { click: () => ctx.ui.go('jobs') } }, ctx.t('jobsAll')))));
        }
        if (slotShown) side.append(slotBox);
        if (!items.length && !slotShown) {
          main.append(h('div', { class: 'home-empty', 'data-test': 'home-empty' },
            h('p', {}, ctx.t('emptyHeading')),
            stepButton('jobs', 'jobs/new', 'stepJob', 'home-step-job'),
            stepButton('profile', 'profile', 'stepProfile', 'home-step-profile'),
            stepButton('help', 'help', 'stepHelp', 'home-step-help')));
        }
      },
    });
  },
});
