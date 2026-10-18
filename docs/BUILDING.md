# Building a feature

This page is for anyone who wants to add a part to Search Desk, or change one, **with a coding agent**. You do not
need to know how to code. You need an agent that can read and save files, and a computer.

No agent installed? There is a copy-and-paste route in [`KITS.md`](KITS.md) that needs nothing but a browser chat.
It is the same result and more work.

Building is a computer job. A feature is one file. You save it in a folder, then reload the page. A phone is not
the place for this.

## Pick a feature

Each idea has a short brief in `docs/features/`. Pick one. Not sure? Ask your agent, and it will help you choose.

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

The brief is `docs/features/<id>.md`. Want one that is not on that list? See "Your own idea" below. A brief is the
record of what to build, so it is written down whether you use an agent or not — that is what lets the same feature
be built again later by someone else, or by a chat with no agent at all.

## Your own idea

Nothing on that list is special. You can ask for anything the app is able to do, and it gets built the same way:
a brief, then a feature file.

Pick the **id** first. It is lowercase, with dashes, and short, because it becomes a file name: `recruiter`, not
`track-which-recruiter-called`. The same id is used for `features/<id>.js` and `checks/<id>.check.js`.

Just ask. Say: "I want to add a feature that is not in the list. I want <what you want>. The id is `<id>`." It asks
two or three short questions, writes the brief, builds the file, runs the checks, and tells you what passed. Do not
ask it to write the feature from one vague sentence; the brief is what makes the result match what you wanted.

## Build it

1. Open your agent in the Search Desk folder.
2. Tell it what you want. Most find the instructions on their own, because `AGENTS.md` is in the folder. If it
   does not, say: "Read AGENTS.md, then help me add a feature."
3. If you do not know what to build, say so. It will ask you one question, then offer ideas one at a time.
4. The agent writes the file, adds it to `features/list.js`, and runs the checks. It tells you what passed.
5. Reload the page and open `#selftest`. That is the final check.

**Your agent's own way of invoking it.** Every coding agent has one, and they all differ — a slash command, a
mention, a `$name`, a skill you type by hand. Rather than guess, look for what your tool calls a command or a
skill and use that name. This repo ships them under names, not syntax:

| Ask the agent to | It does |
| --- | --- |
| add a feature | The same as the `add-feature` skill: brief, build, check, tell you what passed. |
| check a feature | That one feature's check. Give it the id. |
| run every check | Every check in the repo. |
| rebuild the kits | The free-chat kits in `docs/kits/`. |
| take pictures of the screens | Every screen, for design work. |

Each one is written once, in `tools/commands/` and `tools/skills/`, and copied into the folders your tool reads
them from. So the wording you type is yours to discover; what the instruction says is the same for everyone. In
OpenCode, for instance, `/check` and `/new-feature` are the same two rows above. `AGENTS.md` names where the copies
go if you want to look, and `python3 tools/agent-files.py --check` says if any copy is out of date.

## Free ways to get help from AI

This does not have to cost money. What matters is not which agent you use but which **model** is answering: an
agent is the program that reads and writes your files, and the model is what thinks. Every agent can call a
provider, and most can be pointed at a different one.

| Way | What you do | Good to know |
| --- | --- | --- |
| A free model in OpenCode | Run `/connect` once, then `/models`, and pick a model marked Free. Most are named with `-free` at the end. | It reads and saves files, so it can build a whole feature. This is the row worth starting from: free models are the exception, and OpenCode is where you get one without an account. |
| A free provider with an account | Sign in to a provider you already have an account for, and point your agent at it. | Easiest if you already have an account. Check that the free tier includes a model an agent can call — a browser chat and an API key are not always the same thing. |
| A model on your own computer | Install [Ollama](https://ollama.com), run `ollama pull qwen3:8b`, and point your agent at it. | No account, no cost, and it works with no internet. Needs a computer with memory to spare. |
| No agent at all | [`KITS.md`](KITS.md): copy a kit into a browser chat. | Nothing to install. The one route that always works, which is why the kits exist. |

If you do not have an agent, [OpenCode](https://opencode.ai) is the one to start with, and the reason is the free
models rather than the program: it can call a provider that costs nothing, and most of the free models above are
reachable only through an agent like it. Anything else that reads and writes files will do.

Two things to know about free models, whatever agent is running them:

- **They miss more than paid ones.** The rules in `AGENTS.md`, under "For a small or free model", are written for them.
  Keep the feature small, and believe the checks instead of your own eyes.
- **Some of them keep what you send them.** Each provider's terms say whether your words are used to improve the
  model, and whether they are kept at all. OpenCode publishes which is which at
  [opencode.ai/v2/docs/console/models](https://opencode.ai/v2/docs/console/models/), and other providers say the
  same in their own terms. Look before you send anything real: a backup file holds a person's name, their jobs and
  their notes.

## Changing a feature that exists

1. Start a chat with the agent in the folder.
2. Say what you want in one plain sentence: "Make the date shown as day and month." It reads the current file
   first, so it does not need you to paste it.
3. Ask it to rerun that feature's check, and then every check.
4. Reload the page and open `#selftest`.

If the new version breaks something, say so and ask for the old one back, or use git: the repo keeps every version,
so `git diff` shows what changed and `git checkout -- features/<id>.js` puts it back.

## What can go wrong

- The page looks the same. You did not reload, or the id is not in `features/list.js`.
- `#selftest` says "This part is not built yet." The file name does not match the id, or it is not saved in
  `features/`. Names are lowercase.
- A check fails. The agent should fix the feature file, not the check. Say "do not change the check to make it pass"
  if it tries.
- Something breaks that you cannot fix. Take the id out of `features/list.js` and reload. The rest of the app works.
- The agent says it passed something it did not run. Ask for the command and its output.

## For agents and developers

The rules are in [`AGENTS.md`](../AGENTS.md) and [`CONTRACT.md`](CONTRACT.md). Checks:
`node checks/run.js <id>` and `node --test tests/unit/*.test.js`. The free-chat route, its kits, and writing a
brief by hand are in [`KITS.md`](KITS.md).