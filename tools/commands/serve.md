---
description: Serve the page so it reloads itself when a file changes
argument-hint: [--rebuild or --workshop, only when its condition is true]
---

Serve the page so that saving a file reloads it.

1. From the project folder, run `python3 tools/serve.py`, or `uv run tools/serve.py` if `uv` is installed; the
   script is standard library only, so the two are the same. Run it in the background if your tool can, and tell
   me the address it prints, usually `http://127.0.0.1:8000/`. If it cannot run in the background, give me the
   command and stop there. Stop it with Ctrl-C.
2. Open that address in the browser. If the page is not open yet, say so.
3. From then on the loop is: change **one** file in `features/`, say which file you changed, and the page
   reloads itself in about a second. There is no build step and nothing to run. If a text box has focus and words
   in it, the page waits and shows a bar instead of throwing the words away; click it when the person is ready.
4. To move the open tab to a screen, write its id into `.dev-go` in this folder: `echo jobs > .dev-go`. The tab
   goes there once and the server takes the note out of the file. Use the id from `features/list.js`, with no
   `#`. A name that is not a screen falls back to Home.
5. Check the work: `bash checks/check.sh <id>` for the feature, and `node --test tests/unit/*.test.js` from the
   project folder for everything else. `#selftest` in the browser runs the checks in the page, and it is worth
   having the person run it themselves.

Two flags, each only when its condition is true:

- `--rebuild` keeps `dist/workshop/searchdesk.html` current as you work: one file, no server, that opens anywhere.
  It is a snapshot, not the take-home; the take-home is the folder. Nothing else uses it.
- `--workshop` marks the page as a practice copy with the made-up person. Do not pass it when `data/workshop.js`
  exists in this folder: that file already sets the same thing, and two ways to say it is how a reader ends up
  unsure which one won.

If something breaks on the page, the page says what. Fix the feature file, not the check file; the rest of the
app keeps working while one feature is broken.

In a workshop copy, that copy's own brief also applies.

If I asked for something else ({{all}}), follow `AGENTS.md`.
