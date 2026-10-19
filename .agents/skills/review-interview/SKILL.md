---
name: review-interview
description: Use when someone asks you to review the interview, the interviewer, or how the practice-interview recipe did, after a practice interview.
---

# Review the interview

"Review the interview" means: how did the interviewer do, measured against the recipe it was given. It does not mean
scoring the person's answers; the coach already gave that feedback at the end of the interview.

## What to read

1. **The interview.** It is the conversation you just had, or the transcript they give you. If neither is here, say
   so and ask for it.
2. **The recipe.** The instructions you were given, as the `practice-interview` skill builds them
   (`node tools/interview-harness/export-prompt.js --workshop`, or `tests/unit/golden/coach-v4.txt`). Read them again
   and judge the interviewer by those words, not by what a good interviewer might do in general.

## What to check, one by one

Quote the turn for each finding, and say plainly when something went well. Look at:

- **Pace:** one question per turn, and it waited for the answer. Did it ever answer for the person?
- **No coaching or praise mid-interview.** Did any feedback, score or "great answer" arrive before the end?
- **Follow-ups:** at most one per main question; a smaller question when an answer was vague; moving on after "skip",
  "pass" or "don't know".
- **Questions:** suited to the role and the posting, and including a past-example question.
- **The switch to coach:** at the right time (the last question, or "interview over"), and based only on answers that
  were given. Does each point quote something the person said?
- **Invention:** anything it made up about the employer, the candidate or the job.
- **Stopping:** did it respect a request to stop or to ask something smaller?

Tell what the interviewer did apart from what the person said or chose to skip. A made-up answer is the person's
choice, and a skipped question is not a mistake.

## Then one small change

Pick the issue that mattered most and propose one small change to the recipe's wording. Show the exact words, old and
new, and say which problem it addresses. Do not edit `features/recipe-coach.js`: the change goes in the desk's recipe
edit screen, and only if the person agrees. Say that one good conversation is evidence, not proof, and that the way
to find out is to try the changed recipe in another interview and compare.
