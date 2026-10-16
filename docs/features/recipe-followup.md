# AI: follow-up message  (id: recipe-followup, size: S)
In plain words: Drafts a short follow-up or thank-you note for a job. You copy it yourself.
Why someone wants it: Many people do not follow up because they do not know what to write. A short draft to edit
removes the hard part.

Done when:
- [ ] `node checks/run.js recipe-followup` passes.
- [ ] The AI helper screen lists a "Follow-up message" task.
- [ ] A job's detail view has a "Write a follow-up message" button. It goes to `#ai/followup/<job id>`, and the task
      uses that job.
- [ ] The task has one choice, "What is it for": "After I applied" or "After an interview" (a thank-you).
      The default is "After an interview" when the job's stage is `interview`, else "After I applied".
- [ ] The question holds the shared profile lines (`ctx.profileLines()`), and the job's title, organisation, stage,
      applied date and interview date. It never holds the job's notes or link.
- [ ] The question asks for a short message (under 120 words), plain words, no made-up facts, and a line for the
      person's name left as `[your name]`.
- [ ] No answer is read back (`answer: null`): the person copies the draft from the chat. Nothing is added to records.
- [ ] If the job is missing (deleted), `needs` says so in a plain sentence with a link back to `jobs`.
- [ ] The question is under `Desk.prompt.BUDGET` characters (6,000), even with a long profile.
- [ ] The instructions are plain text at the top of the file, and every `{placeholder}` is listed in `placeholders`.

Data: none. Owns no record type.
Record types: none.
Slots: `job.actions`   Soft uses: none.
ctx calls: `ctx.recipe(def)`, `ctx.slot('job.actions', {id, label, run})` with `ctx.ui.go('ai/followup/' + job.id)`,
`ctx.t`. Inside the recipe's `needs(c)` and `data(c, opts)`: `c.route()`, `c.store.get`, `c.profileLines()`,
`c.fmt`. Read `features/recipe-coach.js` for a complete working example of the same pattern (job from the address,
`options`, `answer: null`). The fields a recipe can have are listed at the top of `core/recipes.js`.
Remember: on the AI screen a recipe's `data(c, opts)` gets the job id as `(opts.args || [])[0]`.

Checks to write:
- `logic.TEMPLATE` contains every placeholder you list, and `Desk.prompt.absentPlaceholders` /
  `missingPlaceholders` are both empty for it (see `checks/recipe-coach.check.js`).
- `logic.jobLines(job)` includes the title and organisation, and does not include the notes or the link, even when the
  job has both.
- `logic.kindFor(job)` gives `'thanks'` for stage `interview`, else `'followup'`.
- `logic.question(...)` with a very long profile stays under 6,000 characters.

Out of scope: sending the message; reading the draft back into the app; saving drafts.
Ideas for after: a "Ask about my result" kind that uses the `reply-clock` date; a choice of language; a choice of
tone (warm or formal).
