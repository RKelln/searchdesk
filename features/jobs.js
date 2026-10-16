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
// The stage filter lives in a closure inside mount (it survives the shell's re-renders).
Desk.register({
  id: 'jobs',
  name: 'Jobs',
  purpose: 'Keep track of the jobs you want or have applied for.',
  types: ['job'],
  strings: {
    tabLabel: 'Jobs',
    heading: 'Your jobs',
    add: 'Add a job',
    empty: 'No jobs yet. Add the first one you find.',
    emptyFilter: 'No jobs in this group.',
    filterLabel: 'Show jobs by stage',
    filterAll: 'All',
    stageLabel: 'Stage',
    stagesLabel: 'Move to another stage',
    'stage.saved': 'Saved',
    'stage.applied': 'Applied',
    'stage.interview': 'Interview',
    'stage.offer': 'Offer',
    'stage.closed': 'Closed',
    open: 'Open',
    back: 'Back to your jobs',
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
  },
  css: `
    .jobs-top { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; justify-content: space-between; margin-bottom: .75rem; }
    .jobs-filter { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0 0 1rem; padding: 0; border: 0; }
    .jobs-filter button[aria-pressed="true"], .jobs-stages button[aria-pressed="true"] { background: var(--accent); color: var(--accent-text); border-color: var(--accent); font-weight: 700; }
    .jobs-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .75rem; }
    .jobs-row { padding: .75rem; background: var(--surface); border: 1px solid var(--line); border-radius: .5rem; }
    .jobs-row h3 { margin: 0 0 .25rem; font-size: 1.1rem; }
    .jobs-row-open { width: 100%; text-align: left; font-weight: 700; }
    .jobs-meta { margin: 0 0 .5rem; color: var(--muted); }
    .jobs-next { font-weight: 600; margin: 0 0 .5rem; }
    .jobs-stages { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0 0 .5rem; padding: 0; border: 0; }
    .jobs-form { display: grid; gap: .25rem; max-width: 34rem; }
    .jobs-problem { color: var(--danger); font-weight: 600; margin: 0; }
    .jobs-help { margin: 0; color: var(--muted); font-size: .9rem; }
    .jobs-facts { margin: 0 0 1rem; }
    .jobs-facts dt { font-weight: 700; margin-top: .5rem; }
    .jobs-facts dd { margin: 0; overflow-wrap: anywhere; }
    .jobs-text { white-space: pre-wrap; overflow-wrap: anywhere; }
    .jobs-detail-buttons { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
  `,
  logic: {
    STAGES: ['saved', 'applied', 'interview', 'offer', 'closed'],

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
      return h('p', { class: 'jobs-next', 'data-test': 'job-next' }, ctx.t(key) + ': ' + when(n.date));
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

    function deleteJob(job) {
      ctx.store.batch('Delete job', () => ctx.store.remove(job.id));
      ctx.ui.toast(ctx.t('deleted'), { undo: true });
      ctx.ui.go('jobs');
    }

    // ---- list ----
    function renderList(el) {
      const all = ctx.store.all('job');
      const counts = logic.stageCounts(all);
      const shown = logic.sortJobs(logic.filterByStage(all, filter), today());
      const filterBox = h('fieldset', { class: 'jobs-filter', 'data-test': 'stage-filter' }, h('legend', {}, ctx.t('filterLabel')));
      ['all'].concat(logic.STAGES).forEach((s) => {
        const name = s === 'all' ? ctx.t('filterAll') : stageName(s);
        filterBox.append(h('button', { type: 'button', 'data-test': 'stage-filter-' + s, 'aria-pressed': filter === s ? 'true' : 'false',
          on: { click: () => { filter = s; ctx.ui.go('jobs'); } } },
          name + ' ' + counts[s]));
      });
      const list = h('ul', { class: 'jobs-list', 'data-test': 'job-list' });
      shown.forEach((j) => {
        const meta = [j.org, j.where].filter((x) => x).join(' · ');
        list.append(h('li', { class: 'jobs-row', 'data-test': 'job-row', 'data-id': j.id },
          h('h3', {}, h('button', { type: 'button', class: 'jobs-row-open', 'data-test': 'job-open', on: { click: () => ctx.ui.go('jobs/' + j.id) } }, j.title)),
          meta ? h('p', { class: 'jobs-meta' }, meta) : null,
          nextLine(j),
          stageButtons(j)));
      });
      el.append(
        h('div', { class: 'jobs-top' },
          h('h2', {}, ctx.t('heading')),
          h('button', { type: 'button', class: 'primary', 'data-test': 'job-add', on: { click: () => ctx.ui.go('jobs/new') } }, ctx.t('add'))),
        filterBox,
        shown.length ? list : h('p', { 'data-test': 'job-empty' }, ctx.t(all.length ? 'emptyFilter' : 'empty')));
    }

    // ---- form ----
    function renderForm(el, job) {
      const isNew = !job;
      const j = job || { stage: 'saved' };
      const iv = logic.splitInterview(j.interviewAt);
      const problem = h('p', { class: 'jobs-problem', role: 'alert', 'data-test': 'job-problem' });
      const inputs = {};
      function field(key, label, attrs, tag) {
        const id = 'job-f-' + key;
        const input = h(tag || 'input', Object.assign({ id: id, name: key, 'data-test': 'job-' + key.toLowerCase() }, tag ? {} : { type: 'text' }, attrs || {}));
        inputs[key] = input;
        return [h('label', { for: id }, ctx.t(label)), input];
      }
      const stage = h('select', { id: 'job-f-stage', name: 'stage', 'data-test': 'job-stage' },
        logic.STAGES.map((s) => h('option', { value: s }, stageName(s))));
      stage.value = logic.STAGES.indexOf(j.stage) >= 0 ? j.stage : 'saved';
      inputs.stage = stage;

      const parts = [].concat(
        field('title', 'fTitle', { maxlength: '200', required: 'required' }),
        field('org', 'fOrg', { maxlength: '200' }),
        field('link', 'fLink', { type: 'url', inputmode: 'url', maxlength: '2000' }),
        [h('p', { class: 'jobs-help' }, ctx.t('fLinkHelp'))],
        field('where', 'fWhere', { maxlength: '200' }),
        [h('label', { for: 'job-f-stage' }, ctx.t('stageLabel')), stage],
        field('applied', 'fApplied', { type: 'date' }),
        field('followUp', 'fFollowUp', { type: 'date' }),
        field('closes', 'fCloses', { type: 'date' }),
        field('interviewDate', 'fInterviewDate', { type: 'date' }),
        field('interviewTime', 'fInterviewTime', { type: 'time' }),
        field('nextStep', 'fNextStep', { maxlength: '300' }),
        field('notes', 'fNotes', { rows: '4', maxlength: '5000' }, 'textarea'));
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
        if (!r.ok) { inputs.title.focus(); return; }
        let saved;
        ctx.store.batch(isNew ? 'Add job' : 'Edit job', () => {
          saved = ctx.store.put(logic.applyForm(job, r.job));
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
      function fact(label, node) { if (node) facts.append(h('dt', {}, ctx.t(label)), h('dd', {}, node)); }
      const iv = job.interviewAt;
      fact('dWhere', job.where);
      fact('dApplied', job.applied ? ctx.fmt.date(job.applied, { now: ctx.now() }) : '');
      fact('dFollowUp', when(job.followUp));
      fact('dInterview', when(iv));
      fact('dCloses', when(job.closes));
      fact('dNextStep', job.nextStep);
      if (job.notes) fact('dNotes', h('span', { class: 'jobs-text' }, job.notes));
      const tags = logic.lines(job.tags);
      if (tags.length) fact('dTags', tags.join(', '));
      const asks = logic.lines(job.asks);
      if (asks.length) fact('dAsks', h('ul', {}, asks.map((a) => h('li', {}, a))));
      const meta = [job.org].filter((x) => x).join(' · ');
      el.append(
        h('p', {}, h('button', { type: 'button', 'data-test': 'job-back', on: { click: () => ctx.ui.go('jobs') } }, ctx.t('back'))),
        h('div', { 'data-test': 'job-detail', 'data-id': job.id },
          h('h2', { 'data-test': 'job-detail-title' }, job.title),
          meta ? h('p', { class: 'jobs-meta' }, meta) : null,
          job.link ? h('p', {}, h('a', { href: job.link, 'data-test': 'job-link' }, ctx.t('dLink'))) : null,
          nextLine(job),
          stageButtons(job),
          facts,
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
        if (args[0] === 'new') { renderForm(el, null); return; }
        const job = ctx.store.get(args[0]);
        if (!job || job.type !== 'job' || job.deleted) {
          el.append(h('p', { 'data-test': 'job-missing' }, ctx.t('notFound')),
            h('button', { type: 'button', on: { click: () => ctx.ui.go('jobs') } }, ctx.t('back')));
          return;
        }
        if (args[1] === 'edit') renderForm(el, job); else renderDetail(el, job);
      },
    });
  },
});
