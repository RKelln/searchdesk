# Search Desk: work plan

> Written 2026-10-16 for implementing agents (Sonnet or similar) working one task at a time. Design: `DESIGN.md`
> (section numbers below are its). Priorities: **P0** = the first release, tag `2026.10.19`, cut by **Mon Oct 19,
> 2pm** (a workshop uses it that evening); **P1** = by Nov 16; **P2** = later. Anything specific to one workshop
> (installing on its machines, its brief) lives with that workshop, not here.

## How to work on this repo (read before any task)

1. Read `DESIGN.md` sections 2, 5, 6, 7 and the section your task cites. Read `AGENTS.md`. Do not start without them.
2. **One task per session.** Do only what the task lists; note anything else you find under "Found while working" at
   the bottom of this file.
3. **No dependencies.** No npm packages, no frameworks, no CDNs, no ES modules, no TypeScript. Classic scripts that
   attach to `window.Desk`. Python tools are stdlib only and run with `uv run`.
4. **Pure first.** Anything that can be a pure function is one, with a unit test in `tests/unit/` (`node --test`).
   Write the test with the code, not after.
5. **The contract applies to core too** where it can: no `innerHTML`, text through `h()`, strings in the string table.
6. **Interface text is plain words, about grade 6.** Short sentences. No jargon ("export" is fine; "JSON" is not shown
   to people except on the Data screen's details).
7. **Test before you say done:** `node --test tests/unit`, then `uv run tests/e2e/run.py` once e2e exists (T1.7).
   Paste the summary line into your report. If something cannot be tested on Linux, add it to DESIGN section 15 and
   say so.
8. **Mac pitfalls to keep in mind** (the first workshop runs on managed macOS 14 Macs in Chrome): no Python, Node
   or git on them; scripts must be bash 3.2 and BSD-tool safe (`sed -i ''`, no `date -d`, no `timeout`, `shasum -a 256`);
   Finder drops `.DS_Store` files into folders (ignore them); filenames are case-insensitive.
9. **Commit per task**, message `T<id>: <what>`, and tick the box here in the same commit.

## Timeline for P0

| When | Tasks |
|---|---|
| Fri Oct 16 evening | T0.1–T0.2, T1.1–T1.3 |
| Sat Oct 17 | T1.4–T1.7, T2.1–T2.4 |
| Sun Oct 18 | T2.5–T2.6, T3.1–T3.8, T4.1 |
| Sun night–Mon morning | T4.2–T4.5, fixes from the Mac test (V1–V4) and the chat-route trials (V5–V6) |
| Mon 2pm | tag `2026.10.19` |

If it slips, cut in this order: T4.2's service worker (the hosted copy still works), your own AI tasks (T3.8),
`recipe-posting` (T3.5), reference features beyond `sites` (T4.5). Live events is already P1. Do not cut the
fix-it message, the parser's tolerance, or "Change the instructions" (T3.7's editor and reset; the AI-improve step
can follow a day later if it must).

---

## Phase 0: scaffold

- [ ] **T0.1 Repo scaffold** (P0). Create the file tree in DESIGN 5 with empty or stub files: `index.html` loading the
  core files in order, `features/list.js` with the base ids, `LICENSE` (MIT), `README.md` stub, `.gitignore`
  (`dist/`, `__pycache__`, `.DS_Store`), `CLAUDE.md` containing `@AGENTS.md`, `tests/unit/` with a loader helper
  (`tests/unit/_load.js`: builds a fake `window`, runs the named core files in a `vm` context, and returns
  `window.Desk`).
  *Done when:* `node --test tests/unit` runs with one trivial passing test; `index.html` opens from `file://` with no
  console errors.
- [ ] **T0.2 CONTRACT.md and AGENTS.md** (P0). `docs/CONTRACT.md` is DESIGN 7 made standalone, with one complete
  example feature. `AGENTS.md` covers: what the repo is (2 lines), the principles (DESIGN 2), the contract (a link
  to it, plus the rules in 7.5 verbatim), how to run tests and checks, "If the person has no idea what to build"
  (offer three from `docs/features/` that fit what they said, one at a time), "Working with someone's data" (DESIGN
  10), and the Mac pitfalls.
  *Done when:* both files exist, and CONTRACT's example feature passes `node checks/run.js example` (add the example
  as `docs/example-feature.js` plus its check, loaded by path).

## Phase 1: core

- [ ] **T1.1 `h.js` and `strings.js`** (P0, DESIGN 7.4, 13). `h(tag, attrs, ...children)` with the link rules;
  `Desk.strings` plus `t(key, vars)` with `{var}` substitution and a fallback that shows the key; date formatting
  helpers (`fmtDate`, `fmtTime`, relative "in 3 days" / "2 days late").
  *Done when:* unit tests cover text-only children, `javascript:` href dropped, `rel`/`target` set, string fallback,
  and the date formats.
- [ ] **T1.2 `store.js` and `persist.js`** (P0, DESIGN 6). Records map; `all/get/put/remove/ext/batch/undo/subscribe`;
  ids from `crypto.getRandomValues` (base32, type prefix); `updated` set on writes; ownership enforced (a feature's
  `ctx.store` refuses writes to types it does not own and throws a plain error); persistence under `searchdesk1:state`
  with try/catch and debounce. If storage is blocked, the app runs in memory and shows one line "This browser is not
  saving. Save a copy before you close it."
  *Done when:* unit tests for each method, ownership refusal, the tombstone being hidden by default, undo of a batch,
  subscribe firing once per batch, and storage that throws.
- [ ] **T1.3 `merge.js`** (P0, DESIGN 6 Merge). Pure `merge(local, incoming)` and its report.
  *Done when:* unit tests: newer wins both ways; tie broken by device; tombstone newer wins; unknown types and
  unknown `ext` kept; `example` records not imported; idempotent (merge twice = once); a wrong `schema` is rejected
  with a sentence.
- [ ] **T1.4 `io.js` and the Data screen** (P0, DESIGN 6 Export and import). Export (download, plus Web Share when
  `navigator.canShare({files})`), copy as text, import by file and by paste (the shared paste box detects state JSON
  versus an AI answer), the import report with Undo, the backup nudge state, "Try with a made-up person" and "Remove
  the made-up person", storage status, app version.
  *Done when:* an e2e test does export, clear, import, and the report says everything was added back; another
  imports the same file twice and gets "nothing new"; another removes the example data and leaves user records.
- [ ] **T1.5 `desk.js` shell and `desk.css`** (P0, DESIGN 5, 7). `Desk.register`, `Desk.missing`, `Desk.start`,
  dynamic feature loading from `list.js`, the slots table from 7.3, tabs (bottom bar on narrow screens, side or top
  on wide), hash routes, re-render on change, stubs for missing features ("This part is not built yet", with name
  and purpose), the "Ideas you could build" list from `Desk.planned` on the Data screen, toasts, the workshop banner
  when `DESK_WORKSHOP` is present, and light and dark themes.
  *Done when:* e2e: the app boots with every base feature; with each base feature's file made to fail (Playwright
  route abort or a renamed file), the app still boots, the stub shows, and the other tabs work; at 320 px wide there
  is no horizontal scroll.
- [ ] **T1.6 Checks and self-test** (P0, DESIGN 7.6, 7.5 rule 3). `checks/run.js` (node and JXA: detect
  `typeof process` vs `ObjC`; read files with `fs` or `$.NSString.stringWithContentsOfFileEncodingError`; evaluate in
  global scope), `Desk.check(id, fn)` with `t.ok`/`t.eq`, `checks/check.sh` (bash 3.2; validates the id; `STOP:`
  lines), and `core/selftest.js` (`#selftest`: core checks, each loaded feature's check file loaded at runtime, and
  the contract scan over `String(def.mount)` plus every `logic` function, flagging the banned words).
  *Done when:* `node checks/run.js <id>` works for a sample feature; the self-test page shows green for base features
  and red for a planted feature that uses `innerHTML`; `check.sh` passes `shellcheck` with `--shell=bash` and has no
  bash-4 features. (Running it under `osascript` is V4, tested on a Mac.)
- [ ] **T1.7 e2e harness** (P0). `tests/e2e/run.py` (Playwright, uv inline script metadata), Chromium and WebKit, the
  app opened from `file://` and from a local `http.server`; helpers to clear storage, paste text into the paste box,
  and read toasts.
  *Done when:* a smoke test passes on both engines and both origins.

## Phase 2: base features

- [ ] **T2.1 `jobs`** (P0, DESIGN 8.1). List with a stage filter and counts; add and edit form (title required,
  the rest optional; dates with native date inputs); one-tap stage change; detail view hosting `job.panel` and
  `job.actions`; delete with undo. `logic`: sorting, filtering, the "next date" for a job.
  *Done when:* check file passes; e2e adds, edits, changes stage, deletes and undoes.
- [ ] **T2.2 `profile`** (P0, DESIGN 6 and 9.9). The fields, the share switches with their defaults, and a "What the
  AI will see" preview that uses the same function the recipes use (`Desk.prompt.profileLines`).
  *Done when:* check: `profileLines` includes only shared, non-empty fields; e2e: switching one off removes it from
  the preview.
- [ ] **T2.3 `home`** (P0, DESIGN 8.1). The "Today" list: overdue and due follow-ups, interviews in the next 7 days,
  postings closing in 7 days, suggestions waiting (per recipe), starred events this week, pending AI question,
  backup nudge; plus the `home` slot. Empty state: three plain first steps.
  *Done when:* check: `logic.today(records, now)` returns the right items for a fixture at a fixed time; e2e: the
  example data shows items.
- [ ] **T2.4 `help` and `locale/toronto.js`** (P0, DESIGN 8.1, 9.5, 11). The locale pack: `help` entries (Employment
  Ontario, 211, Toronto Public Library Career Coaches in Residence, library settlement workers / New to Canada,
  ACCES Employment, JVS Toronto; each with name, what, how to reach, who for, and the `https` source page), `sites` defaults (Job Bank
  first; general-audience-safe only), `services`, `events` (api, tiers), `postingRules` (with source links). The
  `help` feature renders it, "Free, from people" first. **Use only the facts and source links in
  `docs/inputs/toronto-help.md` (supplied by the maintainer). Do not add services or details from memory; anything
  marked unchecked there goes in as a `TODO` comment, not as copy.** `postingRules` for Toronto: pay range, AI
  screening and open-now disclosures, `replyDays: 45`, with the O. Reg. 476/24 source link (DESIGN 8.4).
  *Done when:* every URL in the locale is `https`; e2e: the help tab lists the entries; the task report lists all
  the help copy for the maintainer to review.
- [ ] **T2.5 `events`, `net.js` and `tools/snapshot.py`** (P0 snapshot; live is P1, DESIGN 11). Snapshot tool:
  fetch both tiers from Togather for today to +8 weeks, normalise, drop descriptions, find the field holding the
  source link, write `data/events-snapshot.js`. Feature: tiers as two sections or a toggle, This week / Next week /
  All, star, dismiss (with undo), the "Suggested for you" lane with reasons and a "from AI" mark, starred events
  copied into `event-mark.copy`. `net.js` is written now (GET only, host allowlist from the locale, a timeout, falls
  back to the cache) but called only when `settings.liveEvents` is true.
  *Done when:* snapshot written with both tiers; check: filters by week and tier at a fixed `now`; e2e: star,
  dismiss, undo; a starred event survives a snapshot that no longer contains it.
- [ ] **T2.6 `data/example.js` and workshop flags** (P0, DESIGN 6 Example data). The made-up person: "Amira", from
  `docs/inputs/example-person.md` (supplied by the maintainer), as the profile, plus 6 jobs across the stages with
  dates relative to load time (so "due tomorrow" is always true), plus 2 starred events. Make clear on screen that
  she is made up. `DESK_WORKSHOP` handling: `autoExample`, `liveEvents: false`, banner text.
  *Done when:* e2e: a workshop copy opens straight into Amira's data with the banner; a normal copy opens empty with
  "Try with a made-up person".

## Phase 3: the chat route

- [ ] **T3.1 `prompt.js`** (P0, DESIGN 9.2, 9.3). Code generation (4 characters of Crockford base32 with no
  ambiguous characters), alias assignment by kind letter with numbers unique across letters, template filling
  (`{name}` substitution only; `{items}` placed or appended), the items table with its column header, the
  "HOW TO ANSWER" block built from `answer` and `example`, `profileLines`, the size budget with truncation rules, and
  `prompt` records (keep the last 30).
  *Done when:* unit tests: the envelope matches a golden file; an example events question is under 6,000 characters;
  aliases are stable for a given input order and unique by number; an unknown placeholder is left visible as
  `{name}` and reported by a `missingPlaceholders()` helper (the editor in T3.7 uses it).
- [ ] **T3.2 `reply.js`** (P0, DESIGN 9.4). The parser exactly as specified, returning
  `{code, codeStatus, accepted[], rejected[{line, reason}], ignored, looksLikeQuestion}`.
  The guiding rule is DESIGN 9.4's "repair, don't reject": when unsure whether a case should repair or reject,
  repair if the meaning is still certain.
  *Done when:* unit tests over a fixture corpus in `tests/unit/replies/`, each fixture with an expected-result file,
  covering at least:
  - **Layout:** a clean code block; no code block; two code blocks; prose before and after; a markdown table;
    bullets and numbering; an empty paste; the question pasted back.
  - **Characters and wrapping:** curly quotes; a URL split across two lines; a reason wrapped onto a second line.
  - **Aliases:** every alias dress in 9.4 step 5 (`l3`, `L 3`, `L-3`, `L03`, `(L3)`, `[L3]`, `#L3`, `**L3**`); a
    bare number; the wrong letter; no alias but an exact title; an unknown alias; a duplicate alias; a quota
    overflow.
  - **Separators:** each separator in step 5.
  - **Posting fields:** synonyms, in a shuffled order.
  - **Codes:** a missing code; a wrong code; an older stored code.
  - **Fields and values:** ambiguous and unambiguous dates; an `http:` URL, an IP-address URL and a credentials URL;
    an over-long reason (cut, not rejected).
  - **Older formats:** JSON lines in the older trial format (real replies from free Claude, supplied in
    `tests/unit/replies/trial/` by the maintainer with their question's event list), and JSON with trailing commas.

  Report the share of trial lines accepted: the target is all of them.
- [ ] **T3.3 `recipes.js`: the AI helper screen** (P0, DESIGN 9.1, 9.2, 9.5, 9.9, 9.10). Recipe registry; the
  screen: a list of tasks, `needs()` messages with a link to fix each, the service picker, "Copy and open <service>"
  (clipboard with the fallbacks from DESIGN 4, then `window.open`), "Just copy", "What will be sent", the first-copy
  privacy line, the pending-question card (also on Home), the big paste box that parses on `paste` and on `input`
  (debounced 300 ms), the "Paste" button where `navigator.clipboard.readText` exists, the result line with Undo,
  "Copy a fix-it message" for rejected lines, idempotent saving as one batch, and the "Could be better" button with
  its optional sentence on every result (saved as `recipe-note`; T3.7 uses the notes).
  *Done when:* e2e on both engines: copy a question (read the clipboard in the test, or the fallback textarea),
  paste a fixture answer, see N suggestions; paste it again and see "Already added"; paste a broken answer, copy
  the fix-it message, and check it lists the bad lines and the code; reload between copy and paste and the pending
  question is still there.
- [ ] **T3.4 `recipe-events`** (P0, DESIGN 9.6). `needs`: the profile has `roles` or `field`. Builds L and C rows;
  `apply` makes event and lead suggestions; taking an event suggestion stars it.
  *Done when:* check: `build` on the example data gives at most 20 L and 20 C rows with starred and dismissed left
  out; e2e: the full round trip with a fixture answer puts suggestions in the Events lane.
- [ ] **T3.5 `recipe-posting`** (P0, cut first if late; DESIGN 9.7). The posting box and the link field; build;
  apply as one `job-draft` suggestion; "Take it" opens the job form pre-filled; saving keeps the posting text in
  `job.posting` and `ASKS` in `job.asks`.
  *Done when:* check: the fields parse to a draft, synonyms map, `CLOSES` "unknown" leaves the date empty, and a long
  posting is cut at 8,000 characters; e2e: round trip to a saved job with its posting kept.
- [ ] **T3.6 `recipe-coach`** (P0, DESIGN 9.8). The template (the coach instructions: research, interview,
  feedback, in that order; hard cap 1,500 characters with the options filled in); the context part (job, posting
  cut to 4,000 characters, shared profile, `stories` if present), which is not counted in the cap; options (kind,
  number of questions, research on or off, language); copy and open; the voice and "keep these instructions" tips;
  "Copy only the instructions" for saving as custom instructions.
  *Done when:* check: the instructions are at most 1,500 characters for every option combination; with research
  off, the research step is gone; the context never includes notes; e2e: copy works from a job's detail view
  (`job.actions`: "Practise an interview for this job").

- [ ] **T3.7 Improving recipes** (P0, DESIGN 9.11). "Change the instructions" (editor, placeholder list,
  missing-placeholder warning, Save, "Back to the original", the last 5 versions) as `recipe-edit`, which
  `prompt.js` uses in place of the template; the notes list under each recipe; "Improve these instructions with AI"
  as a built-in recipe (its answer is the code line, then a code block of new text, then one "what changed" line;
  the parser takes the block's text whole); the side-by-side view with changed lines marked, and **Use this** /
  **Keep mine**; notes marked used. Also write `docs/RECIPES.md`: making a recipe, and the "Improving a recipe" loop.
  *Done when:* e2e: edit and save an instruction, and the next question uses it; reset brings back the original;
  export then import carries the edit; a fixture "improved" answer shows the side-by-side view, and Use this saves
  it; an answer that drops a placeholder shows the warning.
- [ ] **T3.8 Your own AI tasks** (P0, cut early if late; DESIGN 9.11). `recipe-custom`: make, edit and delete a task
  with the allowed placeholders only; it starts from the AI screen or a job's actions; the answer kind is none, or
  "save to this job's notes" (appended and dated); "Copy this recipe" as plain text, and pasting that text offers
  to add it.
  *Done when:* check: a custom task cannot use a placeholder outside the allowed set (it stays visible as text);
  e2e: make a task from a job, copy and open, paste an answer into that job's notes; share a recipe as text and add
  it back.

## Phase 4: ship

- [ ] **T4.1 `tools/build.py`** (P0, DESIGN 12, 14). Inline in boot order: core, then locale, snapshot, example, and
  every feature in `list.js`. `workshop.js` and `data/inbox.js` are never inlined. Compute sha256 for each inline
  script into the CSP `<meta>`; stamp `Desk.version`; write `dist/searchdesk.html`, `dist/index.html` (the same file),
  `manifest.webmanifest` and icons. Flags: `--features a,b` (only these), `--without a,b`.
  *Done when:* the e2e smoke and the round-trip tests pass against `dist/searchdesk.html` on both engines; a test page
  that tries a `fetch` to another host is blocked by the CSP (check the console).
- [ ] **T4.2 Hosting** (P0 without the service worker; the service worker is P1). A GitHub Action that runs
  `build.py` and publishes `dist/` to Pages, on the custom domain `searchdesk.ryankelln.com` (DESIGN 14; DNS is
  the maintainer's); an install hint on phones (once,
  dismissible); a `navigator.storage.persist()` request after the first save. Then `sw.js`: cache the page, update
  on a new version, never registered on `file://`.
  *Done when:* the hosted URL loads on a desktop and a phone, and the round trip works there (V8 is checked by the
  maintainer with a real phone).
- [ ] **T4.3 README** (P0, DESIGN 14). Three readers in order. For people looking for work: what it is, the link, "your
  data stays on this device: save a copy", the free-help line. For libraries: running a workshop, the locale pack.
  For developers: `AGENTS.md`, `docs/`, tests. Plain words in the first part.
- [ ] **T4.4 Planned-feature briefs** (P0 for 7: `sites`, `calendar`, `print`, `bigtext`, `pay`,
  `reply-clock`, `recipe-followup`; P1 for the rest). Write `docs/features/<id>.md` from the template in DESIGN 8.3 and the table
  in 8.2, and fill `Desk.planned` in `list.js` with each id, name and plain sentence. `reply-clock` is in the
  P0 set too (setting `replyDays`, 0 = off).
  *Done when:* each brief has a "Done when" list a beginner's agent could test against and names the slots it needs
  (all of which exist in core), and the Data screen lists the ideas.
- [ ] **T4.5 Reference builds of planned features** (P0: `sites`, `calendar`, `print`; P1: the rest). Build each
  strictly from its brief, as a participant's agent would, in `reference/features/<id>.js` plus
  `reference/checks/<id>.check.js` (outside `features/`, so a normal or workshop copy never loads them). This tests
  the brief: **anything the brief did not say but the build needed goes back into the brief.**
  *Done when:* each reference passes its checks; e2e with it copied into `features/` and added to `list.js` passes;
  the brief diff is committed with it.

## P1 (by Nov 16)

- [ ] T5.1 Live events (`net.js` on; the 12-hour cache; "Get the latest"; failure falls back to the cache, then the
  snapshot). Switch to Togather production when the maintainer says it is ready.
- [ ] T5.2 Service worker and offline (from T4.2).
- [ ] T5.3 Mode A inbox (`data/inbox.js` merge on load; the AGENTS section) and a demo script.
- [ ] T5.4 The remaining briefs and reference builds.
- [ ] T5.5 Verified `prefill` URLs and `account` labels (V7, V9); a recipe choice that is remembered per service.
- [ ] T5.6 `recipe-weekly` and `recipe-sites`.
- [ ] T5.7 Accessibility pass: keyboard-only run, screen-reader labels, 200% zoom, contrast check, print stylesheet.

## P2 (later)

- [ ] Guide: building a feature with a free chat at home (paste the brief, the contract and the one slot, then save
  the answer as `features/<id>.js`; written for people at home on their own computer).
- [ ] Translation: the string-table workflow and a first second language.
- [ ] Locale pack guide for other cities (`docs/LOCALE.md`), with a second example pack.

## Found while working

(Agents: add items here with the date and the task you were on.)
