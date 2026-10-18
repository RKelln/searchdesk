# Reply due  (id: reply-clock, size: S)
In plain words: After an interview, shows the date the employer should have told you the result by.
Why someone wants it: In Ontario, employers have to tell you the outcome within a set time after the last interview
(45 days in the 2026 rules). Knowing the date tells you when it is fair to ask.

Done when:
- [ ] An agent in the folder adds `checks/reply-clock.check.js`, and `node checks/run.js reply-clock` passes.
- [ ] A job that has an interview date today or earlier (`interviewAt`, the stage is not `closed`) shows a "Reply due"
      section in its detail view: the interview date, the due date, and how far away it is ("in 12 days",
      "3 days late") using `ctx.fmt`.
- [ ] The section also shows the rule's name as a link to its source (`ctx.locale.postingRules.source`), so the person
      can check it.
- [ ] A job with no interview date, or an interview in the future, shows no section at all.
- [ ] The number of days comes from the setting `replyDays`. If it was never set, the locale's
      `postingRules.replyDays` is used (Ontario: 45). A `0` turns the feature off: no section, no Home row.
- [ ] The Data and settings screen has a "Reply due" block with one number box for the days, a line saying what the
      locale's number is, and a note that 0 turns it off. A bad value (not a whole number from 0 to 365) is refused with
      a plain sentence and nothing is saved.
- [ ] Home gets a "Replies due" block listing jobs whose due date is within the next 7 days or already late, soonest
      first. It shows nothing when there is none (render nothing to hide it).
- [ ] A locale with no `postingRules` or `replyDays` of 0 and no setting means the feature is off, and nothing breaks.

Data: `ext['reply-clock']` on the `settings` record: `{replyDays: <whole number>}`. Owns no record type.
Record types: none.
Slots: `job.panel`, `home`, `settings`   Soft uses: none.
ctx calls: `ctx.slot` (three times), `ctx.locale.postingRules`, `ctx.store.get('settings')`,
`ctx.store.ext('settings', {replyDays})`, `ctx.store.all('job')`, `ctx.now()`, `ctx.fmt.date`, `ctx.fmt.relative`,
`ctx.fmt.daysFrom`, `ctx.t`, `ctx.h`.
Dates: `interviewAt` is `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` (no zone). Use only its first ten characters. Add days
as whole calendar days, with no time zone shifts.

Settings record: `ctx.store.ext('settings', patch)` always works. If the `settings` record is missing, core makes it
on that first write (it is not counted as a change to back up). `ctx.store.get('settings')` may be `undefined`, so
`effectiveDays` must accept that.

Checks to write (in `logic`; `today` is `YYYY-MM-DD`):
- `effectiveDays(settingsRecord, localeRules)` gives the setting if it is a whole number from 0 to 365, else the
  locale's `replyDays`, else 0.
- `dueDate('2026-10-01', 45)` is `'2026-11-15'`; it works over a month end and a year end; `dueDate('2026-10-01T14:30',
  45)` is the same; `dueDate('', 45)` and `dueDate('2026-10-01', 0)` are `null`.
- `replyInfo(job, days, today)` returns `null` when it does not apply (no date, future interview, stage `closed`,
  `days` 0), else `{interview, due, daysLeft}` where `daysLeft` is negative when late.
- `dueSoon(jobs, days, today)` returns the jobs due within 7 days or late, sorted by due date, skipping `closed`
  and deleted jobs.
- `cleanDays('45')` is `{ok: true, days: 45}`; `'0'` is ok; `'-3'`, `'4.5'` and `'x'` give `{ok: false, problem}`.

Out of scope: telling the person what to do if the date passes; legal advice; a copy of the whole rule.
Ideas for after: pair it with `recipe-followup` (a "Ask about my result" message); show the date on the `print`
page; let each job have its own number of days.
