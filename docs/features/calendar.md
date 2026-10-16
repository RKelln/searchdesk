# Add to calendar  (id: calendar, size: S)
In plain words: Put an interview or a starred event into your phone's calendar.
Why someone wants it: A date written in a tracker is easy to miss. In the calendar it gets a reminder.

Done when:
- [ ] `node checks/run.js calendar` passes.
- [ ] A job's detail view has an "Add the interview to my calendar" button. A job with an `interviewAt` saves a file
      named like `interview-<job title>.ics`. A job without one shows a toast: "This job has no interview date yet."
- [ ] Every event row has an "Add to my calendar" button that saves a `.ics` file for that event.
- [ ] The file opens in the Calendar app on a phone or computer (try it by hand; this part is not a check).
- [ ] A date with no time becomes an all-day entry. A date with a time becomes a timed entry that lasts 1 hour when
      there is no end time.
- [ ] The title, place and link are in the entry. A job entry has the organisation in the title.
- [ ] Commas, semicolons, backslashes and line breaks in the text are escaped, so a title like `Cook, line; day 2`
      does not break the file.
- [ ] Saving the same job twice gives the same entry id (`UID`), so a calendar can replace it, not double it.

Data: none. Reads `job` records (`title`, `org`, `interviewAt`, `where`, `link`) and the event object the slot gives.
Record types: none.
Slots: `job.actions`, `event.actions`   Soft uses: none.
ctx calls: `ctx.slot`, `ctx.ui.toast`, `ctx.now()` (for the file's stamp), `ctx.t`, `ctx.fmt` if you show the date in
the toast.
Dates: `interviewAt` and event `start`/`end` are `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`, local wall-clock time with no
zone. Write them as floating local times (`DTSTART:20261022T183000`, all-day: `DTSTART;VALUE=DATE:20261022`), with no
`Z` and no zone, so the entry stays at that wall-clock time.

Needs from core: there is no `ctx` call that saves a file (core's own export does it inside `core/io.js`). Until
there is one, `mount` code may build a `Blob` and a temporary link with `document.createElement` and click it; none of
those words are banned by the contract scan. Keep that code small and in one function so it can move to a `ctx` call
later.

Checks to write (in `logic`):
- `icsFor({uid, title, start, end, where, url, now})` returns the text of a calendar file. It starts with
  `BEGIN:VCALENDAR`, ends with `END:VCALENDAR` and a line break, and uses `\r\n` between lines.
- A date-only start gives `DTSTART;VALUE=DATE:`; a date with a time gives `DTSTART:` without a `Z`.
- With no end, a timed entry ends 1 hour later; an all-day entry ends the next day.
- `escapeText('a,b;c\\d\ne')` gives `a\,b\;c\\d\ne` (the line break becomes the two characters `\n`).
- Lines longer than 75 characters are folded (next line starts with one space).
- `fileName('Cook, line / day 2')` has only letters, numbers and hyphens, and ends in `.ics`.
- `uidFor(job)` is the same every time for the same job.

Out of scope: asking for reminders ahead of time (`VALARM`); repeat events; time zones; sending to Google or Outlook.
Ideas for after: add the follow-up date as an all-day entry; "Add all my starred events" in one file; a reminder
the day before.
