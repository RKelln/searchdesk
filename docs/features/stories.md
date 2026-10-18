# My examples  (id: stories, size: M)
In plain words: Short stories from your work, ready for interview questions; the coach recipe can include them.
Why someone wants it: Interviewers ask for examples ("Tell me about a time..."). It is much easier to answer when you
wrote a few down in advance.

Done when:
- [ ] An agent in the folder adds `checks/stories.check.js`, and `node checks/run.js stories` passes.
- [ ] A "My examples" item is in the menu. It lists the stories, newest first, with a title and the first line.
- [ ] You can add, edit and delete a story. A title and some text are needed. Delete can be undone with the toast's Undo.
- [ ] The form shows a small guide: "What was going on? What did you do? What happened?" (three plain prompts, as
      help text above the box).
- [ ] Text is limited to 800 characters, with a count shown. Over the limit is refused with a plain sentence.
- [ ] A warning line reminds the person: "If you share this with an AI, it goes with your question." and that names of
      other people should be left out.
- [ ] With `recipe-coach` loaded, stories are included in the practice question automatically. This already works:
      `features/recipe-coach.js` reads `ctx.store.all('story')` and uses each record's `text`. Check that a story you
      add shows up in the coach question's "Candidate profile" (look at the question's preview on the AI screen).

Data: owns `story` = `{title, text}`. The coach reads `text` (it also accepts `story`, `body`, `what`; write `text`).
Record types: `story`.
Slots: `tab`   Soft uses: `recipe-coach` reads the `story` type by itself; this feature does not call it and does not
need `ctx.has('recipe-coach')`.
ctx calls: `ctx.slot('tab', ...)`, `ctx.store.all('story')`, `put`, `remove`, `batch`, `ctx.ui.toast`, `ctx.t`, `ctx.h`.

Checks to write (in `logic`):
- `cleanStory({title, text})` trims, needs both (`needTitle`, `needText`), and refuses text over 800 characters
  (`tooLong`); the problem is a key in `strings`.
- `sortStories(list)` newest first, by `updated`, then by title; does not change its input.
- `firstLine(text)` gives the first line cut at 80 characters with `...` if cut.

Test hooks: put these `data-test` names on: `stories-add`, `stories-form`, `stories-title`, `stories-text`,
`stories-guide` (the three prompts), `stories-count` (the 800 count), `stories-problem`, `stories-save`,
`stories-cancel`, `stories-warn` (the line about sharing) and `stories-empty`; one row per story is `story-row`
with `data-id`, and its buttons are `story-edit` and `story-delete`. The menu link is `nav-stories` (core makes
it). The recipe-coach line above needs no new name: the question's preview is the existing `ai-preview-text`. Add
any new ones to `tests/e2e/README.md`.

Out of scope: writing the story for the person; tags; a story picker per job.
Ideas for after: a tag for the kind of question each story fits (teamwork, a mistake); show only the stories that
fit the job; a `print` section.
