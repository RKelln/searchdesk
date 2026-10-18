// features/jobs.js  (T2.1, DESIGN 8.1) The job tracker.
//
// Record type `job`. Fields: title (required), org, link (https or http only), where, stage
// (saved | applied | interview | offer | closed), applied, followUp, closes, interviewAt, nextStep, notes,
// tags, asks, posting. Only the form fields are edited here. tags, asks and posting are kept as they are
// (a later feature fills them); the detail view shows them if they are there.
//
// Dates: 'YYYY-MM-DD', no time zone, never shifted. `interviewAt` is a date plus an OPTIONAL time, stored as
// local wall-clock text: 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' (no zone, no seconds). The form has a date input and a
// time input; a time without a date is dropped. ctx.fmt.dateTime shows both forms.
//
// Next date (logic.nextDate): by stage, the soonest of these that is still relevant
//   saved: closes (not after it has passed), followUp (overdue counts)
//   applied: followUp (overdue counts), interviewAt (not after it has passed)
//   interview: interviewAt (not after it has passed), followUp (overdue counts)
//   offer: followUp (overdue counts)      closed: nothing
// Ties go followUp, then interview, then closes.
//
// Routes (ctx.route() -> {tab, args}; this screen reads the hash through ctx.ui.go):
//   #jobs  list      #jobs/new  add form      #jobs/<id>  detail      #jobs/<id>/edit  edit form
//   #jobs/new/<suggestion id>  add form filled from a `job-draft` suggestion (T3.5, recipe-posting)
// job-draft suggestions (status 'new') show as a lane at the top of the list: "Take it" opens the form above, "Not for
// me" sets the status to 'dismissed'. The draft is the suggestion's `target`:
//   {title, org, where, closes, link, posting, asks: [text], notes}   (all optional; only the form's own fields are used)
// Saving that form puts `posting` and `asks` on the job (they have no form field) and sets the suggestion's status to
// 'taken' in the same batch. That is why this feature lists `suggestion` among its types.
// `job-note` suggestions (T3.8, recipe-custom: "save the answer to this job's notes") show in that job's detail view as
// "Answers ready for your notes": target {job: <job id>, text, task}. "Add to notes" appends the text to `notes` with a
// date (logic.appendNote) and sets the suggestion to 'taken' in one undo step; "Not for me" sets it to 'dismissed'.
// Only this feature writes `job`, so the AI's answer reaches the notes by the person's tap and through here.
// The stage filter lives in a closure inside mount (it survives the shell's re-renders).
Desk.register({
  id: 'jobs',
  name: 'Jobs',
  purpose: 'Keep track of the jobs you want or have applied for.',
  types: ['job', 'suggestion'],
  strings: {
    tabLabel: 'Jobs',
    heading: 'Your jobs',
    add: 'Add a job',
    empty: 'No jobs yet. Add the first one you find.',
    emptyFilter: 'No jobs in this group.',
    filterLabel: 'Show jobs by stage',
    filterAll: 'All',
    searchLabel: 'Find a job',
    searchHint: 'Type any words from the job',
    lateBadge: 'Late',
    lateWhy: 'You were due {days} days ago and nothing has happened since.',
    lateAfterLabel: 'Mark a job as late after this many days',
    stageLabel: 'Stage',
    stagesLabel: 'Move to another stage',
    open: 'Open',
    back: 'Back to your jobs',
    closeJob: 'Close this job',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    addTitle: 'Add a job',
    editTitle: 'Edit this job',
    fTitle: 'Job title (needed)',
    fOrg: 'Company or place',
    fLink: 'Link to the posting',
    fLinkHelp: 'Start with https://',
    fWhere: 'Where',
    fApplied: 'Date you applied',
    fFollowUp: 'Follow up on',
    fCloses: 'Posting closes on',
    fInterviewDate: 'Interview date',
    fInterviewTime: 'Interview time (if you know it)',
    fNextStep: 'Next step',
    fNotes: 'Notes',
    needTitle: 'Please give the job a title.',
    linkDropped: 'The link was not saved. It must start with https:// or http://.',
    saved: 'Job saved.',
    savedNoLink: 'Job saved, but the link was left out. It must start with https:// or http://.',
    deleted: 'Job deleted.',
    movedTo: 'Moved to {stage}.',
    notFound: 'That job is not here. It may have been deleted.',
    nextFollowUp: 'Follow up',
    nextInterview: 'Interview',
    nextCloses: 'Closes',
    dApplied: 'Applied',
    dFollowUp: 'Follow up',
    dInterview: 'Interview',
    dCloses: 'Closes',
    dNextStep: 'Next step',
    dNotes: 'Notes',
    dTags: 'Tags',
    dAsks: 'What they ask for',
    dPosting: 'The posting',
    dLink: 'Open the posting',
    dWhere: 'Where',
    actionsHeading: 'More you can do',
    draftsHeading: 'Ready for you to check',
    draftFrom: 'From a posting you pasted',
    takeIt: 'Take it',
    notForMe: 'Not for me',
    draftPutAway: 'Put away.',
    notesReadyHeading: 'Answers ready for your notes',
    noteFrom: 'From your task "{task}"',
    noteAdd: 'Add to notes',
    noteAdded: 'Added to your notes.',
    noteNoRoom: 'The notes are full. Make some room, then try again.',
    viewLabel: 'How to show your jobs',
    viewList: 'List',
    viewBoard: 'Board',
    boardNone: 'None',
    stageOther: 'Other',
    showOlderClosed: 'Show {n} older closed jobs',
    hideOlderClosed: 'Hide older closed jobs',
    lateWeeks2: '2 weeks',
    lateWeeks3: '3 weeks',
    lateMonth1: '1 month',
  },
  css: `
    .jobs-top { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .jobs-top h2 { margin: 0; }
    .jobs-top-pane { justify-content: flex-end; }
    .jobs-filter { display: flex; flex-wrap: wrap; gap: .4rem; margin: 0 0 1rem; }
    .jobs-filter legend { font-size: .9rem; color: var(--muted); }
    .jobs-filter button { min-height: 40px; padding: .35rem .9rem; border-radius: 999px; font-size: .95rem; }
    .jobs-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .75rem; }
    .jobs-row { padding: .9rem 1rem 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); container-type: inline-size; }
    .jobs-row h3 { margin: 0; font-size: 1.15rem; }
    .jobs-row-open { display: flex; align-items: center; justify-content: space-between; gap: .5rem; width: 100%; padding: .25rem 0; margin: 0;
      text-align: left; font-size: inherit; font-weight: 700; color: var(--text); background: none; border: 0; border-radius: var(--radius-sm); }
    .jobs-row-open::after { content: ""; flex: none; width: .55rem; height: .55rem; margin-right: .3rem; border: solid var(--muted); border-width: 2px 2px 0 0; transform: rotate(45deg); }
    .jobs-row-open:hover { color: var(--accent); background: none; }
    .jobs-row-open:hover::after { border-color: var(--accent); }
    .jobs-meta { margin: 0 0 .5rem; color: var(--muted); }
    .jobs-next { display: inline-block; font-weight: 650; font-size: .95rem; margin: 0 0 .75rem; padding: .2rem .65rem; border-radius: var(--radius-sm); background: var(--surface-2); border: 1px solid var(--line); }
    .jobs-next[data-when="late"] { background: var(--danger-soft); border-color: transparent; color: var(--danger); }
    .jobs-next[data-when="today"] { background: var(--warn-soft); border-color: transparent; color: var(--warn); }
    .jobs-next[data-kind="interview"][data-when="later"] { background: var(--accent-soft); border-color: transparent; color: var(--accent); }
    .jobs-stages { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 0 0 .5rem; max-width: 32rem; }
    .jobs-stages legend { font-size: .9rem; color: var(--muted); }
    .jobs-row .jobs-stages legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .jobs-stages button { min-width: 0; padding: .4rem .15rem; font-size: .85rem; border-radius: 0; margin-left: -1px; overflow-wrap: normal; word-break: keep-all; }
    @media (max-width: 400px) { .jobs-stages button { font-size: .78rem; letter-spacing: -.01em; } }
    /* The same, but by the card's own width rather than the window's: in a list of cards side by side a narrow
       card must still fit "Interview". The card is a query container (container-type on .jobs-row). */
    @container (max-width: 22rem) { .jobs-row .jobs-stages button { font-size: .76rem; padding: .4rem .1rem; } }
    .jobs-stages button:first-of-type { border-radius: var(--radius-sm) 0 0 var(--radius-sm); margin-left: 0; }
    .jobs-stages button:last-of-type { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
    .jobs-stages button:hover, .jobs-stages button:focus-visible, .jobs-stages button[aria-pressed="true"] { position: relative; z-index: 1; }
    .jobs-form { display: grid; gap: .25rem; max-width: 36rem; }
    .jobs-field { display: grid; gap: .35rem; align-content: start; margin-top: .7rem; min-width: 0; }
    /* Find a job. The box is wide enough to read a word in it and no wider. */
    .jobs-search { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .6rem; margin: 0 0 .75rem; }
    .jobs-search-label { font-weight: 600; }
    .jobs-search-input { flex: 1 1 14rem; max-width: 22rem; }
    .jobs-search-hint { flex: 1 1 100%; margin: 0; font-size: .9em; }
    /* Late. A colour plus the word, never colour alone. */
    .jobs-late { display: inline-block; margin-top: .3rem; padding: .05rem .4rem; border: 1px solid var(--warn-edge);
      border-radius: var(--radius-sm); background: var(--warn-soft); color: var(--text); font-size: .78rem;
      font-weight: 700; }
    .jobs-problem { color: var(--danger); font-weight: 600; margin: 0; }
    .jobs-problem:not(:empty) { padding: .6rem .8rem; border-radius: var(--radius-sm); background: var(--danger-soft); }
    .jobs-form [aria-invalid="true"] { border-color: var(--danger); box-shadow: 0 0 0 3px var(--danger-soft); }
    .jobs-help { margin: 0; color: var(--muted); font-size: .9rem; }
    .jobs-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr)); gap: .75rem 1rem; margin: 1rem 0; }
    .jobs-facts > div { min-width: 0; }
    .jobs-facts > .jobs-fact-wide { grid-column: 1 / -1; }
    .jobs-facts ul { margin: .1rem 0 0; }
    .jobs-back { display: inline-flex; align-items: center; gap: .45rem; padding-left: .75rem; color: var(--accent); border-color: transparent; background: none; }
    .jobs-back::before { content: ""; width: .5rem; height: .5rem; border: solid currentColor; border-width: 0 0 2px 2px; transform: rotate(45deg); }
    [data-test="job-detail"] .jobs-stages { margin: .5rem 0 0; }
    .jobs-facts dt { font-weight: 650; font-size: .85rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    .jobs-facts dd { margin: .1rem 0 0; overflow-wrap: anywhere; }
    .jobs-text { white-space: pre-wrap; overflow-wrap: anywhere; }
    .jobs-detail-buttons { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
    .jobs-drafts { margin: 0 0 1.5rem; }
    .jobs-drafts .jobs-row { border-style: dashed; border-color: var(--accent); background: var(--accent-soft); }
    .jobs-drafts .jobs-detail-buttons { margin-bottom: 0; }

    /* ---- List or board ---- */
    .jobs-view { display: inline-flex; gap: 0; margin: 0 0 1rem; }
    .jobs-view button { min-height: 40px; padding: .35rem 1rem; border-radius: 0; margin-left: -1px; }
    .jobs-view button:first-child { border-radius: var(--radius-sm) 0 0 var(--radius-sm); margin-left: 0; }
    .jobs-view button:last-child { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
    .jobs-view button[aria-pressed="true"] { position: relative; z-index: 1; }

    /* ---- The board: one column per stage ----
       A phone stacks the columns, so there is nothing to scroll sideways. A wide screen puts them side by side
       and gives each one the same share, whether there are five columns or six. */
    .jobs-board { display: grid; gap: .75rem; grid-template-columns: minmax(0, 1fr); margin: 0 0 1rem; align-items: start; }
    .jobs-col { min-width: 0; padding: .6rem; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius); }
    .jobs-col-head { display: flex; align-items: baseline; justify-content: space-between; gap: .5rem; margin: 0 0 .55rem; padding: 0 .3rem; }
    .jobs-col-head h3 { margin: 0; font-size: .95rem; }
    .jobs-col-count { flex: none; color: var(--muted); font-size: .85rem; font-weight: 700; }
    .jobs-col-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
    .jobs-col-empty { margin: 0; padding: .35rem .3rem; color: var(--muted); font-size: .9rem; }
    .jobs-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); box-shadow: var(--shadow); }
    .jobs-card[aria-current="true"] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
    .jobs-card-open { display: block; width: 100%; padding: .6rem .7rem .2rem; text-align: left; font: inherit; font-weight: 650;
      color: var(--text); background: none; border: 0; border-radius: var(--radius-sm); overflow-wrap: anywhere; }
    .jobs-card-open:hover { color: var(--accent); background: var(--surface-2); }
    .jobs-card-org { display: block; margin-top: .15rem; font-weight: 400; font-size: .85rem; color: var(--muted); }
    .jobs-card .jobs-next { margin: .45rem .7rem .6rem; font-size: .8rem; }
    .jobs-older { margin: .4rem .3rem 0; }
    .jobs-older button { width: 100%; font-size: .85rem; }

    @media (min-width: 1100px) {
      .jobs-board { grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
      /* Two fields to a row on a wide screen, so the whole form fits without a long scroll down. A field is
         its own box (label and input together), so it never gets split across the two columns. */
      .jobs-form { max-width: none; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 1.5rem; align-items: start; }
      .jobs-field-wide, .jobs-form > .jobs-help, .jobs-form > .jobs-problem, .jobs-form > .jobs-detail-buttons { grid-column: 1 / -1; }
    }
  `,
  logic: {
    STAGES: ['saved', 'applied', 'interview', 'offer', 'closed'],
    CLOSED_KEEP: 30,   // a closed job stays off the board's Closed column for this many days
    LATE_AFTER: 21,  // a follow-up this many days past and the job is marked late. The person can change it.

    // ---- dates (text only; no clock) ----
    isDate(s) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
      if (!m) return false;
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
    },
    // 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'
    isDateTime(s) {
      s = String(s || '');
      if (s.length === 10) return this.isDate(s);
      return s.length === 16 && s.charAt(10) === 'T' && this.isDate(s.slice(0, 10)) && /^([01]\d|2[0-3]):[0-5]\d$/.test(s.slice(11));
    },
    // Today's local date as 'YYYY-MM-DD', from a Date the caller gives.
    dateKey(date) {
      const p = (n) => (n < 10 ? '0' : '') + n;
      return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
    },
    // Whole days from a to b (both 'YYYY-MM-DD...'): 0 same day, 1 tomorrow.
    daysBetween(a, b) {
      const n = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
      return Math.round(n(b) - n(a));
    },

    // ---- the next date ----
    // -> { kind: 'followUp' | 'interview' | 'closes', date } or null. `today` is 'YYYY-MM-DD'.
    nextDate(job, today) {
      const L = this;
      const stage = job && job.stage;
      // [kind, field, past counts?]
      const rules = {
        saved: [['followUp', 'followUp', true], ['closes', 'closes', false]],
        applied: [['followUp', 'followUp', true], ['interview', 'interviewAt', false]],
        interview: [['followUp', 'followUp', true], ['interview', 'interviewAt', false]],
        offer: [['followUp', 'followUp', true]],
      }[stage] || [];
      let best = null;
      rules.forEach((r) => {
        const v = job[r[1]];
        if (!v || !L.isDateTime(v)) return;
        if (!r[2] && v.slice(0, 10) < today) return;
        if (!best || v.slice(0, 10) < best.date.slice(0, 10)) best = { kind: r[0], date: v };
      });
      return best;
    },

    // ---- sorting and filtering ----
    // Jobs with a date to act on come first (soonest first, overdue at the very top), then the other open jobs
    // (newest change first), then closed ones. Does not change the list it is given.
    sortJobs(jobs, today) {
      const L = this;
      const info = jobs.map((j) => ({ j: j, nd: L.nextDate(j, today) }));
      const group = (x) => (x.j.stage === 'closed' ? 2 : (x.nd ? 0 : 1));
      info.sort((a, b) => {
        const ga = group(a), gb = group(b);
        if (ga !== gb) return ga - gb;
        if (ga === 0) {
          const da = a.nd.date, db = b.nd.date;
          if (da.slice(0, 10) !== db.slice(0, 10)) return da.slice(0, 10) < db.slice(0, 10) ? -1 : 1;
          if (da !== db) return da < db ? -1 : 1;
        } else if ((a.j.updated || '') !== (b.j.updated || '')) {
          return (a.j.updated || '') < (b.j.updated || '') ? 1 : -1;
        }
        return String(a.j.title || '').localeCompare(String(b.j.title || ''));
      });
      return info.map((x) => x.j);
    },
    filterByStage(jobs, stage) {
      if (!stage || stage === 'all') return jobs.slice();
      return jobs.filter((j) => j.stage === stage);
    },
    // { all, saved, applied, interview, offer, closed }. A job with an odd stage counts only in `all`.
    stageCounts(jobs) {
      const c = { all: jobs.length };
      this.STAGES.forEach((s) => { c[s] = 0; });
      jobs.forEach((j) => { if (c[j.stage] !== undefined && j.stage !== 'all') c[j.stage]++; });
      return c;
    },
    // The change a stage button makes. Moving to "applied" with no applied date sets it to today.
    stagePatch(job, stage, today) {
      const patch = { stage: stage };
      if (stage === 'applied' && !job.applied && this.isDate(today)) patch.applied = today;
      return patch;
    },

    // ---- finding a job by words ----
    // The words a search looks in. Notes are in there on purpose: someone remembers "the one with the assessment
    // in it" long after they remember which employer it was.
    searchText(job) {
      if (!job) return '';
      return [job.title, job.org, job.where, job.notes].filter(Boolean).join(' ').toLowerCase();
    },
    // Does this job match what someone typed? Every word has to be found, so "cook toronto" finds a Cook job in
    // Toronto. Empty words match everything. Case does not matter.
    matches(job, query) {
      const q = String(query === undefined || query === null ? '' : query).trim().toLowerCase();
      if (!q) return true;
      const hay = this.searchText(job);
      return q.split(/\s+/).every((w) => hay.indexOf(w) >= 0);
    },
    filterByText(jobs, query) {
      const list = Array.isArray(jobs) ? jobs : [];
      if (!String(query || '').trim()) return list.slice();
      return list.filter((j) => this.matches(j, query));
    },

    // ---- late: still open, and the date you set has gone past ----
    // Whole days a YYYY-MM-DD date is before `today`. null when either is not a real date.
    daysBefore(dateStr, today) {
      if (!this.isDate(dateStr) || !this.isDate(today)) return null;
      const n = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
      return n(today) - n(dateStr);
    },
    // Is this job late? It has to be still open, and the next date has to be one the person set themselves
    // (a follow-up) rather than one that arrives on its own (an interview, a closing date). A job with no date
    // cannot be late, and neither can one whose date is only just past.
    isLate(job, today, after) {
      if (!job || job.deleted || job.stage === 'closed') return false;
      const nd = this.nextDate(job, today);
      if (!nd || nd.kind !== 'followUp') return false;
      const days = this.daysBefore(String(nd.date).slice(0, 10), today);
      const want = typeof after === 'number' ? after : this.LATE_AFTER;
      return days !== null && days >= want;
    },

    // ---- the board: one column per stage ----
    // -> [{stage, jobs}] for the five stages in that order, plus {stage: 'other'} only when a job needs one.
    // Deleted jobs are left out. Does not change the list it is given.
    boardColumns(jobs, today) {
      const L = this;
      const live = (Array.isArray(jobs) ? jobs : []).filter((j) => j && typeof j === 'object' && !j.deleted);
      const cols = L.STAGES.map((stage) => ({ stage: stage, jobs: [] }));
      const odd = [];
      live.forEach((j) => {
        const i = L.STAGES.indexOf(j.stage);
        if (i < 0) odd.push(j); else cols[i].jobs.push(j);
      });
      cols.forEach((c) => { c.jobs = L.boardSort(c.jobs, today); });
      if (odd.length) cols.push({ stage: 'other', jobs: L.boardSort(odd, today) });
      return cols;
    },
    // Soonest next date first, then title. A job with no next date comes last. Returns a new list.
    boardSort(jobs, today) {
      const L = this;
      return (Array.isArray(jobs) ? jobs : []).slice().sort((a, b) => {
        const na = L.nextDate(a, today), nb = L.nextDate(b, today);
        if (!na !== !nb) return na ? -1 : 1;
        if (na && nb && na.date !== nb.date) return na.date < nb.date ? -1 : 1;
        return String(a.title || '').localeCompare(String(b.title || ''));
      });
    },
    // Closed jobs whose last change (updated) is more than CLOSED_KEEP days before `today`. -> [job].
    // These are the ones the board keeps out of its Closed column until the person asks to see them.
    olderClosed(jobs, today, keep) {
      const days = keep === undefined ? this.CLOSED_KEEP : keep;
      const n = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
      if (!this.isDate(today)) return [];
      const cut = n(today) - days;
      return (Array.isArray(jobs) ? jobs : []).filter((j) => j && typeof j === 'object' && !j.deleted && j.stage === 'closed' &&
        typeof j.updated === 'string' && n(j.updated.slice(0, 10)) < cut);
    },

    // ---- the form ----
    // Input: the form's values as strings. Returns { ok: true, job, warnings } or { ok: false, problem }.
    // problem and each warning are string keys for ctx.t(). `job` always has every form field (empty = '').
    cleanJob(input) {
      const L = this;
      input = input || {};
      const s = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max);
      const title = s(input.title, 200);
      if (!title) return { ok: false, problem: 'needTitle' };
      const warnings = [];
      let link = s(input.link, 2000);
      if (link && !/^https?:\/\/[^\s]+$/i.test(link)) { link = ''; warnings.push('linkDropped'); }
      const date = (v) => { const x = s(v, 10); return L.isDate(x) ? x : ''; };
      let interviewAt = date(input.interviewDate);
      const time = s(input.interviewTime, 5);
      if (interviewAt && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) interviewAt += 'T' + time;
      const stage = L.STAGES.indexOf(input.stage) >= 0 ? input.stage : 'saved';
      return {
        ok: true,
        warnings: warnings,
        job: {
          title: title, org: s(input.org, 200), link: link, where: s(input.where, 200), stage: stage,
          applied: date(input.applied), followUp: date(input.followUp), closes: date(input.closes),
          interviewAt: interviewAt, nextStep: s(input.nextStep, 300), notes: s(input.notes, 5000),
        },
      };
    },
    // Put the cleaned form values on top of an existing record (or a new one). Empty values remove the field.
    // Fields the form does not have (tags, asks, posting, ext, ...) are kept.
    applyForm(existing, cleaned) {
      const out = Object.assign({}, existing || {});
      Object.keys(cleaned).forEach((k) => {
        if (cleaned[k] === '' || cleaned[k] === undefined) delete out[k]; else out[k] = cleaned[k];
      });
      out.type = 'job';
      return out;
    },
    // The `job-draft` suggestions to show: status 'new', newest first. -> [suggestion]
    drafts(suggestions) {
      return (Array.isArray(suggestions) ? suggestions : []).filter((s) => s && s.type === 'suggestion' && !s.deleted &&
        s.kind === 'job-draft' && s.status === 'new').sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));
    },
    // The form values a draft fills in. Dates that are not 'YYYY-MM-DD' and links that are not http(s) are left out.
    draftToForm(draft) {
      const t = (draft && typeof draft === 'object') ? draft : {};
      const s = (v) => (typeof v === 'string' ? v : '');
      return { title: s(t.title), org: s(t.org), where: s(t.where), link: s(t.link), closes: this.isDate(t.closes) ? t.closes : '', notes: s(t.notes) };
    },
    // The fields a draft adds that the form does not have: the posting (cut at 8,000) and asks (a list of text).
    draftExtras(draft) {
      const t = (draft && typeof draft === 'object') ? draft : {};
      const out = {};
      const posting = typeof t.posting === 'string' ? t.posting.trim().slice(0, 8000) : '';
      if (posting) out.posting = posting;
      const asks = this.lines(t.asks).map((a) => a.trim().slice(0, 300)).filter((a) => a).slice(0, 6);
      if (asks.length) out.asks = asks;
      return out;
    },
    // ---- answers for the notes (T3.8) ----
    NOTES_MAX: 5000,
    // The `job-note` suggestions waiting for one job: status 'new', target.job is the job id, newest first.
    readyNotes(suggestions, jobId) {
      return (Array.isArray(suggestions) ? suggestions : []).filter((s) => s && s.type === 'suggestion' && !s.deleted &&
        s.kind === 'job-note' && s.status === 'new' && s.target && s.target.job === jobId &&
        typeof s.target.text === 'string' && s.target.text.trim()).sort((a, b) => (a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0));
    },
    // The notes with an answer added at the end, after a blank line, under a dated line: "AI answer, 2026-10-18:".
    // `today` is 'YYYY-MM-DD'. The notes keep to NOTES_MAX characters: a long answer is cut with "…", and when there is
    // no room for even a short piece the result is { ok: false, problem: 'noteNoRoom' } and nothing is added.
    // -> { ok: true, notes } or { ok: false, problem }
    appendNote(notes, text, today, max) {
      const limit = max || this.NOTES_MAX;
      const old = String(notes == null ? '' : notes).replace(/\s+$/, '');
      const body = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
      if (!body) return { ok: false, problem: 'noteNoRoom' };
      const head = (old ? old + '\n\n' : '') + 'AI answer, ' + (this.isDate(today) ? today : 'today') + ':\n';
      const room = limit - head.length;
      if (room >= body.length) return { ok: true, notes: head + body };
      if (room < 40) return { ok: false, problem: 'noteNoRoom' };
      return { ok: true, notes: head + body.slice(0, room - 1).replace(/\s+$/, '') + '…' };
    },
    // Split interviewAt into the two form values.
    splitInterview(v) {
      v = String(v || '');
      return { date: v.slice(0, 10), time: v.length === 16 ? v.slice(11) : '' };
    },
    // Text lines from a field that may be a string or a list.
    lines(v) {
      if (Array.isArray(v)) return v.map((x) => String(x)).filter((x) => x);
      return v ? [String(v)] : [];
    },
  },

  mount(ctx) {
    const h = ctx.h;
    const logic = this.logic;
    let filter = 'all';
    let showOlder = false;

    const today = () => logic.dateKey(ctx.now());
    const stageName = (s) => ctx.t('stage.' + s);
    const when = (v) => {
      if (!v) return '';
      const p = ctx.fmt.dateTime(v, { now: ctx.now() });
      return p + ' (' + ctx.fmt.relative(v.slice(0, 10), ctx.now()) + ')';
    };
    const nextLine = (job) => {
      const n = logic.nextDate(job, today());
      if (!n) return null;
      const key = { followUp: 'nextFollowUp', interview: 'nextInterview', closes: 'nextCloses' }[n.kind];
      const day = n.date.slice(0, 10), now = today();
      return h('p', { class: 'jobs-next', 'data-test': 'job-next', 'data-kind': n.kind,
        'data-when': day < now ? 'late' : (day === now ? 'today' : 'later') }, ctx.t(key) + ': ' + when(n.date));
    };

    function changeStage(job, stage) {
      if (job.stage === stage) return;
      ctx.store.batch('Change stage', () => {
        ctx.store.put(Object.assign({}, job, logic.stagePatch(job, stage, today())));
      });
      ctx.ui.toast(ctx.t('movedTo', { stage: stageName(stage) }), { undo: true });
    }

    function stageButtons(job) {
      const box = h('fieldset', { class: 'jobs-stages' }, h('legend', {}, ctx.t('stagesLabel')));
      logic.STAGES.forEach((s) => {
        box.append(h('button', { type: 'button', 'data-test': 'job-stage-' + s, 'aria-pressed': job.stage === s ? 'true' : 'false',
          on: { click: () => changeStage(job, s) } }, stageName(s)));
      });
      return box;
    }

    // The answers waiting to be added to this job's notes (T3.8). One undo step per tap.
    function notesReady(job) {
      const ready = logic.readyNotes(ctx.store.all('suggestion'), job.id);
      if (!ready.length) return null;
      return h('section', { class: 'jobs-ready', 'data-test': 'job-notes-ready' },
        h('h3', {}, ctx.t('notesReadyHeading')),
        ready.map((sg) => h('div', { class: 'jobs-row', 'data-test': 'job-note-ready', 'data-id': sg.id },
          sg.target.task ? h('p', { class: 'jobs-meta' }, ctx.t('noteFrom', { task: sg.target.task })) : null,
          h('p', { class: 'jobs-text', 'data-test': 'job-note-text' }, String(sg.target.text).slice(0, 4000)),
          h('div', { class: 'jobs-detail-buttons' },
            h('button', { type: 'button', class: 'primary', 'data-test': 'job-note-add', on: { click: () => {
              const r = logic.appendNote(job.notes, sg.target.text, today());
              if (!r.ok) { ctx.ui.toast(ctx.t(r.problem)); return; }
              ctx.store.batch('Add an answer to the notes', () => {
                ctx.store.put(Object.assign({}, job, { notes: r.notes }));
                ctx.store.put(Object.assign({}, sg, { status: 'taken' }));
              });
              ctx.ui.toast(ctx.t('noteAdded'), { undo: true });
            } } }, ctx.t('noteAdd')),
            h('button', { type: 'button', 'data-test': 'job-note-dismiss', on: { click: () => {
              ctx.store.batch('Put an answer away', () => ctx.store.put(Object.assign({}, sg, { status: 'dismissed' })));
              ctx.ui.toast(ctx.t('draftPutAway'), { undo: true });
            } } }, ctx.t('notForMe'))))));
    }

    function deleteJob(job) {
      ctx.store.batch('Delete job', () => ctx.store.remove(job.id));
      ctx.ui.toast(ctx.t('deleted'), { undo: true });
      ctx.ui.go('jobs');
    }

    // ---- board or list ----
    // Which one is remembered on this device. The first time, a board on a wide screen (every job at a glance)
    // and a list on a phone, where one column under another would only make a longer scroll.
    // This one is not a ctx.pref: its default depends on the width of the window, and a preference's default is
    // one fixed value. It is the only setting in this feature written by hand.
    function currentView() {
      const s = ctx.store.get('settings') || {};
      const e = s.ext && typeof s.ext === 'object' ? s.ext : {};
      const mine = e.jobs && typeof e.jobs === 'object' ? e.jobs : {};
      if (mine.view === 'board' || mine.view === 'list') return mine.view;
      return ctx.wide() ? 'board' : 'list';
    }
    // How late a follow-up has to be before a job is marked. A preference, so it lives on the Data screen and
    // travels in the backup file like the rest of this person's settings.
    const lateAfter = () => ctx.pref('lateAfter');
    // ---- finding a job ----
    // What someone has typed, kept here because the screen is drawn again after every store change and anything
    // left inside render would be lost mid-word.
    let search = '';
    // The box has an id, and that is what lets the shell put the keyboard and the cursor back after a redraw
    // (it matches the focused element by id). So this is one line: redraw without moving, which is what ui.go()
    // is not -- ui.go() is for changing screen and on purpose drops the focus.
    function searchBox() {
      const input = h('input', {
        type: 'search', id: 'jobs-search', class: 'jobs-search-input', 'data-test': 'job-search',
        value: search, autocomplete: 'off', spellcheck: 'false',
        'aria-label': ctx.t('searchLabel'),
        on: { input: (e) => { search = e.target.value; ctx.redraw(); } },
      });
      return h('div', { class: 'jobs-search' },
        h('label', { for: 'jobs-search', class: 'jobs-search-label' }, ctx.t('searchLabel')),
        input,
        h('p', { class: 'muted jobs-search-hint' }, ctx.t('searchHint')));
    }
    // The badge on a card or a row. The words are on it, and the whole sentence is there for anyone who cannot
    // see the badge.
    function lateBadge(j, today) {
      if (!logic.isLate(j, today, lateAfter())) return null;
      const days = logic.daysBefore(String(logic.nextDate(j, today).date).slice(0, 10), today);
      return h('span', { class: 'jobs-late', 'data-test': 'job-late',
        title: ctx.t('lateWhy', { days: days }) }, ctx.t('lateBadge'));
    }

    // How late a follow-up has to be before a job is marked. Declared once, and it draws itself on the Data
    // screen: a labelled choice, saved, and checked against the three numbers below.
    ctx.pref({
      key: 'lateAfter', type: 'choice', label: ctx.t('lateAfterLabel'), def: logic.LATE_AFTER,
      options: [
        { value: 14, label: ctx.t('lateWeeks2') },
        { value: 21, label: ctx.t('lateWeeks3') },
        { value: 30, label: ctx.t('lateMonth1') },
      ],
    });
    function viewToggle(view, again) {
      const box = h('fieldset', { class: 'jobs-view', 'data-test': 'jobs-view' }, h('legend', {}, ctx.t('viewLabel')));
      ['list', 'board'].forEach((v) => {
        box.append(h('button', { type: 'button', 'data-test': 'jobs-view-' + v, 'aria-pressed': view === v ? 'true' : 'false',
          on: { click: () => { ctx.store.ext('settings', { view: v }); again(); } } },
          ctx.t(v === 'list' ? 'viewList' : 'viewBoard')));
      });
      return box;
    }

    function cardList(shown, selected, inPane) {
      const list = h('ul', { class: 'jobs-list cols cols-lg', 'data-test': 'job-list' });
      shown.forEach((j) => {
        const meta = [j.org, j.where].filter((x) => x).join(' · ');
        list.append(h('li', { class: 'jobs-row', 'data-test': 'job-row', 'data-id': j.id },
          h('h3', {}, h('button', { type: 'button', class: 'jobs-row-open', 'data-test': 'job-open',
            'aria-current': j.id === selected ? 'true' : null, on: { click: () => ctx.ui.go('jobs/' + j.id) } }, j.title)),
          meta ? h('p', { class: 'jobs-meta' }, meta) : null,
          lateBadge(j, today()),
          nextLine(j),
          // In the two-pane view the stage buttons live in the open job on the right, so a row does not carry a
          // second copy of the same control.
          inPane ? null : stageButtons(j)));
      });
      return list;
    }

    // The board: one column per stage, each card a button that opens the job.
    function board(all) {
      const t = today();
      const hidden = logic.olderClosed(all, t);
      const hiddenIds = {};
      hidden.forEach((j) => { hiddenIds[j.id] = true; });
      const wrap = h('div', { class: 'jobs-board', 'data-test': 'job-board' });
      logic.boardColumns(all, t).forEach((col) => {
        if (filter !== 'all' && filter !== col.stage) return;
        let jobs = col.jobs;
        const closed = col.stage === 'closed';
        const tucked = closed ? jobs.filter((j) => hiddenIds[j.id]) : [];
        if (closed && !showOlder) jobs = jobs.filter((j) => !hiddenIds[j.id]);
        wrap.append(h('section', { class: 'jobs-col', 'data-test': 'job-column', 'data-stage': col.stage },
          h('div', { class: 'jobs-col-head' },
            h('h3', {}, col.stage === 'other' ? ctx.t('stageOther') : stageName(col.stage)),
            h('span', { class: 'jobs-col-count', 'data-test': 'job-column-count' }, String(jobs.length))),
          jobs.length
            ? h('ul', { class: 'jobs-col-list' }, jobs.map((j) => h('li', { class: 'jobs-card', 'data-test': 'job-row', 'data-id': j.id },
                h('button', { type: 'button', class: 'jobs-card-open', 'data-test': 'job-open',
                  on: { click: () => ctx.ui.go('jobs/' + j.id) } },
                  j.title,
                  [j.org, j.where].filter((x) => x).length
                    ? h('span', { class: 'jobs-card-org' }, [j.org, j.where].filter((x) => x).join(' · ')) : null),
                lateBadge(j, t),
                nextLine(j))))
            : h('p', { class: 'jobs-col-empty' }, ctx.t('boardNone')),
          closed && tucked.length
            ? h('div', { class: 'jobs-older' }, h('button', { type: 'button', 'data-test': 'job-older-closed',
                on: { click: () => { showOlder = !showOlder; ctx.ui.go('jobs'); } } },
                ctx.t(showOlder ? 'hideOlderClosed' : 'showOlderClosed', { n: tucked.length })))
            : null));
      });
      return wrap;
    }

    // ---- list ----
    // `opts.inPane` is true when this list is the left pane of the two-pane view (a job is open beside it):
    // then it is always a list, because five columns do not fit in a pane, and the view buttons are left out.
    // `opts.keep` is the id of the job that is open, so it can be marked in the list.
    function renderList(el, opts) {
      const o = opts || {};
      const all = ctx.store.all('job');
      const counts = logic.stageCounts(all);
      const searched = logic.filterByText(all, search);
      const shown = logic.sortJobs(logic.filterByStage(searched, filter), today());
      const view = o.inPane ? 'list' : currentView();
      const again = () => ctx.ui.go(o.keep ? 'jobs/' + o.keep : 'jobs');

      const filterBox = h('fieldset', { class: 'jobs-filter', 'data-test': 'stage-filter' }, h('legend', {}, ctx.t('filterLabel')));
      ['all'].concat(logic.STAGES).forEach((s) => {
        const name = s === 'all' ? ctx.t('filterAll') : stageName(s);
        filterBox.append(h('button', { type: 'button', 'data-test': 'stage-filter-' + s, 'aria-pressed': filter === s ? 'true' : 'false',
          on: { click: () => { filter = s; again(); } } },
          name + ' ' + counts[s]));
      });

      const drafts = logic.drafts(ctx.store.all('suggestion'));
      const lane = drafts.length ? h('section', { class: 'jobs-drafts', 'data-test': 'job-drafts' },
        h('h3', {}, ctx.t('draftsHeading')),
        h('ul', { class: 'jobs-list cols cols-lg' }, drafts.map((d) => {
          const t = d.target || {};
          return h('li', { class: 'jobs-row', 'data-test': 'job-draft-row', 'data-id': d.id },
            h('h3', {}, t.title || ctx.t('draftFrom')),
            [t.org, t.where].filter((x) => x).length ? h('p', { class: 'jobs-meta' }, [t.org, t.where].filter((x) => x).join(' · ')) : null,
            h('div', { class: 'jobs-detail-buttons' },
              h('button', { type: 'button', class: 'primary', 'data-test': 'job-draft-take', on: { click: () => ctx.ui.go('jobs/new/' + d.id) } }, ctx.t('takeIt')),
              h('button', { type: 'button', 'data-test': 'job-draft-dismiss', on: { click: () => {
                ctx.store.batch('Put a draft away', () => ctx.store.put(Object.assign({}, d, { status: 'dismissed' })));
                ctx.ui.toast(ctx.t('draftPutAway'), { undo: true });
              } } }, ctx.t('notForMe'))));
        }))) : null;

      const addButton = h('button', { type: 'button', class: 'primary', 'data-test': 'job-add', on: { click: () => ctx.ui.go('jobs/new') } }, ctx.t('add'));
      el.append(
        // In the two-pane view the heading is already in the menu, but adding a job must still be one tap away.
        o.inPane
          ? h('div', { class: 'jobs-top jobs-top-pane' }, addButton)
          : h('div', { class: 'jobs-top' }, h('h2', {}, ctx.t('heading')), addButton),
        lane || '',
        o.inPane ? '' : viewToggle(view, again),
        searchBox(),
        filterBox,
        shown.length === 0
          ? h('p', { 'data-test': 'job-empty' }, ctx.t(all.length ? 'emptyFilter' : 'empty'))
          : (view === 'board' ? board(searched) : cardList(shown, o.keep, o.inPane)));
    }

    // ---- form ----
    function renderForm(el, job, draft) {
      const isNew = !job;
      const j = job || Object.assign({ stage: 'saved' }, draft ? logic.draftToForm(draft.target) : {});
      const iv = logic.splitInterview(j.interviewAt);
      const problem = h('p', { class: 'jobs-problem', role: 'alert', 'data-test': 'job-problem' });
      const inputs = {};
      // One box per field: the label and its input travel together, so a two-column form never splits one.
      // `wide` gives a field the whole row (the notes), `extra` puts help text under the input.
      function field(key, label, attrs, tag, wide, extra) {
        const id = 'job-f-' + key;
        const input = h(tag || 'input', Object.assign({ id: id, name: key, 'data-test': 'job-' + key.toLowerCase() }, tag ? {} : { type: 'text' }, attrs || {}));
        inputs[key] = input;
        return h('div', { class: wide ? 'jobs-field jobs-field-wide' : 'jobs-field' },
          h('label', { for: id }, ctx.t(label)), input, extra || null);
      }
      const stage = h('select', { id: 'job-f-stage', name: 'stage', 'data-test': 'job-stage' },
        logic.STAGES.map((s) => h('option', { value: s }, stageName(s))));
      stage.value = logic.STAGES.indexOf(j.stage) >= 0 ? j.stage : 'saved';
      inputs.stage = stage;

      const parts = [].concat(
        field('title', 'fTitle', { maxlength: '200', required: 'required' }),
        field('org', 'fOrg', { maxlength: '200' }),
        field('link', 'fLink', { type: 'url', inputmode: 'url', maxlength: '2000' }, null, false,
          h('p', { class: 'jobs-help' }, ctx.t('fLinkHelp'))),
        field('where', 'fWhere', { maxlength: '200' }),
        h('div', { class: 'jobs-field' }, h('label', { for: 'job-f-stage' }, ctx.t('stageLabel')), stage),
        field('applied', 'fApplied', { type: 'date' }),
        field('followUp', 'fFollowUp', { type: 'date' }),
        field('closes', 'fCloses', { type: 'date' }),
        field('interviewDate', 'fInterviewDate', { type: 'date' }),
        field('interviewTime', 'fInterviewTime', { type: 'time' }),
        field('nextStep', 'fNextStep', { maxlength: '300' }),
        field('notes', 'fNotes', { rows: '4', maxlength: '5000' }, 'textarea', true));
      const initial = {
        title: j.title, org: j.org, link: j.link, where: j.where, applied: j.applied, followUp: j.followUp,
        closes: j.closes, interviewDate: iv.date, interviewTime: iv.time, nextStep: j.nextStep, notes: j.notes,
      };
      Object.keys(initial).forEach((k) => { inputs[k].value = initial[k] || ''; });

      function submit(e) {
        e.preventDefault();
        const vals = {};
        Object.keys(inputs).forEach((k) => { vals[k] = inputs[k].value; });
        const r = logic.cleanJob(vals);
        problem.textContent = r.ok ? '' : ctx.t(r.problem);
        inputs.title.setAttribute('aria-invalid', r.ok ? 'false' : 'true');
        if (!r.ok) { inputs.title.focus(); return; }
        let saved;
        ctx.store.batch(isNew ? 'Add job' : 'Edit job', () => {
          const rec = logic.applyForm(job, r.job);
          if (draft) {
            Object.assign(rec, logic.draftExtras(draft.target));
            const cur = ctx.store.get(draft.id);
            if (cur && cur.status === 'new') ctx.store.put(Object.assign({}, cur, { status: 'taken' }));
          }
          saved = ctx.store.put(rec);
        });
        ctx.ui.toast(ctx.t(r.warnings.indexOf('linkDropped') >= 0 ? 'savedNoLink' : 'saved'));
        ctx.ui.go('jobs/' + saved.id);
      }
      el.append(
        h('h2', {}, ctx.t(isNew ? 'addTitle' : 'editTitle')),
        h('form', { class: 'jobs-form', 'data-test': 'job-form', novalidate: 'novalidate', on: { submit: submit } },
          parts, problem,
          h('div', { class: 'jobs-detail-buttons' },
            h('button', { type: 'submit', class: 'primary', 'data-test': 'job-save' }, ctx.t('save')),
            h('button', { type: 'button', 'data-test': 'job-cancel', on: { click: () => ctx.ui.go(isNew ? 'jobs' : 'jobs/' + job.id) } }, ctx.t('cancel')))));
    }

    // ---- detail ----
    function renderDetail(el, job) {
      const facts = h('dl', { class: 'jobs-facts' });
      function fact(label, node, wide) { if (node) facts.append(h('div', { class: wide ? 'jobs-fact-wide' : null }, h('dt', {}, ctx.t(label)), h('dd', {}, node))); }
      const iv = job.interviewAt;
      fact('dWhere', job.where);
      fact('dApplied', job.applied ? ctx.fmt.date(job.applied, { now: ctx.now() }) : '');
      fact('dFollowUp', when(job.followUp));
      fact('dInterview', when(iv));
      fact('dCloses', when(job.closes));
      fact('dNextStep', job.nextStep);
      if (job.notes) fact('dNotes', h('span', { class: 'jobs-text' }, job.notes), true);
      const tags = logic.lines(job.tags);
      if (tags.length) fact('dTags', tags.join(', '));
      const asks = logic.lines(job.asks);
      if (asks.length) fact('dAsks', h('ul', {}, asks.map((a) => h('li', {}, a))), true);
      const meta = [job.org].filter((x) => x).join(' · ');
      // On a wide screen the list is right there, so this closes the job instead of going back to it.
      const backLabel = ctx.wide() ? ctx.t('closeJob') : ctx.t('back');
      el.append(
        h('p', {}, h('button', { type: 'button', class: 'jobs-back', 'data-test': 'job-back', on: { click: () => ctx.ui.go('jobs') } }, backLabel)),
        h('div', { 'data-test': 'job-detail', 'data-id': job.id },
          h('h2', { 'data-test': 'job-detail-title' }, job.title),
          meta ? h('p', { class: 'jobs-meta' }, meta) : null,
          job.link ? h('p', {}, h('a', { href: job.link, 'data-test': 'job-link' }, ctx.t('dLink'))) : null,
          nextLine(job),
          stageButtons(job),
          facts,
          notesReady(job),
          job.posting ? h('details', {}, h('summary', {}, ctx.t('dPosting')), h('p', { class: 'jobs-text' }, String(job.posting).slice(0, 8000))) : null,
          h('div', { class: 'jobs-detail-buttons' },
            h('button', { type: 'button', 'data-test': 'job-edit', on: { click: () => ctx.ui.go('jobs/' + job.id + '/edit') } }, ctx.t('edit')),
            h('button', { type: 'button', 'data-test': 'job-delete', on: { click: () => deleteJob(job) } }, ctx.t('delete')))));
      ctx.renderSlot('job.panel', el, job);
      const acts = h('div', { class: 'jobs-detail-buttons', 'data-test': 'job-actions' });
      if (ctx.renderSlot('job.actions', acts, job)) el.append(h('h3', {}, ctx.t('actionsHeading')), acts);
    }

    ctx.slot('tab', {
      id: 'jobs',
      label: ctx.t('tabLabel'),
      order: 10,
      render(el) {
        const args = ctx.route().args;
        if (!args.length) { renderList(el); return; }
        if (args[0] === 'new') {
          const d = args[1] ? ctx.store.get(args[1]) : null;
          renderForm(el, null, d && d.type === 'suggestion' && d.kind === 'job-draft' && d.status === 'new' && !d.deleted ? d : null);
          return;
        }
        const job = ctx.store.get(args[0]);
        if (!job || job.type !== 'job' || job.deleted) {
          el.append(h('p', { 'data-test': 'job-missing' }, ctx.t('notFound')),
            h('button', { type: 'button', on: { click: () => ctx.ui.go('jobs') } }, ctx.t('back')));
          return;
        }
        if (args[1] === 'edit') { renderForm(el, job); return; }
        // On a wide screen an open job sits beside the list, so going through jobs is one tap each way and the
        // person never loses their place. On a phone it is the whole screen, as it always was.
        if (ctx.wide()) {
          const main = h('div', { class: 'split-main' });
          const side = h('div', { class: 'split-side' });
          renderList(main, { inPane: true, keep: job.id });
          renderDetail(side, job);
          el.append(h('div', { class: 'split', 'data-test': 'job-split' }, main, side));
          return;
        }
        renderDetail(el, job);
      },
    });
  },
});
