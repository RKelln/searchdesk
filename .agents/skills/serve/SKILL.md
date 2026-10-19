---
name: serve
description: Serve the workshop page, where a person watches an agent change it
---

Set up the page for a workshop, where somebody is watching the screen while you change things.

1. Start the server: `uv run tools/serve.py --workshop --rebuild`. Run it in the background if your tool can;
   otherwise give me the command to run and the address it will print. Add `--rebuild` only when there should
   be a copy to take home at the end (`dist/workshop/searchdesk.html`, one file, no server needed).
2. Tell me the address, in plain words: `http://127.0.0.1:8000/`. If the page is not open yet, say so. Stop the
   server with Ctrl-C.
3. From then on, the loop is: change **one** file in `features/`, say what you changed, and the page reloads
   itself. There is no build step and nothing to run. Do not ask me to reload, and do not ask me to find the
   new screen.
4. To show me a screen, write its name into `.dev-go` in this folder, one word, for example `echo jobs > .dev-go`.
   The open tab goes there by itself, once, and the server takes the note out of the file. Use the id from
   `features/list.js` or `Desk.planned`, with no `#`. A name that is not a screen falls back to Home.
5. Run `node checks/run.js <id>` for the feature you changed, and tell me how many passed. `#selftest` in the
   browser is the check that is theirs, and I do not need to run it for them.
6. If something breaks on the page, the page says what. Fix the feature file, not the check file. The rest of
   the app keeps working while a feature is broken.

If I asked for something else (<all>), and it is not about a workshop, follow `AGENTS.md` instead.

While a workshop is running, keep to `features/`, `checks/` and `docs/features/`. Do not change `core/`,
`locale/` or `data/` unless the task needs it, and say so if it does. Never write real names, emails or phone
numbers anywhere: this is practice on a made-up person.
