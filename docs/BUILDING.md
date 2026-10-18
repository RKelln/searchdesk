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

The brief is `docs/features/<id>.md`. Want one that is not on that list? See "Your own idea" below.

## Your own idea

Nothing on that list is special. You can ask for anything the app is able to do, and it gets built the same way: a
brief, then a feature file.

Pick the **id** first. It is lowercase, with dashes, and short, because it becomes a file name: `recruiter`, not
`track-which-recruiter-called`. The same id is used for `features/<id>.js`, `checks/<id>.check.js` and
`docs/kits/<id>.txt`.

**With an agent (Path A), just ask.** Say: "I want to add a feature that is not in the list. I want <what you want>.
The id is `<id>`." It writes the brief, builds the file, runs the checks, and writes your kit. You end up with a brief
and a feature that someone with no agent can build from later, which is the point of writing the brief down.

**With no agent (Path B), do it by hand.** It is more work, and it is the only way on a computer that has no agent on
it — some workshop computers have no Python, Node or git.

1. **Write the brief.** A brief is a plain text file in `docs/features/`. Nobody makes it but you and an AI you ask.
   In a free AI chat, say what you want in plain words and answer the two or three questions it asks you. Then open
   `docs/features/week.md`, copy all of it, paste that into the same chat, and say: "This is the shape of a brief.
   Write the brief for what I described, for the id `recruiter`. Reply with the brief only, as one text file. Do not
   write any code." Copy the reply and save it as `docs/features/<id>.md`. Check it: it must start with `# ` and have no
   JavaScript in it. If the chat gave you a `.js` file instead, it built the feature rather than writing the brief. Say
   "I wanted the brief, in words, not code. Reply with the brief only."
2. **Make the kit.** `uv run tools/kit.py` (or `python3 tools/kit.py`) writes `docs/kits/<id>.txt` for it, exactly as
   it does for ours. Path B needs that file. No Python? A kit is only three files in order: `docs/CONTRACT.md`, then
   `docs/example-feature.js`, then your brief. Copy all three into one message.
3. **Carry on.** You now have exactly what every other feature has. Go to Path B above and start at the step that saves
   the file.

## Path A: an agent in the folder

Use this if you have OpenCode, Claude Code, Codex or a similar agent that can read and save files. It does not have to
be a paid one: see "Free ways to get help from AI" below.

1. Open the agent in the Search Desk folder.
2. Tell it what you want. In OpenCode or Claude Code the `add-feature` skill starts by itself. With other agents, say:
   "Read AGENTS.md, then help me add a feature."
3. If you do not know what to build, say so. It will ask you one question, then offer ideas one at a time.
4. The agent writes the file, adds it to `features/list.js`, and runs the checks. It tells you what passed.
5. Reload the page and open `#selftest`. That is the final check.

In OpenCode or Claude Code you can type these instead of asking in words:

| Type | What it does |
| --- | --- |
| `/new-feature` and what you want | The same as the skill. |
| `/check` and a feature id | Runs that one feature's check. |
| `/everything` | Runs every check in the repo. |
| `/kit` | Rebuilds the free-chat kits. |
| `/screens` | Pictures of every screen, for design work. |

They work in both because each one is written once, in `tools/commands/`, and copied into each tool's own folder.

### Which tools get them

| Tool | Where to type a command | `add-feature` skill |
| --- | --- | --- |
| OpenCode | `/check` | `@add-feature`, or just ask |
| Claude Code | `/check` | `/add-feature` |
| Pi | `/check` | `/skill:add-feature` |
| Codex | `$check` (no commands left; Codex retired its own) | `$add-feature` |
| Antigravity | `/check` (its workflow files stop working on 19 October 2026) | `/add-feature` |

Codex and Antigravity get the commands as skills instead of commands, because each has dropped or is about to drop its
own command files. Every tool reads the same two folders in this repo: `.agents/skills/` and `AGENTS.md`.

## Path B: a free chat with a kit

Use this if you only have a free chat in your browser.

A kit is one text file with everything the chat needs: the rules, an example and the brief. The kits are already in
the folder at `docs/kits/<id>.txt`. (They are made by `uv run tools/kit.py`. You do not need to run it.)

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

### If the chat adds extra words or several files

The file must be only code. If there are words around it, copy only the code inside the box. If the chat gives
several files, say: "Give me one file only. Put everything in `features/<id>.js`." Do not make other files.

## Free ways to get help from AI

Path A does not have to cost money. All of these are free:

| Way | What you do | Good to know |
| --- | --- | --- |
| A free model in OpenCode | Run `/connect` once, then `/models`, and pick a model marked Free. Most are named with `-free` at the end. | It reads and saves files, so it can build a whole feature. |
| GitHub Copilot Free | Run `/connect`, choose Copilot, and sign in with GitHub. | Easiest if you already have a GitHub account. |
| A model on your own computer | Install [Ollama](https://ollama.com), run `ollama pull qwen3:8b`, and leave OpenCode open. | No account, no cost, and it works with no internet. Needs a computer with memory to spare. |
| A free chat in your browser | Path B above, with a kit from `docs/kits/`. | Nothing to install. You copy and paste. |

Two things to know about free models:

- **They miss more than paid ones.** The rules in `AGENTS.md`, under "For a small or free model", are written for them.
  Keep the feature small, and believe the checks instead of your own eyes.
- **Some of them keep what you send them.** [The list of free models](https://opencode.ai/v2/docs/console/models/)
  says which ones keep nothing and which ones may use your words to improve the model. Look before you send anything
  real: a backup file holds a person's name, their jobs and their notes.

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
