# Which resume  (id: resumes, size: S)
In plain words: Which version of your resume you sent where.
Why someone wants it: When an employer calls, you want to know which resume they have in front of them.

Done when:
- [ ] An agent in the folder adds `checks/resumes.check.js`, and `node checks/run.js resumes` passes.
- [ ] A job's detail view has a "Resume sent" section with a box for the version's name (for example "Cook, 1 page")
      and a date box (`YYYY-MM-DD`, with a "Today" button).
- [ ] Saving shows "Sent <name> on <date>." The section is empty and quiet for a job with no resume noted.
- [ ] The name box suggests the names you used on other jobs (a `datalist` of the distinct names).
- [ ] A name is needed to save; the date is optional. A date that is not a real date is refused.
- [ ] A "Clear" button removes both fields.
- [ ] The section also shows how many other jobs used the same version ("Also sent to 3 other jobs").

Data: `ext.resumes` on `job`: `{version, sentOn}`. Owns no record type.
Record types: none.
Slots: `job.panel`   Soft uses: none.
ctx calls: `ctx.slot('job.panel', ...)`, `ctx.store.all('job')` (to read other jobs' `ext.resumes`),
`ctx.store.ext(job.id, {version, sentOn})`, `ctx.now()`, `ctx.fmt.date`, `ctx.t`, `ctx.h`.
A cleared field: pass an empty string.

Checks to write (in `logic`):
- `cleanSent({version, sentOn})` trims, needs a name (`needVersion`), accepts an empty date or a real `YYYY-MM-DD`
  (`2026-02-30` is refused with `badDate`).
- `versionNames(jobs)` gives the distinct names, sorted, ignoring capital letters, and skips deleted jobs.
- `othersUsing(jobs, job)` counts other jobs with the same name (ignoring capital letters), not deleted.

Test hooks: put these `data-test` names on: `resume-panel` (the section), `resume-version` (the name box),
`resume-date` (the date box), `resume-versions` (the `datalist` of names you used before), `resume-today`,
`resume-save`, `resume-clear`, `resume-problem` (a refusal), `resume-count` ("Also sent to 3 other jobs") and
`resume-empty`. There is no menu link: this is a section inside a job. Add any new ones to `tests/e2e/README.md`.

Out of scope: storing the resume file or its text; comparing versions.
Ideas for after: a list of versions with the jobs that used each; the version name on the one-page summary; a
reminder to update a version that is old.
