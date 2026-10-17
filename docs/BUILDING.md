# Building a feature

This page is for anyone who wants to add a part to Search Desk, or change one. You do not need to know how to code.
You need a free AI chat or an AI agent, and a computer.

Building is a computer job. A feature is one file. You save it in a folder, then reload the page. A phone is not
the place for this.

## Pick a feature

Each idea has a short brief in `docs/features/`. Pick one. Not sure? Ask your agent, and it will help you choose.

| Id | In plain words |
| --- | --- |
| `bigtext` | Larger text and stronger contrast, remembered on this device. |
| `board` | Jobs as columns by stage. |
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

The brief is `docs/features/<id>.md`. Have your own idea? That works too. Say it in one sentence.

## Path A: an agent in the folder

Use this if you have Claude Code, Codex or a similar agent that can read and save files.

1. Open the agent in the Search Desk folder.
2. Tell it what you want. In Claude Code, the `add-feature` skill starts by itself. With other agents, say:
   "Read AGENTS.md, then help me add a feature."
3. If you do not know what to build, say so. It will ask you one question, then offer ideas one at a time.
4. The agent writes the file, adds it to `features/list.js`, and runs the checks. It tells you what passed.
5. Reload the page and open `#selftest`. That is the final check.

## Path B: a free chat with a kit

Use this if you only have a free chat in your browser.

A kit is one text file with everything the chat needs: the rules, an example and the brief. The kits are already in
the folder at `docs/kits/<id>.txt`. (They are made by `uv run tools/kit.py`. You do not need to run it.)

1. Open `docs/kits/<id>.txt` for the feature you picked, for example `docs/kits/bigtext.txt`.
2. Copy all of it. Use select all, then copy.
3. Paste it into a new chat and send it.
4. The chat gives back one file. Copy that file.
5. Save it as `features/<id>.js`, for example `features/bigtext.js`. Use lowercase. Save plain text, not a
   word-processor file.
6. Open `features/list.js`. Find the line that starts with `Desk.features = [`. Add the id to the end of the list,
   inside the brackets, in quotes, with a comma before it:
   `..., 'recipe-custom', 'bigtext'];`
   If the id is also in the `Desk.planned` list below it, delete that one line.
7. Reload Search Desk in the browser.
8. Open `#selftest` (add `#selftest` to the end of the address). It runs a check on every part.
9. If it shows a problem, copy the problem text. Paste it into the same chat and write: "Fix this. Reply with the
   whole file again." Save the new file over the old one and reload. Repeat until it passes.

### If the chat adds extra words or several files

The file must be only code. If there are words around it, copy only the code inside the box. If the chat gives
several files, say: "Give me one file only. Put everything in `features/<id>.js`." Do not make other files.

## Changing a feature that exists

1. Open the kit for it, or start a chat with the rules.
2. Paste the current file too (for example `features/jobs.js`).
3. Say what you want in one plain sentence: "Make the date shown as day and month."
4. Say: "Reply with the whole file again, nothing else."
5. Save over the old file, reload, and open `#selftest`.

Keep a copy of the old file first. If the new one breaks, put the old one back.

## What can go wrong

- The page looks the same. You did not reload, or the id is not in `features/list.js`.
- `#selftest` says "This part is not built yet." The file name does not match the id, or it is not saved in
  `features/`. Names are lowercase.
- The file is cut off at the end. The chat ran out of room. Ask: "Continue" and join the parts, or ask for the
  whole file again.
- A word-processor added curly quotes. Use a plain text editor.
- The chat used a banned word (such as `innerHTML` or `fetch`). `#selftest` shows which one. Paste the problem back.
- Two features have the same id. The second replaces the first. Pick a new id.
- Something breaks that you cannot fix. Take the id out of `features/list.js` and reload. The rest of the app works.

## For agents and developers

The rules are in [`AGENTS.md`](../AGENTS.md) and [`CONTRACT.md`](CONTRACT.md). Checks:
`node checks/run.js <id>` and `node --test tests/unit/*.test.js`.
