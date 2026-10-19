---
name: test-interview
description: Use when someone wants to test the interview recipe by letting two AI roles hold a practice interview, such as "run the interview test", or to compare the recipe with a change they have in mind.
---

# Test the interview recipe with two AI roles

You play neither part. An interviewer and a candidate are each a fresh helper agent, and you carry their messages
between them. This is how to find out what a recipe (or a change to it) does without a person typing the answers.
One run is evidence, not proof: the candidate is an AI playing a made-up person, and answers differ from run to run.

## What you need

- **The instructions under test.** The original, built as the `practice-interview` skill builds them, and the change if
  there is one. A change can be in three places, and it may not have been saved anywhere yet. Take the first that applies:
  1. **What the person points at**: a file they name, or "the one you just suggested".
  2. **A change saved in the desk.** Run `python3 tools/read-desk.py --type recipe-edit`, then `--id <id>` for the newest
     one whose `recipe` is `coach`. Its `text` is the whole recipe with `{placeholders}` in it; fill them with the
     same values the original used (the workshop sentence, the number of questions, the kind of question, the research
     step, no language), and put the context block where `{context}` is.
  3. **A change proposed in this conversation** (for example by the review) and not saved: the original with that edit
     applied, word for word.

  If more than one exists and they differ, use the newest and say which you used. If none exists, test the original
  alone and say there was no change to compare. Never edit `features/recipe-coach.js` to run a test, and never
  save the person's change for them.
- **The context block** (`---`, `Candidate profile:`, `Job posting:`), built the same way, from the desk's copy.
- **The candidate's background**: a file about the made-up person that the interviewer never sees. For the app's own
  Amira that is `docs/inputs/example-person.md`; the project's instructions may name a fuller one. Use the one named,
  and nothing else about her.
- **A cap**: 16 messages in all, so it ends even if something goes wrong.

## Each turn is a fresh helper agent

A helper agent keeps no memory, so every turn gets everything it needs and nothing it should not have. Start a new
helper agent for each message, with no inherited conversation, and tell it: "Text only. Use no tools, files,
research or other agents. Reply with your next message and nothing else."

- **Interviewer helper** gets: the instructions, the context block, and the conversation so far (labelled as data).
  It never gets the candidate's background, the person's request, or any commentary.
- **Candidate helper** gets: its background file's text, the job posting, and the conversation so far. It plays her:
  short, natural, in her own voice; it may make up stories and details that fit her; it may say "skip" or "pass" once,
  on the second question, to see how the interviewer handles it. It never gets the recipe or the instructions.

Start with the interviewer, who opens. Then alternate: pass the interviewer's message to a candidate helper, and the
candidate's reply to an interviewer helper. Copy each message exactly into the transcript, unchanged and unimproved.
Every few turns, say in one line how far along it is.

## When to stop

When the interviewer has given its feedback and offered a retry, or at the cap. Say which. A cap is not a finish.

## Then

Show the transcript, then judge it the way `review-interview` does: against the instructions, quoting turns, telling
the interviewer's mistakes from what the candidate said or skipped. When there are two runs (the recipe and the
change), put the same moments side by side: the first question, the skip, the switch to feedback. Say what differs and
what you cannot tell from two runs. Offer to save the transcript to a file the person names; do not save it unasked.

Say plainly what this was: AI roles on one model, text only, no web search, not a person. It shows whether the recipe
holds together. It does not show how it feels to be interviewed.
