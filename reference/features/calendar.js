// features/calendar.js  (reference build from docs/features/calendar.md)
// Puts an interview (a job's interviewAt) or an event into the person's calendar as a .ics file.
// Dates are floating wall-clock text: 'YYYY-MM-DD' (all day) or 'YYYY-MM-DDTHH:MM' (timed). No zone.
Desk.register({
  id: 'calendar',
  name: 'Add to calendar',
  purpose: 'Put an interview or a starred event into your phone\'s calendar.',
  types: [],
  strings: {
    jobButton: 'Add the interview to my calendar',
    eventButton: 'Add to my calendar',
    noInterview: 'This job has no interview date yet.',
    saved: 'Calendar file saved. Open it to add the entry.',
    notSaved: 'Could not save the calendar file.',
    badDate: 'This date cannot go in a calendar file.',
    interviewPrefix: 'Interview',
  },
  logic: {
    // Escapes text for a calendar line: backslash, comma, semicolon, and line breaks become \\ \, \; \n.
    escapeText(s) {
      return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\r\n|\r|\n/g, '\\n');
    },
    // Folds a line longer than 75 characters: the next line starts with one space. Counts characters
    // (not bytes), so a letter with an accent is never cut in half.
    foldLine(line) {
      const chars = Array.from(line);
      if (chars.length <= 75) return line;
      const out = [chars.slice(0, 75).join('')];
      for (let i = 75; i < chars.length; i += 74) out.push(' ' + chars.slice(i, i + 74).join(''));
      return out.join('\r\n');
    },
    // Reads 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'. Returns {y, m, d, hh, mm, timed} or null when it is not a real date.
    parseWhen(v) {
      const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(v || ''));
      if (!match) return null;
      const y = +match[1], m = +match[2], d = +match[3];
      const timed = match[4] !== undefined;
      const hh = timed ? +match[4] : 0, mm = timed ? +match[5] : 0;
      if (m < 1 || m > 12 || hh > 23 || mm > 59) return null;
      const check = new Date(Date.UTC(y, m - 1, d));
      if (check.getUTCDate() !== d) return null;
      return { y: y, m: m, d: d, hh: hh, mm: mm, timed: timed };
    },
    // The text that goes in DTSTART / DTEND. Timed: 20261022T183000. All day: 20261022.
    stampOf(p, timed) {
      const pad = (n, w) => String(n).padStart(w || 2, '0');
      const day = pad(p.y, 4) + pad(p.m) + pad(p.d);
      return timed ? day + 'T' + pad(p.hh) + pad(p.mm) + '00' : day;
    },
    // Adds minutes or days to a parsed date with UTC arithmetic only, so no time zone can shift it.
    addTo(p, minutes, days) {
      const d = new Date(Date.UTC(p.y, p.m - 1, p.d + (days || 0), p.hh, p.mm + (minutes || 0)));
      return {
        y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
        hh: d.getUTCHours(), mm: d.getUTCMinutes(), timed: p.timed,
      };
    },
    // The text of a calendar file with one entry. `now` is a Date (the time the file was made).
    // Returns null when start is not a real date or time.
    icsFor(o) {
      const start = this.parseWhen(o.start);
      if (!start) return null;
      const end = this.parseWhen(o.end);
      let endPart;
      if (start.timed) {
        const endAfterStart = end && end.timed && o.end > o.start;
        endPart = endAfterStart ? end : this.addTo(start, 60, 0);
      } else {
        const lastDay = end && !end.timed && o.end >= o.start ? end : start;
        endPart = this.addTo(lastDay, 0, 1); // all-day ends are the day after the last day
      }
      const stamp = (n) => String(n).padStart(2, '0');
      const u = o.now;
      const dtstamp = u.getUTCFullYear() + stamp(u.getUTCMonth() + 1) + stamp(u.getUTCDate()) + 'T' +
        stamp(u.getUTCHours()) + stamp(u.getUTCMinutes()) + stamp(u.getUTCSeconds()) + 'Z';
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Search Desk//Add to calendar//EN',
        'BEGIN:VEVENT',
        'UID:' + o.uid,
        'DTSTAMP:' + dtstamp,
        start.timed ? 'DTSTART:' + this.stampOf(start, true) : 'DTSTART;VALUE=DATE:' + this.stampOf(start, false),
        endPart.timed ? 'DTEND:' + this.stampOf(endPart, true) : 'DTEND;VALUE=DATE:' + this.stampOf(endPart, false),
        'SUMMARY:' + this.escapeText(o.title),
      ];
      if (o.where) lines.push('LOCATION:' + this.escapeText(o.where));
      if (o.url) lines.push('URL:' + String(o.url).replace(/\r|\n/g, ''));
      lines.push('END:VEVENT', 'END:VCALENDAR');
      return lines.map((l) => this.foldLine(l)).join('\r\n') + '\r\n';
    },
    // A safe file name: letters, digits and dashes, ending in .ics, at most 80 characters.
    fileName(text) {
      const slug = String(text || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 75);
      return (slug || 'event') + '.ics';
    },
    // The same id every time for the same thing, so a calendar replaces the entry instead of doubling it.
    // A job gives job-<id>@searchdesk; an event (no type) gives event-<id>@searchdesk.
    uidFor(item) {
      return (item.type === 'job' ? 'job-' : 'event-') + item.id + '@searchdesk';
    },
    // The entry title for a job: "Interview: Line cook at Maple Cafe" (the org is left out when there is none).
    jobTitle(job, prefix) {
      const org = String(job.org || '').trim();
      return prefix + ': ' + job.title + (org ? ' at ' + org : '');
    },
  },
  mount(ctx) {
    const logic = this.logic;

    // Shared by both buttons: build the file and save it. `info` is {uid, title, start, end, where, url, name}.
    function save(info) {
      const text = logic.icsFor({
        uid: info.uid, title: info.title, start: info.start, end: info.end,
        where: info.where, url: info.url, now: ctx.now(),
      });
      if (text === null) return ctx.ui.toast(ctx.t('badDate'));
      const ok = ctx.download(logic.fileName(info.name), text, 'text/calendar');
      ctx.ui.toast(ctx.t(ok ? 'saved' : 'notSaved'));
    }

    ctx.slot('job.actions', {
      id: 'calendar-job',
      label: ctx.t('jobButton'),
      run(job) {
        if (!job.interviewAt) return ctx.ui.toast(ctx.t('noInterview'));
        save({
          uid: logic.uidFor(job),
          title: logic.jobTitle(job, ctx.t('interviewPrefix')),
          start: job.interviewAt,
          end: '',
          where: job.where,
          url: job.link,
          name: 'interview ' + job.title,
        });
      },
    });

    ctx.slot('event.actions', {
      id: 'calendar-event',
      label: ctx.t('eventButton'),
      run(event) {
        save({
          uid: logic.uidFor(event),
          title: event.title,
          start: event.start,
          end: event.end,
          where: [event.venue, event.address].filter(Boolean).join(', '),
          url: event.url,
          name: event.title,
        });
      },
    });
  },
});
