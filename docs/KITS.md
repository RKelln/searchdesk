# Building a feature with a free chat

This page is for building a Search Desk feature with **no agent installed** — a browser chat and a text editor,
nothing else — **from a feature that is already written up**. If you have a coding agent that reads and saves files,
do not use this page; [`BUILDING.md`](BUILDING.md) is shorter and better, and it covers your own ideas as well as
these.

If your idea is not on the list below, go to [`BUILDING.md`](BUILDING.md). This page assumes somebody has already
done the thinking: there is a brief, and all that is left is turning it into a file.

Building this way is copy and paste. A **kit** is one text file holding everything the chat needs: the rules, an
example feature, and the brief for the one you picked. The chat reads it and gives you back one file, which you
save into the folder. Nothing is installed and no account is needed beyond the chat itself.

The kits are already in this repo at `docs/kits/<id>.txt`, one per feature, all written from
`docs/features/<id>.md`. Do not edit a kit by hand: `python3 tools/kit.py` writes them again, and
`python3 tools/kit.py --check` says if one is out of date.

## What these features are

They are not exercises, and nothing here is a toy.

Every feature on this list is real work the project wants and has not built yet. The app knows: open the **Data**
tab and the same list is there under "Ideas you could build", each one with its own brief. Building one means
writing a file that does a real thing for a real person looking for work — the pay beside the target, the jobs as
columns by stage, the date a reply was due.

**Some of them will be in Search Desk in a later version.** That is the ordinary way this project grows: a feature
gets written from its brief, lands in a release, and its brief moves to `docs/built/` and drops off this page. The
page shrinking over time is the sign it is working, not a sign it is unfinished. `board` already went that way —
it was its own feature, then became a choice inside Jobs.

So you are doing the project's real work, in the project's real rules, one file at a time. If you take one home it
still works; nothing here is a demonstration that gets deleted afterwards.

**And the round trip is the point.** A brief in plain words, an AI writing a whole file from it, rules it has to
follow, and a self-test that says whether it did — that is what building with AI looks like, and this route does it
with nothing but a browser chat and a text editor. No install, no account beyond the chat, no terminal. It is the
same brief and the same contract an agent in the folder gets, minus the agent, which is why the result is worth
having.

One thing to know if you take a feature away with you: if the project later ships its own version of the same idea,
you will have two files with the same id. Rename yours — an id is yours to choose, and `features/<id>.js` has to
match `checks/<id>.check.js`. Both then work side by side.

## Pick a feature

Each idea has a short brief in `docs/features/`, and each has a kit. Pick one:

| Id | In plain words |
| --- | --- |
| `bigtext` | Larger text and stronger contrast, remembered on this device. |
| `calendar` | Put an interview or a starred event into your phone's calendar. |
| `checklist` | What a posting must tell you in Ontario, and whether this one does. |
| `contacts` | A short note about people you met, linked to an event or a job. |
| `pay` | The pay each posting gives, beside the pay you are aiming for. |
| `print` | A page you can print or save as a PDF: this week's jobs, dates and events. |
| `recipe-followup` | Drafts a short follow-up or thank-you note for a job. You copy it yourself. |
| `recipe-sites` | Suggests job sites and organisations for your kind of work, as suggestions. |
| `recipe-weekly` | Sends your open jobs and suggests the next step for each, as suggestions. |
| `reply-clock` | After an interview, shows the date the employer should have told you the result by. |
| `resumes` | Which version of your resume you sent where. |
| `sites` | Keep the job sites you use in one place, with a note about each. |
| `stories` | Short stories from your work, ready for interview questions. |
| `week` | How many you applied to, followed up and went to this week. No streaks and no scores. |

Not sure? Open `docs/kits/index.html` in a browser for the same list with a **Copy this kit** button on each one.
It works from a file with no server and no internet. The page needs nothing installed either.

Want something that is not on that list? Write the brief first — see below.

## Build it

1. Open `docs/kits/<id>.txt` for the feature you picked, for example `docs/kits/bigtext.txt`.
2. Copy all of it. Use select all, then copy.
3. Paste it into a new chat and send it.
4. The chat gives back one file, inside a box. **Copy the code inside the box, not the box marks.** If you copy the
   three backticks as well, the file will not load, and the menu will show a stub instead of the feature.
5. Save it as `features/<id>.js`, for example `features/bigtext.js`. Use lowercase. Save plain text, not a
   word-processor file.
6. Open `features/list.js`. Find the line that starts with `Desk.features = [`. Add the id to the end of the list,
   inside the brackets, in quotes, with a comma before it:
   `..., 'recipe-custom', 'bigtext'];`
   Leave the id in the `Desk.planned` list below it **for now**. That list is what gives a feature that will not load
   its name and its one-line description; delete the line once the self-test is clean (step 9).
7. Reload Search Desk in the browser.
8. Open `#selftest` (add `#selftest` to the end of the address). It checks every part for the rules it has to follow.
   A part built this way has no check file, so its row says "No check file". **That is not a problem**, and it is not
   red: nothing red means the file follows the contract.
9. Now use the feature and see that it does what the brief said. This is the check you have without Node. When it
   works, open `features/list.js` again and delete the line for this id from `Desk.planned`, so it stops appearing
   under "Ideas you could build" on the Data screen.
10. If `#selftest` shows a problem, copy the problem text. Paste it into the same chat and write: "Fix this. Reply with
    the whole file again." Save the new file over the old one and reload. Repeat until it passes.

A feature built this way has no check file, because a kit asks for one file and only one. `#selftest` tells you the
file follows the rules; it does not test the logic. Step 9 is the test the logic gets, and it is the check you have
without Node. If you ever install Node, `node checks/run.js <id>` with a written check is stronger.

## Changing a feature that exists

1. Open the kit for it.
2. Paste the current file too, for example `features/jobs.js`.
3. Say what you want in one plain sentence: "Make the date shown as day and month."
4. Say: "Reply with the whole file again, nothing else."
5. Save over the old file, reload, and open `#selftest`.

Keep a copy of the old file first. If the new one breaks, put the old one back.

## A feature of your own

Nothing on the list is special. Any of it gets built the same way: a brief, then a feature file.

Pick the **id** first. It is lowercase, with dashes, and short, because it becomes a file name: `recruiter`, not
`track-which-recruiter-called`. The same id is used for `features/<id>.js` and `docs/kits/<id>.txt`.

1. **Write the brief.** A brief is a plain text file in `docs/features/`. Nobody makes it but you and the chat.
   Say what you want in plain words and answer the two or three questions it asks you. Then open
   `docs/features/week.md`, copy all of it, paste that into the same chat, and say: "This is the shape of a brief.
   Write the brief for what I described, for the id `recruiter`. Reply with the brief only, as one text file. Do not
   write any code." Copy the reply and save it as `docs/features/<id>.md`. Check it: it must start with `# ` and have
   no JavaScript in it. If the chat gave you a `.js` file instead, it built the feature rather than writing the brief.
   Say "I wanted the brief, in words, not code. Reply with the brief only."
2. **Make the kit.** `python3 tools/kit.py` writes `docs/kits/<id>.txt` for it, exactly as it does for ours. Path B
   above needs that file. No Python? A kit is only three files in order: `docs/CONTRACT.md`, then
   `docs/example-feature.js`, then your brief. Copy all three into one message.
3. **Carry on.** Go to step 1 above, and start at the one that saves the file.

## What can go wrong

- The page looks the same. You did not reload, or the id is not in `features/list.js`.
- `#selftest` says "This part is not built yet." The file name does not match the id, or it is not saved in
  `features/`. Names are lowercase.
- The file is cut off at the end. The chat ran out of room. Ask: "Continue" and join the parts, or ask for the whole
  file again.
- A word-processor added curly quotes. Use a plain text editor.
- The chat used a banned word (such as `innerHTML` or `fetch`). `#selftest` shows which one. Paste the problem back.
- The chat added words around the code, or gave you several files. Say: "Give me one file only. Put everything in
  `features/<id>.js`." Copy only the code inside the box.
- Two features have the same id. The second replaces the first. Pick a new id.
- Something breaks that you cannot fix. Take the id out of `features/list.js` and reload. The rest of the app works.

## For agents and developers

`BUILDING.md` is the route with an agent, and it is shorter. The rules are in [`AGENTS.md`](../AGENTS.md) and
[`CONTRACT.md`](CONTRACT.md). `tools/kit.py` writes the kits and checks them; `docs/kits/index.html` is generated
by the same tool, so neither goes stale on its own.