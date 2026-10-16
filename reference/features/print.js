// features/print.js  (one-page summary: this week's dates, late follow-ups and starred events)
//
// Owns no record type. Reads job and event-mark records. Shows a Summary screen that can be printed.
// Every logic function is pure: `today` is a 'YYYY-MM-DD' text and the clock is never read inside logic.
Desk.register({
  id: 'print',
  name: 'One-page summary',
  purpose: 'A page you can print or save as a PDF: this week\'s jobs, dates and events.',
  types: [],
  strings: {
    tabLabel: 'Summary',
    heading: 'Summary',
    todayLine: 'Today is {date}.',
    printButton: 'Print or save as PDF',
    lateHeading: 'Late',
    lateLine: 'Follow up was due {date}.',
    weekHeading: 'Dates this week',
    followUp: 'Follow up',
    interview: 'Interview',
    closes: 'Posting closes',
    starredHeading: 'Events I starred',
    venueLine: 'At {venue}',
    nothing: 'Nothing this week.',
  },
  css: `
    .print-page { display: grid; gap: 1rem; }
    .print-section h3 { margin: 0 0 .5rem; }
    .print-list { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
    .print-item { padding: .5rem 0; border-bottom: 1px solid currentColor; }
    .print-item p { margin: .15rem 0 0; }
    .print-button { min-height: 44px; }
    @media print {
      nav.tabs, .print-button, .toasts, .skip-link { display: none !important; }
      body { background: #fff; color: #000; }
      .print-item { break-inside: avoid; }
    }
  `,
  logic: {
    // 'YYYY-MM-DD' for a Date, in local time. Pass the Date from ctx.now(). Do not use toISOString(): it is UTC.
    todayKey(date) {
      const p = (n) => (n < 10 ? '0' : '') + n;
      return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate());
    },
    // True for a plain 'YYYY-MM-DD' text.
    isDay(s) {
      return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
    },
    // 'YYYY-MM-DD' for a date text, a date and time text ('YYYY-MM-DDTHH:MM') or an ISO time (shown in local time).
    // '' when the value is not a date.
    dayOf(v) {
      const L = this;
      if (typeof v !== 'string' || !v) return '';
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(v)) return v.slice(0, 10);
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : L.todayKey(d);
    },
    // Whole calendar days from day `today` to day `day` (both 'YYYY-MM-DD'). Uses UTC so daylight saving does not shift it.
    daysFrom(today, day) {
      const n = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
      return Math.round(n(day) - n(today));
    },
    // Jobs due in the next 7 days, today counted: follow-up, interview and closing dates.
    // Returns [{job, kind: 'followUp' | 'interview' | 'closes', date}], earliest first, then by title.
    // A job with stage 'closed' gives nothing. An interview with a time uses its date.
    weekDates(jobs, today) {
      const L = this;
      const out = [];
      jobs.forEach((j) => {
        if (!j || j.stage === 'closed') return;
        const add = (kind, value) => {
          const day = L.dayOf(value);
          if (!day) return;
          const d = L.daysFrom(today, day);
          if (d >= 0 && d <= 6) out.push({ job: j, kind: kind, date: day });
        };
        add('followUp', j.followUp);
        add('interview', j.interviewAt);
        add('closes', j.closes);
      });
      return out.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return String(a.job.title || '').localeCompare(String(b.job.title || ''));
      });
    },
    // Jobs whose follow-up date is before today, and that are not closed. Oldest follow-up first.
    lateJobs(jobs, today) {
      const L = this;
      return jobs
        .filter((j) => j && j.stage !== 'closed' && L.isDay(j.followUp) && j.followUp < today)
        .sort((a, b) => {
          if (a.followUp !== b.followUp) return a.followUp < b.followUp ? -1 : 1;
          return String(a.title || '').localeCompare(String(b.title || ''));
        });
    },
    // Starred events that start in the next 7 days (today counted), or that are on now.
    // Skips deleted marks. Earliest start first, then by title.
    starredThisWeek(marks, today) {
      const L = this;
      return marks
        .filter((m) => {
          if (!m || m.deleted || m.status !== 'starred' || !m.copy) return false;
          const start = L.dayOf(m.copy.start);
          if (!start) return false;
          const d = L.daysFrom(today, start);
          if (d >= 0 && d <= 6) return true;
          const end = L.dayOf(m.copy.end) || start;
          return start < today && end >= today;
        })
        .sort((a, b) => {
          const sa = L.dayOf(a.copy.start), sb = L.dayOf(b.copy.start);
          if (sa !== sb) return sa < sb ? -1 : 1;
          return String(a.copy.title || '').localeCompare(String(b.copy.title || ''));
        });
    },
  },
  mount(ctx) {
    const h = ctx.h;
    const logic = this.logic;
    ctx.slot('tab', {
      id: 'print',
      label: ctx.t('tabLabel'),
      render(el) {
        const today = logic.todayKey(ctx.now());
        const jobs = ctx.store.all('job');
        const late = logic.lateJobs(jobs, today);
        const week = logic.weekDates(jobs, today);
        const starred = logic.starredThisWeek(ctx.store.all('event-mark'), today);

        function section(title, children) {
          return h('section', { class: 'print-section' }, h('h3', {}, title), h('ul', { class: 'print-list' }, children));
        }
        function item(title, lines) {
          return h('li', { class: 'print-item' }, h('strong', {}, title), lines.map((line) => h('p', {}, line)));
        }

        const body = h('div', { class: 'print-page' });
        body.append(
          h('h2', {}, ctx.t('heading')),
          h('p', {}, ctx.t('todayLine', { date: ctx.fmt.date(today) })),
          h('button', { type: 'button', class: 'print-button', on: { click: () => window.print() } },
            ctx.t('printButton')));

        if (late.length) {
          body.append(section(ctx.t('lateHeading'), late.map((j) =>
            item(j.title, [ctx.t('lateLine', { date: ctx.fmt.date(j.followUp) })]))));
        }
        if (week.length) {
          body.append(section(ctx.t('weekHeading'), week.map((x) =>
            item(x.job.title, [ctx.t(x.kind), ctx.fmt.date(x.date)]))));
        }
        if (starred.length) {
          body.append(section(ctx.t('starredHeading'), starred.map((m) =>
            item(m.copy.title, [ctx.fmt.dateTime(m.copy.start)].concat(m.copy.venue ? [ctx.t('venueLine', { venue: m.copy.venue })] : [])))));
        }

        // Other features add their own sections here. Nothing is shown for an entry that draws nothing.
        const extra = h('div', {});
        const added = ctx.renderSlot('print', extra);
        body.append(extra);

        if (!late.length && !week.length && !starred.length && !added) {
          body.append(h('p', {}, ctx.t('nothing')));
        }
        el.append(body);
      },
    });
  },
});
