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
Record types: none. Set `types: []` and `uses: []`.
Slots: `job.actions`, `event.actions`   Soft uses: none.

Slot details:
- Each slot entry needs an `id` and a `label`: the words on the button, from your strings (`ctx.t('jobButton')`). Use the ids
  `calendar-job` and `calendar-event`, so the buttons get the test names `action-calendar-job` and `action-calendar-event`.
- `job.actions` runs as `run(job)` with the job record. It shows on every job, even one with no interview date.
- `event.actions` runs as `run(event)` with a copy of the event. The fields are `id`, `title`, `start`, `end`, `venue`,
  `address`, `url`, `tier`, `tags`. `end` is `''` when there is none, and `venue` and `address` may be empty. The place
  is `venue` and `address` joined with ", " (leave out the empty one). There is no `where` on an event.
- A job's fields are `title`, `org`, `where`, `link` and `interviewAt`. The link is `link` (not `url`).
- The `job.actions` button text is `ctx.t('jobButton')`, and the toast for no date is `ctx.t('noInterview')`.
  Both strings must be in `strings`.
ctx calls: `ctx.slot`, `ctx.download`, `ctx.ui.toast`, `ctx.now()` (for the file's stamp), `ctx.t`, `ctx.fmt` if you show the date in
the toast.
Dates: `interviewAt` and event `start`/`end` are `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`, local wall-clock time with no
zone. Write them as floating local times (`DTSTART:20261022T183000`, all-day: `DTSTART;VALUE=DATE:20261022`), with no
`Z` and no zone, so the entry stays at that wall-clock time.

Timed and all-day rules:
- A timed start with no end, or an end that is not later than the start, ends 1 hour later. The hour can cross midnight.
- A timed start with a later end time uses that end.
- A date-only start is all day. Its end is the day after the last day (the end date if one is given, else the start date).
- `DTSTAMP` is the one line that needs a `Z`. It is the time the file was made, in UTC, from `ctx.now()`
  (for example `DTSTAMP:20261016T120000Z`). Every other date has no `Z`.
- The check passes the time in. `logic` has no clock, so `icsFor` gets `now` as a Date and reads its UTC parts.
  Do the date sums with `Date.UTC` only, so no time zone can move an entry.
- If `start` is not a real date or time, `icsFor` returns `null`. `mount` then shows the `badDate` string.

Entry details:
- The job's title is `Interview: <job title> at <org>`. Leave out " at <org>" when the job has no org. Make it with a
  `logic` helper and the prefix string `interviewPrefix` (passed in from `ctx.t`).
- The event's title is the event's `title`.
- `LOCATION` is the place, escaped. `URL` is the link, with no escaping and no line breaks. Leave out `LOCATION` and
  `URL` when they are empty.
- `UID` is `job-<id>@searchdesk` for a job and `event-<id>@searchdesk` for an event (an event has no type, so the
  prefix is `event-`). `uidFor(item)` takes the record or event and uses its `id` and `type`.
- Folding (`foldLine`): count characters, not bytes. A line over 75 characters is cut at 75, and each next piece is 74
  characters with one space in front.

File name:
- `fileName(text)` keeps letters, digits and dashes. Every other run of characters (spaces, commas, dots,
  accents) becomes one dash, and dashes at the ends are removed. It keeps the case, cuts to 75 characters and adds
  `.ics`. So `interview Line cook` gives `interview-Line-cook.ics`, and `Cook, line / day 2` gives `Cook-line-day-2.ics`.
  Use it for jobs with `fileName('interview ' + job.title)`.
- If the name is empty after this, use `event.ics`.

Saving the file: `ctx.download(name, text, type)` saves a text file and returns `true` or `false`. Use
`ctx.download(fileName(...), icsText, 'text/calendar')`. The name may use only letters, digits, dash, dot and
underscore (up to 80 characters) and the type must be `text/calendar`, `text/plain`, `text/csv` or `application/json`;
otherwise it returns `false`, so show a plain toast when it does. Do not build a `Blob` or a link yourself.

Checks to write (in `logic`). Use these names: `escapeText`, `foldLine`, `fileName`, `uidFor`, `icsFor`, `jobTitle`.
Strings the build needs (all in `strings`): `jobButton`, `eventButton`, `noInterview`, `saved`, `notSaved`, `badDate`,
`interviewPrefix`. If `ctx.download` returns `false`, show `notSaved`.
- `icsFor({uid, title, start, end, where, url, now})` returns the text of a calendar file (or `null`, see above). It starts with
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
