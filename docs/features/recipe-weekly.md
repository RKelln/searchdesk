# AI: weekly check-in  (id: recipe-weekly, size: M)
In plain words: Sends your open jobs and suggests the next step for each, as suggestions.
Why someone wants it: Once a week it helps to ask "what should I do next on each of these?" A free chat can give a
short answer for each job, and you decide which to use.

Done when:
- [ ] An agent in the folder adds `checks/recipe-weekly.check.js`, and `node checks/run.js recipe-weekly` passes.
- [ ] The AI helper screen lists a "Weekly check-in" task.
- [ ] The question lists the open jobs (every stage but `closed`, at most 15, those with the earliest next dates first),
      each with an alias `J1`, `J2`, ... and its stage, title, organisation, applied date, next step and dates. It also has the
      shared profile lines. It never has notes, links or the posting text.
- [ ] The answer lines are `J1 | one short next step`. The step is one plain sentence.
- [ ] Each accepted line becomes one `suggestion` with `kind: 'job-next'`, `target` = the job id and `why` = the
      step (core saves it with `source: 'ai'` and `status: 'new'`).
- [ ] A job's detail view shows a "Suggested next step (from AI)" section when it has a `new` job-next suggestion, with
      "Use it" and "Not for me". "Use it" saves the text on the job's `ext['recipe-weekly'].nextStep` and sets the
      suggestion to `taken`, in one `ctx.store.batch`. "Not for me" sets it to `dismissed`.
- [ ] A suggestion for a job that was deleted is not shown.
- [ ] The question is under `Desk.prompt.BUDGET` characters (6,000) with 15 jobs.
- [ ] The chat route never changes the job's own fields. The job's `nextStep` is not touched.

Data: lists `suggestion` in `types` to change a job-next suggestion's status (like `features/events.js`). Writes
`ext['recipe-weekly'].nextStep` on a job. Never create suggestions; core makes them.
Record types: `suggestion` (status changes only).
Slots: `job.panel`   Soft uses: none.
ctx calls: `ctx.recipe(def)` with `data`, `answer: {J: ['step']}`, `example`, `apply`, `needs`; `ctx.slot('job.panel',
...)`; `ctx.store.all('suggestion')`, `put`, `batch`; `ctx.store.ext(job.id, {nextStep})`; `ctx.t`, `ctx.h`. Read
`features/recipe-events.js` for the shape of `data` (items with `kinds`), `answer`, and `apply` (the accepted lines have
`alias`, `id` and `fields`).

Needs from core: nothing is built that shows a `job-next` suggestion (only `job-draft` has a lane in `features/jobs.js`),
and this feature cannot write the job's own `nextStep` because it does not own `job`. So the panel above keeps the taken
step in this feature's `ext`. If the maintainer wants it in the job's real Next step box, `features/jobs.js` has to take
it.

Checks to write:
- `logic.rows(jobs, today)` leaves out closed and deleted jobs, orders by next date, caps at 15, and the row never
  includes notes, link or posting.
- `logic.suggestions(accepted)` turns `[{alias: 'J1', id: 'j_abc', fields: {step: '...'}}]` into one `job-next`
  suggestion each, and skips a line with no step.
- The template has every placeholder you list (`Desk.prompt.absentPlaceholders` / `missingPlaceholders` are empty).

Out of scope: changing jobs; moving stages; scheduling. 
Ideas for after: a once-a-week reminder on Home; ask for a ranking as well; a short "what went well" line.
