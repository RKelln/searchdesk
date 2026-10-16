# This week  (id: week, size: S)
In plain words: How many you applied to, followed up and went to this week. No streaks and no scores.
Why someone wants it: Job searching feels endless. A small plain count of what you did this week shows that you are
moving, without pressure.

Done when:
- [ ] `node checks/run.js week` passes.
- [ ] Home shows a "Your week" block with three counts for the last 7 days (today and the 6 days before): "Applied to
      N", "Followed up N times", "Went to N events".
- [ ] "Applied to" counts jobs whose `applied` date is in those 7 days.
- [ ] "Went to events" counts starred events (`event-mark`, status `starred`) whose start date is in those 7 days and
      is not after today.
- [ ] "Followed up" counts the dates saved by this feature's button. Each job's detail view has an "I followed up
      today" button (a `job.actions` entry) that adds today's date to the job's `ext.week.followedUp` list (no
      repeat dates). The toast can Undo it.
- [ ] When all three counts are 0 the block says "Nothing yet this week. A small step counts." and shows no numbers.
- [ ] No streaks, no scores, no goals, no red or green marks, and no comparison with other weeks. Words stay kind.

Data: `ext.week` on `job`: `{followedUp: ['YYYY-MM-DD', ...]}`. Owns no record type.
Record types: none.
Slots: `home`, `job.actions`   Soft uses: none. (Starred events come from `event-mark` records; if there are none the
count is 0.)
ctx calls: `ctx.slot('home', {id, render(el)})`, `ctx.slot('job.actions', {id, label, run(job)})`,
`ctx.store.all('job')`, `ctx.store.all('event-mark')`, `ctx.store.ext(job.id, {followedUp})`, `ctx.now()`,
`ctx.ui.toast(text, {undo: true})`, `ctx.t`, `ctx.h`.
Dates: `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`; compare the first ten characters.

Checks to write (in `logic`; `today` is `YYYY-MM-DD`):
- `windowStart(today)` is the day 6 days before.
- `countApplied(jobs, today)` counts `applied` dates inside the window; skips deleted jobs.
- `countFollowed(jobs, today)` counts saved follow-up dates inside the window, across all jobs.
- `countEvents(marks, today)` counts starred marks with `copy.start` inside the window and not after today.
- `addFollowDate(list, today)` returns a new list without a repeat, and sorted.
- `allZero(counts)` is true only when every count is 0.

Out of scope: goals; targets; streaks; weekly emails; scores of any kind.
Ideas for after: "Last week" beside it (just numbers); the same counts in the `print` summary; a gentle line when the
week had a hard stretch.
