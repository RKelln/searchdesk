# Pay notes  (id: pay, size: S)
In plain words: The pay each posting gives, beside the pay you are aiming for.
Why someone wants it: Pay is easy to forget between postings. Seeing both numbers on a job helps you decide, and helps
when an employer asks what you expect.

Done when:
- [ ] An agent in the folder adds `checks/pay.check.js`, and `node checks/run.js pay` passes.
- [ ] A job's detail view has a "Pay" section with two boxes: "The posting says" and "What I am aiming for". Each is a
      yearly amount or an hourly amount (a choice), with a low number and an optional high number.
- [ ] Saving writes `ext.pay` on the job and shows a short plain summary, for example "The posting says $20 to $24 an
      hour. You aim for $23."
- [ ] The summary compares the posting with your aim (using your lowest number, and the posting's top number, which
      is its low number if it gave no high). Posting top under your aim: "Below what you aim for." Your aim inside
      the posting's range: "Inside what you aim for." Your aim under the posting's low number: "Above what you aim for."
      If either side is empty, it says nothing about the match.
- [ ] A job with no pay notes shows "No pay noted yet." and the two empty boxes.
- [ ] Numbers must be whole or have cents; text that is not a number is refused with a plain sentence.
- [ ] Hourly and yearly amounts are never compared with each other: the summary says "Different units, not compared."
- [ ] Nothing is sent to the AI.

Data: `ext.pay` on `job`: `{posted: {low, high, per}, aim: {low, high, per}}`, with `per` = `'hour'` or `'year'` and
the numbers as numbers or `null`. Owns no record type.
Record types: none.
Slots: `job.panel`   Soft uses: none. (`recipe-posting` puts the pay line it found into the job's notes today, as plain
text. This feature does not read it.)
ctx calls: `ctx.slot('job.panel', {id, title, render(el, job)})`, `ctx.store.ext(job.id, {posted, aim})` (it merges
the fields you give into `ext.pay`), `ctx.t`, `ctx.h`, `ctx.ui.toast`.

Checks to write (in `logic`):
- `cleanAmount(text)` accepts `24`, `24.50`, `$24`, `65,000` and returns a number; `''` gives `null`; `abc` gives
  `{problem: 'badNumber'}`.
- `describe({low, high, per})` gives `$20 to $24 an hour`, `$65,000 a year`, `$20 an hour` and `''` for nothing.
- `compare(posted, aim)` returns `'below'`, `'inside'`, `'above'` or `'unknown'` (rules as above); it returns `'unknown'` when the units
  differ or a side is empty.
- Low higher than high is refused (`problem: 'lowHigh'`).

Out of scope: converting hourly to yearly; looking up average pay; sorting the job list by pay.
Ideas for after: remember your aim and fill it in for new jobs; show the pay on the one-page summary (`print`
slot); add the benefits you were told about.
