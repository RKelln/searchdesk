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
ctx calls: `ctx.slot('tab', ...)`, `ctx.renderSlot('print', el)`, `ctx.store.all`, `ctx.now()`, `ctx.fmt.date`, `ctx.h`, `ctx.t`.

Checks to write (in `logic`; `today` is `YYYY-MM-DD`):
- `weekDates(jobs, today)` returns `[{job, kind: 'followUp' | 'interview' | 'closes', date}]` for dates from today to
  today + 6, sorted by date then title. A job with stage `closed` gives nothing. An interview with a time uses its date.
- `lateJobs(jobs, today)` returns jobs with a follow-up date before today and a stage other than `closed`.
- `starredThisWeek(marks, today)` keeps `starred` marks whose `copy.start` is within the window, or whose `copy.end` is
  today or later and `copy.start` is before today; it skips deleted marks.
- None of them change their input.

Out of scope: choosing a different range; page layouts; sending the page by email.
Ideas for after: let `sites` and `contacts` add their own `print` sections; a "Next week" button; a big-print version.
