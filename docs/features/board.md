# Board view  (was: id `board`, size: M)
In plain words: Jobs as columns by stage.

**This is built, inside Jobs.** It was first written as a separate `board` feature with its own menu tab. It is now a
List/Board choice on the Jobs screen instead, so there is one place for jobs and the menu stays short. Nothing is
planned here any more.

Why it moved: a person who is looking at their search wants one screen, not a list of jobs over here and a board of
the same jobs over there. And on a big screen the board is the better default; on a phone the list is.

What is built (`features/jobs.js`, checks in `checks/jobs.check.js`):

- [x] `node checks/run.js jobs` passes.
- [x] The Jobs screen shows **List** or **Board**. A screen 1100px and wider starts on the board, anything narrower
      starts on the list, and whichever is chosen is remembered on that device (`ext.jobs.view` on `settings`).
- [x] The board shows five columns, in order: Saved, Applied, Interview, Offer, Closed.
- [x] Each card is a button with the job's title, organisation (or place) and next date (`ctx.fmt.dateTime`).
      Pressing it opens the job.
- [x] Each column's cards are ordered by next date, soonest first, then by title; a job with no next date comes last.
- [x] Each column header shows its count. An empty column says "None".
- [x] Below 1100px the columns stack one under another, so there is no sideways scroll at 320px.
- [x] A job whose stage is not one of the five goes in a sixth column, "Other".
- [x] Closed jobs whose last change is more than 30 days ago (by `updated`) are kept out of the Closed column
      behind a "Show N older closed jobs" button.

Changed from the original brief, on purpose:

- **Moving a job to another stage is not here.** On a board a card is about as narrow as 180px, and five stage
  buttons in 180px are unreadable. So a board card has no stage buttons. On a wide screen the job opens *beside*
  the list and the stage buttons are in the job; on a phone the list keeps them on each row, as it always did.
- **It is not a menu tab.** Nothing is lost by this except one more item in the menu.

Ideas for after: a filter box on the board itself; a mark on cards whose follow-up is late; dragging a card between
columns (this would need a change to the contract, since `board` no longer owns anything and `jobs` does).
