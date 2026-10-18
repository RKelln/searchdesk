# Posting checklist  (id: checklist, size: S)
In plain words: What a posting must tell you in Ontario, and whether this one does.
Why someone wants it: The 2026 posting rules say what a posting has to include. Checking each one takes a minute and
shows which postings are careful with you.

Done when:
- [ ] An agent in the folder adds `checks/checklist.check.js`, and `node checks/run.js checklist` passes.
- [ ] A job's detail view has a "Posting checklist" section. It lists every item in
      `ctx.locale.postingRules.checklist` (Ontario: pay range, says if AI screens applicants, says if the job is open now).
- [ ] Each item has three buttons: Yes, No, Not sure. The answer is saved on the job and still there after a reload.
- [ ] A line at the top counts them: "2 of 3 yes. 1 not sure."
- [ ] The section shows the rule's name as a link to its source (`postingRules.source`).
- [ ] If the locale has no `postingRules.checklist`, the section is not shown at all.
- [ ] An answer saved for an item the locale no longer lists is kept in the data and not shown.
- [ ] Text says "the posting should tell you", not that anything is illegal. It is a prompt to look, not legal advice.

Data: `ext.checklist` on `job`: `{answers: {<item id>: 'yes' | 'no' | 'unsure'}}`. Owns no record type.
Record types: none.
Slots: `job.panel`   Soft uses: none today. (`recipe-posting` finds the posting's pay and AI-screening lines, but saves
them as text in the job's notes, so this feature does not read them. A fast person can add that later.)
ctx calls: `ctx.slot('job.panel', ...)`, `ctx.locale.postingRules`, `ctx.store.ext(job.id, {answers})`, `ctx.t`, `ctx.h`.
Note: `ext` merges one level, so pass the whole `answers` object each time.

Checks to write (in `logic`):
- `items(localeRules)` returns the list, or `[]` when the locale has none.
- `setAnswer(answers, itemId, value)` returns a new object; a value other than yes/no/unsure is refused; the input is
  not changed.
- `summary(items, answers)` returns `{yes, no, unsure, open}` where `open` is the items with no answer yet.

Out of scope: reading the posting for the person; law text; telling the person to complain.
Ideas for after: fill pay and AI items from `recipe-posting`'s result; show the "yes" count in the jobs list; a
`print` section.
