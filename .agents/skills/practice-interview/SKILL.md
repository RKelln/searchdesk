---
name: practice-interview
description: Use when someone wants to practise an interview for a job on their desk, with you as the interviewer and then the coach.
---

# Practise an interview from the desk

The desk has a recipe for this, `features/recipe-coach.js`. On the web it is copied into a chat. You are the chat, so
you build the same opening message yourself and the person copies nothing. Use the recipe's words, not an interviewer
of your own: it was tested, and it is short on purpose.

## Build the opening message

1. **The instructions.** Run `node tools/interview-harness/export-prompt.js --workshop` if this copy has
   `data/workshop.js` (a practice copy), or without `--workshop` if it does not. That prints exactly what the desk's
   "Copy only the instructions" gives. If Node will not run, use `tests/unit/golden/coach-v4.txt` instead: it is the
   same text for a practice copy. On a copy that is not a practice copy, take out the sentence that begins
   "Workshops:". Never paste the template with its `{placeholders}`, and do not change the options or any words.
2. **The context.** Read it with the `read-desk` skill (`--id profile`, then `--id <the job's id>`), and add it after
   the instructions in this shape, leaving out any line that has nothing in it:

   ```
   ---

   Candidate profile:
   What work: ...
   Field: ...
   Area: ...
   Languages: ...
   Reply language: ...

   Job posting:
   Job title: ...
   Employer: ...
   Where: ...
   Stage: ...
   What they ask for: ...
   Posting text:
   <the posting, cut to 4,000 characters>
   ```

   The profile lines are only the fields the person shares (Background, Availability and Avoid stay out unless the
   desk's sharing says otherwise). No notes, contacts or dates, and no records the person did not choose.
3. **Which job.** The one they name. If it is not on the desk, say so and ask; do not invent a posting.

## Then run it

Follow the instructions you built: the recipe says when to research, how many questions, one per turn, and no coaching
until the end. Wait for the person's answer each time and do not answer for them. When they say "interview over", or
after the last question, switch to coach as the recipe says, and offer the retry.

With a real person's desk, anything you send to the model may be kept: use only the fields above, and say so if they
ask what the interviewer knows.
