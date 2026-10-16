# One-page summary  (id: print, size: S)
In plain words: A page you can print or save as a PDF: this week's jobs, dates and events.
Why someone wants it: Some people do their search with paper, or bring a page to the library or a meeting with a
worker. Other features can add their own section to this page.

Done when:
- [ ] `node checks/run.js print` passes.
- [ ] A "Summary" item is in the menu. It shows today's date and a "Print or save as PDF" button that opens the
      browser's print window (`window.print()`).
- [ ] "Dates this week" lists every job whose follow-up date, interview date or closing date falls in the next 7 days
      (today counts), earliest first, with the job title, what the date is for, and the date.
- [ ] Jobs that are late (a follow-up date before today, on a job that is not `closed`) are listed in "Late" above it.
- [ ] "Events I starred" lists starred events (`event-mark` records with `status: 'starred'`, using `copy.title`,
      `copy.start`, `copy.venue`) that start in the next 7 days or are on now.
- [ ] After those, the page shows every section other features added to the `print` slot (`ctx.renderSlot('print', el)`).
- [ ] When printed, the menu is hidden and the text is black on white. Add a `@media print` rule in `css` that hides
      `nav.tabs` and anything else that is not the summary. Try it with the browser's print preview (by hand).
- [ ] With nothing to show, the page says "Nothing this week." in plain words.
- [ ] It sends nothing to the AI and writes nothing.

Data: none. Reads `job`, `event-mark`.
Record types: none.
Slots: `tab`. It also draws the `print` slot, so other features can add sections.   Soft uses: none needed (any feature
that registers a `print` entry shows up here by itself).
ctx calls: `ctx.slot('tab', ...)`, `ctx.renderSlot('print', el)`, `ctx.store.all`, `ctx.now()`, `ctx.fmt.date`,
`ctx.fmt.dateTime`, `ctx.h`, `ctx.t`. The print button calls `window.print()` directly. The contract has no ctx call
for printing, and the rules do not forbid it.

Fields this feature reads (the brief's names are in words above; these are the record fields):
- `job`: `title`, `stage` (`saved`, `applied`, `interview`, `offer`, `closed`), `followUp` (`YYYY-MM-DD`), `closes`
  (`YYYY-MM-DD`), `interviewAt` (`YYYY-MM-DD`, or `YYYY-MM-DDTHH:MM` when there is a time).
- `event-mark`: `status` (`starred` or `dismissed`), `deleted`, and `copy` with `title`, `start`, `end` (optional),
  `venue`. `copy.start` and `copy.end` use the same date forms as `interviewAt`. A mark may have no `copy`; skip it.

Helpers to write in `logic` (the checks test these):
- `todayKey(date)`: `YYYY-MM-DD` for a Date, in local time. Use `getFullYear()`, `getMonth()` and `getDate()`. Do not
  use `toISOString()`, which is UTC and gives the wrong day in the evening.
- `dayOf(value)`: the day part of a date text, a date and time text, or an ISO time (converted to local time with
  `todayKey`). Returns `''` for a bad value.
- `daysFrom(today, day)`: whole days between two `YYYY-MM-DD` texts. Count with `Date.UTC`, so daylight saving does
  not change the answer.
- `isDay(text)`: true only for a plain `YYYY-MM-DD`.

The window is 7 days: today and the six days after it (`daysFrom` gives 0 to 6).

Order: late jobs oldest follow-up first; dates this week by date, then title; starred events by start, then title.

"Nothing this week." shows only when there are no late jobs, no dates, no starred events, and no other section from the
`print` slot. `ctx.renderSlot` returns how many blocks it added, so use that number.

The `@media print` rule in `css` hides `nav.tabs` and the button. The shell draws one screen at a time (inside
`.screen-body`), so nothing else is on the page to hide.

Leave `order` out of the `tab` definition unless the shell needs it; the brief does not give one.

Checks to write (in `logic`; `today` is `YYYY-MM-DD`):
- `weekDates(jobs, today)` returns `[{job, kind: 'followUp' | 'interview' | 'closes', date}]` for dates from today to
  today + 6, sorted by date then title. A job with stage `closed` gives nothing. An interview with a time uses its date.
- `lateJobs(jobs, today)` returns jobs with a follow-up date before today and a stage other than `closed`.
- `starredThisWeek(marks, today)` keeps `starred` marks whose `copy.start` is within the window, or whose `copy.end` is
  today or later and `copy.start` is before today; it skips deleted marks.
- None of them change their input.

Out of scope: choosing a different range; page layouts; sending the page by email.
Ideas for after: let `sites` and `contacts` add their own `print` sections; a "Next week" button; a big-print version.
