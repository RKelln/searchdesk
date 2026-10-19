---
name: add-feature
description: Use when someone wants to add or change a Search Desk feature, or has no idea what to build.
---

# Add or change a Search Desk feature

This file is written once, in `tools/skills/`, and copied into whichever folder the agent you are running reads
skills from. Any agent that reads `AGENTS.md` can follow it too, with no copy at all.

This is a thin wrapper. The rules live in the docs; read them, do not copy them.

1. Read `AGENTS.md` and `docs/CONTRACT.md`. Read `docs/BUILDING.md` if the person asks how this works. If your model is
   small or free, also follow "For a small or free model" in `AGENTS.md`.
2. Find out what to build.
   - If they know, find its brief in `docs/features/<id>.md` and read it.
   - If they know and there is no brief, write the brief first, then build from it. The brief is
     `docs/features/<id>.md`, in the shape of an existing one (`docs/features/week.md`). Ask two or three short
     questions to pin down what they want; do not write it from one vague sentence. The id is lowercase with dashes
     and short, because it becomes `features/<id>.js`. If this copy has `tools/kit.py`, run `python3 tools/kit.py`
     after the feature passes, so `docs/kits/<id>.txt` exists for a browser chat on a machine where nothing can be
     installed. A copy without `tools/` has nothing to run it with, and there the kit is simply not made.
   - If they have no idea, follow "If the person has no idea what to build" in `AGENTS.md`. Ask one short question
     about them first. Then offer three briefs from `docs/features/` that fit, one at a time. Say what each does in
     one plain sentence, then ask "Do you want this one?". Move on only if they say no.
3. Build `features/<id>.js` (one file, the contract rules) and `checks/<id>.check.js`. Use `docs/example-feature.js`
   and `docs/example-feature.check.js` as the model. For a change, read the current file first.
4. Make the feature load: add its id to `Desk.features` in `features/list.js`. If it is also in `Desk.planned`, remove
   that line so it is not listed twice.
5. Run `node checks/run.js <id>` and `node --test tests/unit/*.test.js`. Fix what fails.
   No Node? Use `bash checks/check.sh <id>`.
6. Do not open the browser, take screenshots or change `core/`, `locale/` or `data/` unless the task needs it.
   If you do change them, say so.
7. Tell the person, in plain words:
   - what you built and which files you changed;
   - which commands passed (name them);
   - that the last check is theirs: open the app in the browser, reload, and go to `#selftest`.

**In a workshop**, where somebody is watching the screen while you work: the page is already being served, so
the loop is change one file in `features/` and say what you changed. There is no build step. The page reloads
itself. To show them a screen, write its name into `.dev-go` in the folder, one word and no `#` (the tab goes
there once, then the server takes the note out); do not ask them to reload, and do not ask them to find the new
screen. Keep to `features/`, `checks/` and `docs/features/` unless the task needs `core/`, and say so if it
does. Never write a real name, email or phone number anywhere.

Keep your replies short and in plain words (about grade 6).
