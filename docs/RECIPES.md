# Recipes

A recipe is a task you can give to a free AI chat. Search Desk writes the question, you paste it into the chat, and you
paste the answer back. This page shows how a recipe is made, and how to make one better.

## The two halves

Every recipe has two halves. They are kept apart on purpose.

1. **The instructions.** Plain words with `{placeholders}` in curly brackets. This is what people change.
2. **The code.** It finds the facts the placeholders need, and turns the answer lines into suggestions. It changes
   rarely.

Search Desk does the rest. It makes the code (like `DESK-7Q3K`), numbers the items (`L1`, `C2`), adds the "HOW TO
ANSWER" part, reads the answer and saves it. The "HOW TO ANSWER" part is not in the instructions, so a change to the
instructions can never stop the page from reading the answer.

## Make a recipe with no code

Make a task of your own in the app. See "Your own tasks" below.

## Your own tasks

Open **AI helper** and press **Make your own task**. Or open a job and press **Make a task for this job**.

1. **Name** it, and write the **instructions**. Use these words in curly brackets. The page fills them in:
   - Always: `{profile}` (what you chose to share in About me), `{events}` (your starred events) and `{replyLanguage}`.
   - Only for a task that starts from a job: `{job}` (title, company, place, stage, what they ask for), `{title}`,
     `{org}`, `{where}`, `{asks}` and `{posting}` (cut at 4,000 characters). Your job notes are never sent.
2. A word that is not on the list, like `{notes}`, is shown as a warning and stays in the question as plain text. It is
   never filled in.
3. Choose **where it starts**: the AI screen, or a job. A job task opens from that job's page.
4. Choose **what happens to the answer**. **Nothing** means you read it in the chat. **Save it to the job's notes** (job
   tasks only) means you paste the answer back, open the job, and press **Add to notes**. It is added at the end of the
   notes under a line like `AI answer, 2026-10-18:`. Undo takes it back.
5. Your tasks go into your backup file with everything else.

**Share a task.** Open it and press **Copy this recipe**. It copies plain text like this:

```
[A task to share, from Search Desk]
Name: Thank-you note
Starts from: job
Answer: job-notes
Words used: {profile}, {job}

Instructions (between the lines):
-----
Write a short thank-you note for this interview.
{profile}
{job}
-----
```

A friend pastes that text into the paste box on the AI screen. The page shows what is in it. Nothing is added until they
press **Add it as my task**. It is only text, so a shared task cannot do more than a task you made by hand. Names are cut
at 60 characters, instructions over 3,000 are refused, and a paste over 6,000 is refused unread.

## Make a recipe with code

A recipe is one feature file, `features/recipe-<name>.js`, that calls `ctx.recipe({...})`. Read
[`CONTRACT.md`](CONTRACT.md) first. Put the instructions at the top of the file so they are the first thing anyone reads.

```js
ctx.recipe({
  id: 'events', title: 'Find events worth going to', blurb: 'Pick the events that fit you.',
  template: `Pick the events most likely to help this person.
About the person:
{profile}
Up to {quota} picks. A short list is better than a padded one.
{items}`,
  placeholders: { profile: 'what you chose to share', quota: 'how many to pick', items: 'the events list' },
  needs(ctx) { return ctx.profile().roles ? [] : ['Add the work you look for in About me.']; },
  data(ctx, opts) { return { quota: 4, items: { header: 'alias | date | title', kinds: { L: rows } } }; },
  answer: { L: ['why'] },
  example: 'L1 | why this one fits, in one sentence',
  apply(result, ctx) { /* return suggestions */ },
});
```

The top of `core/recipes.js` lists every field a recipe can have. These are the ones to know:

- `template` and `placeholders`: the instructions, and a plain description of each `{name}`. List every placeholder, so
  the editor can warn when one is gone.
- `answer` and `example`: the answer lines, and one sample line. `answer: null` means no answer is read back.
  `answer: 'text'` means the page takes the whole code block as text (the "improve" task uses this).
- `data`: fills the placeholders. `needs`: says what is missing, in plain words.
- `apply`: turns the accepted lines into suggestions. AI only suggests. The person decides.

Then add the id to `features/list.js` and write `checks/<id>.check.js`. The check should test that the template still
has its placeholders (`Desk.prompt.missingPlaceholders` and `absentPlaceholders`) and that the question fits its size.

## Change the instructions in the app

Open a task on the AI screen and choose **Change the instructions**.

- The box shows the words that are sent to the AI. Change them and press **Save**. The next question uses them.
- The list under the box shows each `{placeholder}` and whether it is in use. If you remove one, you see a warning
  such as "`{items}` is gone. Without it the AI will not get: the events list." It is a warning. It does not stop you.
- Free AI chats on the web, such as the free tier of ChatGPT, keep only about 1,500 characters of custom instructions. If your instructions are longer, you see a warning with the count (a trailing `{context}` block is not counted; the coach counts its instructions with the options filled in). It is a warning. It does not stop you. The same warning shows when you improve a recipe, make your own task, or add a shared one.
- **Back to the original** puts the first words back. The last 5 versions are kept under **Earlier versions**.
- Your change is saved with everything else, so it goes into your backup file and comes back when you import it.

## Improving a recipe

When an answer was not as good as it should be, change the instructions and try again. This is the whole loop.

1. **Write down what was off.** On the answer, press **Could be better** and type one sentence, for example "It
   picked events too far from Scarborough." The notes are listed under the task.
2. **Change one thing.** Do it by hand in **Change the instructions**. Or press **Improve these instructions with AI**.
   That copies a question with the current instructions, the words to keep, and your notes that are not used yet.
3. **Run the same question again.** Use the same profile and the same choices.
4. **Compare.** After an AI rewrite, the page shows the new words next to yours, with the changed lines marked.
   For a hand change, read the two answers.
5. **Keep the change or go back.** Press **Use this** to save the AI's version, or **Keep mine**. Nothing is saved
   until you press **Use this**. **Undo** and **Back to the original** are always there. The notes it used are marked
   "used".
6. **Put the reason in the commit message.** If you are a developer and the change belongs in the code, change
   the `template` in the feature file and write why, for example "recipe-events: name the distance, because picks were
   too far away."

Tips:

- Change one thing at a time. Then you know which change helped.
- Keep the placeholders. If the AI rewrite drops one, the page warns you.
- The improve answer is: the code line, then the new text in one code block, then one line, `What changed: ...`.
  The page reads the block as it is, so the new text can have blank lines and `{placeholders}`.

## For developers and agents

- Records: `recipe-edit` (`id` is `re_<recipe id>`; fields `recipe`, `text`, `why`, `versions`) and `recipe-note`
  (`recipe`, `code`, `text`, `used`). Core owns both (`core/recipe-edit.js`, `core/recipes.js`). A feature that
  needs the edited text asks the recipe `ctx`: `ctx.edited('<recipe id>')` gives the text, or `null` for the
  original. `recipe-coach` uses this for "Copy only the instructions".
- `Desk.prompt.build` takes the edited text as `opts.template`. The "HOW TO ANSWER" part is added after it.
- Pure helpers (the line diff, versions, notes) are on `Desk.recipeEdit`, with tests in
  `tests/unit/recipe-edit.test.js`. Run them with `node --test tests/unit/*.test.js`.
