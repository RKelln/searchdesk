---
name: add-feature
description: Use when someone wants to add or change a Search Desk feature, or has no idea what to build.
---

# Add or change a Search Desk feature

This is a thin wrapper. The rules live in the docs; read them, do not copy them.

1. Read `AGENTS.md` and `docs/CONTRACT.md`. Read `docs/BUILDING.md` if the person asks how this works.
2. Find out what to build.
   - If they know, find its brief in `docs/features/<id>.md` (if there is one) and read it.
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

Keep your replies short and in plain words (about grade 6).
