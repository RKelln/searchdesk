# AGENTS.md

Search Desk is a job-search helper that runs in a web browser from plain files: no install, no server, no
dependencies. It keeps a person's jobs, dates, events and free help in one place, and optionally helps them use a free
AI chat by copy and paste.

This file is the brief for the **source repo on a development machine**: git, Node, `python3`, and the tools in
`tools/`. A workshop copy is a folder cut from a tag, and it carries its own brief (`AGENTS.md` and `BUILDING.md`
in that folder); there, that brief wins on what to run, on what may be touched, and on anything about the session.
What never changes is how a feature file is written: that is the contract, in every shape.

Features are single files that follow one contract. Most people who open this repo with an agent want to add or change
a feature, so read the contract first: [`docs/CONTRACT.md`](docs/CONTRACT.md). The full design is in `docs/DESIGN.md`
and the task list is in `docs/PLAN.md`.

## Principles

When two conflict, the earlier one wins.

1. **Useful with no AI.** The tracker, events and help page work on their own. AI is optional and service-agnostic.
2. **The free chat route is the main path.** Most users copy a question into a free chat and paste the answer back.
   One tap to copy, one paste to bring it back, and nothing else unless something went wrong.
3. **AI suggests; the person decides.** Anything from AI arrives as a suggestion. Taking one is one tap; ignoring it
   costs nothing. The chat route never edits the person's own records.
4. **Your data is yours.** One tap exports everything as a readable file. It imports back by file or paste. A merge
   never loses newer data, and every bulk change can be undone.
5. **Plain words.** Interface text is at about grade 6, all in one string table, so it can be translated later.
6. **Small and readable.** No dependencies, no framework, no build step needed to run or extend it. Any feature file
   can be read in one sitting.
7. **Extensible by beginners.** Every feature is one file that follows one contract. A missing feature breaks nothing.
8. **Safe by construction.** Text from AI or a feed is shown as text, never run as HTML or code. The page talks to one
   network host, and the page itself enforces that.
9. **The process is the product.** Recipes (the instructions sent to AI) are plain text anyone can change.

## The contract

Read [`docs/CONTRACT.md`](docs/CONTRACT.md). It has the `ctx` API, the slots, `h()`, checks and a complete example
(`docs/example-feature.js`). The rules, word for word:

1. **Talk to the app only through `ctx`.** No globals of your own, no reaching into another feature's DOM, no calling
   another feature.
2. **Read anything; write only your own types and your own `ext`.**
3. **Never** use `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `fetch`,
   `XMLHttpRequest`, `import()`, `localStorage` or timers that run forever. The store and `net` do the storage and
   network work. The self-test scans every loaded feature's source for these words and fails the feature if it finds
   one.
4. **Pure logic goes in `logic`**, and `mount` only does the DOM work. Checks test `logic`.
5. **Plain-word strings** go in `strings`.
6. **Missing is fine.** Guard soft uses with `ctx.has('id')`. If a feature listed in `list.js` fails to load, the
   shell shows a stub with its `name` and `purpose` (taken from `Desk.planned` or the list) and the line "This part is
   not built yet." The rest of the app works normally.
7. **Registering is idempotent.** Registering the same id twice replaces the first and logs a warning.
8. **One file.** No other files except `checks/<id>.check.js` and `docs/features/<id>.md`. Its kit,
   `docs/kits/<id>.txt`, is the one exception: `uv run tools/kit.py` writes that from the brief. Never write a kit by
   hand.

For the person-facing steps: [`docs/BUILDING.md`](docs/BUILDING.md) for an idea of their own, and
[`docs/BRIEFS.md`](docs/BRIEFS.md) for one of the fourteen briefs already written up. Both need an agent that reads
and writes files. [`docs/KITS.md`](docs/KITS.md) is the same fourteen as paste packets for a browser chat, for a
machine that will not let anyone install one. The briefs in `docs/features/` are what an agent reads; the kits in
`docs/kits/` are the same text packed for a chat.

## Running tests and checks

- Unit tests (needs Node): `node --test tests/unit/*.test.js`. Node 22 rejects a folder, so keep the glob.
- Unit tests for the tools (Python): `python3 tests/unit/test_build.py` and `python3 tests/unit/test_serve.py`
  (`uv run` is the same thing; the tools are standard library only).
- Serving the page while somebody watches it change, which is what a workshop runs on:
  `python3 tools/serve.py --workshop --rebuild`, or `uv run tools/serve.py` where it is installed. Pass
  `--workshop` only when the folder has no `data/workshop.js`: a workshop copy carries that file, and then the
  flag says the same thing twice. It reloads the page when a file changes, and a screen named in `.dev-go` moves
  the open tab there. It never writes to the app's own files. `docs/WORKSHOP.md` is the run-through.
- Check one feature (Linux or anywhere with Node): `node checks/run.js <id>`. It loads `features/<id>.js` and
  `checks/<id>.check.js`. Try it on the example with `node checks/run.js example`. This exists now.
- Check one feature on a Mac without Node: `bash checks/check.sh <id>` (it runs through `osascript -l JavaScript`). This arrives with task T1.6; if
  `checks/check.sh` is not there yet, it is not built yet.
- Browser tests (development only: they need Playwright and its browsers, which a workshop copy does not have):
  `python3 tests/e2e/run.py`, or `uv run tests/e2e/run.py`.
- Screenshots for design work (development only: it drives Playwright): `python3 tools/screens.py` takes every
  screen on a phone and a computer,
  light and dark, writes `screens/index.html`, and flags sideways scroll, page errors and stray `null` text.
  Add `--sizes wide` for layout work: at 1280 a layout can look tidy and still waste half a real desktop.
- A feature does not have to write layout CSS. The layout kit in `docs/CONTRACT.md` gives a card grid (`cols`), a
  list beside a detail pane (`split`), and a dashboard (`dash`) from class names alone, and `ctx.wide()` tells a
  feature when the window is wide enough for them.
- The made-up person's records in the shape a saved copy has: `node tools/demo-export.js` (add `--ids` for one line per
  record). Use it instead of asking a real person for their data.
- In the browser, open the app and go to `#selftest`. It runs every loaded feature's check and the contract scan.
- **The suite survives a copy without the development tools.** `tools/`, `tests/e2e/`, `reference/` and this
  repo's own `docs/PLAN.md` and `docs/DESIGN.md` are for developing Search Desk, not for running it. A host who
  wants to give people the app — a library workshop copy, a folder on a USB stick — can leave them out, and the
  unit suite still passes: a check that reads one of them skips and says which file is not there. Skipped is not
  passed, and the skip count is reported, so a run that skipped half of itself is visible rather than quietly
  green. `gone()` and `noRepo()` in `tests/unit/_load.js` are the two helpers. Nothing app-level is skipped: the
  app is `core/`, `locale/`, `data/`, `features/`, `checks/` and `index.html`, and every check over those runs
  wherever the copy is.
- **These files are written once and copied, so nothing here names a tool.** The words you type to invoke a command
  live in `tools/commands/<name>.md` and the skills in `tools/skills/<name>.md`, and those are the only two places to
  edit them. `python3 tools/agent-files.py` copies each into the folders the supported agents read, so a person in
  any of them types that tool's own syntax for the same words: a slash command in some, a mention in others, a skill
  by hand in the rest. `tools/agent-files.py --check` says if a copy is stale, and `tests/unit/agent-files.test.js`
  fails when one is, so do not edit a copy by hand.
- Write instructions the way `AGENTS.md` and `docs/CONTRACT.md` are written: "read this file and do that", not "run
  `/add-feature` in your tool". A command name is portable; the syntax to reach it is not, and it is the one thing
  that changes between agents. Where a reader needs the syntax, it belongs in that tool's own docs, not here.

Run the checks before you say a feature is done, and tell the person what passed.

## For a small or free model

Most people who build this will be using a free model. These rules are for one that is not as sharp.

1. Read all of `AGENTS.md` and all of `docs/CONTRACT.md` before you write anything. Do not work from memory of them.
2. One feature, one file. Do not read another feature's file unless the contract says to.
3. Copy the shape of `docs/example-feature.js`, and keep its order: `id`, `types`, `strings`, `logic`, `mount`.
4. Run `node checks/run.js <id>` as soon as the file is written, and again after every change. It takes under a
   second and it is the truth. Never call a feature done because it looks right.
5. If a check fails, fix the feature file. Do not change the check file to make it pass, unless the brief says the
   behaviour itself changed.
6. Stay inside one document at a time. `docs/DESIGN.md`, `docs/PLAN.md` and `reference/` are large: read the part
   you need, not the whole file.
7. Say what you are about to do before a long run of tool calls, and name the files you changed at the end.
8. If the brief is thin, ask one short question instead of guessing. A feature that fails its check is easier to fix
   than one that nearly works.

## If the person has no idea what to build

Do not ask an open question. Ask one short thing about them first (what kind of work they look for, what is hard in
their search right now). Then look in `docs/features/`, where each planned feature has a short brief, and offer three
that fit what they said. Offer them one at a time: say what it does in one plain sentence, and ask "Do you want this
one?" Move to the next only if they say no. If `docs/features/` has no brief that fits, say so and ask what would
help them most this week.

## Working with someone's data

For an agent that can read and write files (the person's exported backup sits in the folder).

- **Reading the desk now:** with `python3 tools/serve.py --mirror` running, the page keeps `searchdesk-live.json` up to
  date by itself, and `python3 tools/read-desk.py` reads a part of it (`--type job`, `--id <id>`, `--find <word>`) so you
  never open the whole file. The `read-desk` skill has the steps. The mirror is off by default and local only, because
  it writes the desk's records to a file; it includes the made-up person, marked `source: "example"`. Do not answer from a browser view of your own: it keeps different records from the person's Chrome. Do not look in `~/Downloads`: a Mac stops to ask the person for permission.
- **Reading:** the person exports to `searchdesk-<date>.json` in the folder (`Desk.io.filename` names it, for example
  `searchdesk-2026-10-16.json`), and you read that. Whoever runs the model may keep what you send it: if the model does
  not say that it keeps nothing, act as if it does. Never paste a real backup, name, email or phone number into a chat
  in a browser. To see what a copy looks like without asking a real person for theirs, run
  `node tools/demo-export.js`. It prints the made-up person's records in the shape a copy has, and
  `node tools/demo-export.js --ids` prints each id with its `updated`.
- **Changing a record that is already here:** give it a NEW `updated`, the time you made the change. Never reuse the
  one you read. On equal dates the page keeps its own record, so a reused `updated` means your change quietly does
  nothing, and the person is told it was "kept". An `updated` more than a day in the future is left out entirely.
- **Writing:** write `data/inbox.js` containing `window.DESK_INBOX = { schema, records }`, with your records marked
  `source: "ai"`. On load the page merges the inbox as one batch ("Brought in 5 changes from your helper · Undo"). The
  merge is idempotent, so a reload does not duplicate anything. `schema` is `"searchdesk/1"` and `records` is a list
  of whole records (`id`, `type`, `updated`, and the fields). A record that is newer here is kept; on a tie, the
  record here stays. The page leaves out (and says how many) records of unknown types, `settings`, deletes, dates
  in the future and text that looks like HTML. It reads the file once: change the file to bring in more. Only the
  source copy reads it, not a built single file. See `docs/examples/inbox-demo.js`.
- Unlike the chat route, you can edit existing records. That is the person's choice, and undo covers it.
- In demos, stay synthetic: use the made-up person in `data/example.js`, never real names, emails or phone numbers.
- Never invent links. If you do not have the real address, leave the link empty.
- Always write `source: "ai"` on what you add, and keep `updated` honest (the real time you made the change).
- Never put a name, email or phone number in the profile. The profile has no field for them, on purpose.

## Portability

People use this on macOS as well as Linux. Keep scripts and file names safe for both.

- Scripts must be bash 3.2 and safe with BSD tools: `sed -i ''` (not `sed -i`), no `date -d`, no `timeout`,
  `shasum -a 256` (not `sha256sum`), no associative arrays, no `mapfile`, no `${var,,}`.
- Finder drops `.DS_Store` files into folders. Ignore them; never treat them as features or data.
- File names are case-insensitive: `Sites.js` and `sites.js` are the same file. Use lowercase names.

## Other rules

- No dependencies: no npm packages, no frameworks, no CDNs, no ES modules, no TypeScript. Classic scripts that attach
  to `window.Desk`. Python tools use only the standard library and run with `uv run`.
- Make anything that can be a pure function one, and write its unit test with it.
- Interface text is plain words, about grade 6, with short sentences.
- Change `core/`, `locale/` and `data/` only when the task needs it, and say so. Features and checks are the normal
  place for new work.
