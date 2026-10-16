# Board view  (id: board, size: M)
In plain words: Jobs as columns by stage.
Why someone wants it: Some people see their search better as a board than as a list.

Done when:
- [ ] `node checks/run.js board` passes.
- [ ] A "Board" item is in the menu. It shows five columns, in order: Saved, Applied, Interview, Offer, Closed.
- [ ] Each job is a card with its title, organisation and next date (`ctx.fmt.date`). The cards in a column are
      ordered by next date, soonest first, then by title.
- [ ] A card is a button. Pressing it goes to the job's detail view (`ctx.ui.go('jobs/' + job.id)`). Moving a job to
      another stage happens there, not here: this feature does not own `job` and cannot change it.
- [ ] Each column header shows its count. An empty column says "None".
- [ ] On a narrow phone screen the columns stack one under another (no sideways scroll at 320 px; look by hand).
- [ ] A job with a stage that is not one of the five is shown in a sixth column, "Other".
- [ ] The jobs `Closed` more than 30 days ago (by `updated`) are hidden behind a "Show older closed jobs" button.

Data: none. Reads `job`.
Record types: none.
Slots: `tab`   Soft uses: none.
ctx calls: `ctx.slot('tab', ...)`, `ctx.store.all('job')`, `ctx.ui.go`, `ctx.now()`, `ctx.fmt.date`, `ctx.t`, `ctx.h`.

Checks to write (in `logic`):
- `columns(jobs, today)` returns `[{stage, jobs}]` for the five stages in order, plus `other` only when a job needs it;
  deleted jobs are left out; it does not change its input.
- Each column's jobs are sorted by next date then title; a job with no next date comes last.
- `hiddenClosed(jobs, today)` counts closed jobs older than 30 days.

Out of scope: dragging cards; changing a job's stage here; colours per stage.
Ideas for after: a filter box; show late follow-ups with a mark; a stage count on Home.
