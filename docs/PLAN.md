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
7. **Test before you say done:** `node --test tests/unit/*.test.js`, then `uv run tests/e2e/run.py` once e2e exists (T1.7).
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

- [x] **T0.1 Repo scaffold** (P0). Create the file tree in DESIGN 5 with empty or stub files: `index.html` loading the
  core files in order, `features/list.js` with the base ids, `LICENSE` (MIT), `README.md` stub, `.gitignore`
  (`dist/`, `__pycache__`, `.DS_Store`), `CLAUDE.md` containing `@AGENTS.md`, `tests/unit/` with a loader helper
  (`tests/unit/_load.js`: builds a fake `window`, runs the named core files in a `vm` context, and returns
  `window.Desk`).
  *Done when:* `node --test tests/unit/*.test.js` runs with one trivial passing test; `index.html` opens from `file://` with no
  console errors.
- [x] **T0.2 CONTRACT.md and AGENTS.md** (P0). `docs/CONTRACT.md` is DESIGN 7 made standalone, with one complete
  example feature. `AGENTS.md` covers: what the repo is (2 lines), the principles (DESIGN 2), the contract (a link
  to it, plus the rules in 7.5 verbatim), how to run tests and checks, "If the person has no idea what to build"
  (offer three from `docs/features/` that fit what they said, one at a time), "Working with someone's data" (DESIGN
  10), and the Mac pitfalls.
  *Done when:* both files exist, and CONTRACT's example feature passes `node checks/run.js example` (add the example
  as `docs/example-feature.js` plus its check, loaded by path).

## Phase 1: core

- [x] **T1.1 `h.js` and `strings.js`** (P0, DESIGN 7.4, 13). `h(tag, attrs, ...children)` with the link rules;
  `Desk.strings` plus `t(key, vars)` with `{var}` substitution and a fallback that shows the key; date formatting
  helpers (`fmtDate`, `fmtTime`, relative "in 3 days" / "2 days late").
  *Done when:* unit tests cover text-only children, `javascript:` href dropped, `rel`/`target` set, string fallback,
  and the date formats.
- [x] **T1.2 `store.js` and `persist.js`** (P0, DESIGN 6). Records map; `all/get/put/remove/ext/batch/undo/subscribe`;
  ids from `crypto.getRandomValues` (base32, type prefix); `updated` set on writes; ownership enforced (a feature's
  `ctx.store` refuses writes to types it does not own and throws a plain error); persistence under `searchdesk1:state`
  with try/catch and debounce. If storage is blocked, the app runs in memory and shows one line "This browser is not
  saving. Save a copy before you close it."
  *Done when:* unit tests for each method, ownership refusal, the tombstone being hidden by default, undo of a batch,
  subscribe firing once per batch, and storage that throws.
- [x] **T1.3 `merge.js`** (P0, DESIGN 6 Merge). Pure `merge(local, incoming)` and its report.
  *Done when:* unit tests: newer wins both ways; tie broken by device; tombstone newer wins; unknown types and
  unknown `ext` kept; `example` records not imported; idempotent (merge twice = once); a wrong `schema` is rejected
  with a sentence.
- [x] **T1.4 `io.js` and the Data screen** (P0, DESIGN 6 Export and import). Export (download, plus Web Share when
  `navigator.canShare({files})`), copy as text, import by file and by paste (the shared paste box detects state JSON
  versus an AI answer), the import report with Undo, the backup nudge state, "Try with a made-up person" and "Remove
  the made-up person", storage status, app version.
  *Done when:* an e2e test does export, clear, import, and the report says everything was added back; another
  imports the same file twice and gets "nothing new"; another removes the example data and leaves user records.
- [x] **T1.5 `desk.js` shell and `desk.css`** (P0, DESIGN 5, 7). `Desk.register`, `Desk.missing`, `Desk.start`,
  dynamic feature loading from `list.js`, the slots table from 7.3, tabs (bottom bar on narrow screens, side or top
  on wide), hash routes, re-render on change, stubs for missing features ("This part is not built yet", with name
  and purpose), the "Ideas you could build" list from `Desk.planned` on the Data screen, toasts, the workshop banner
  when `DESK_WORKSHOP` is present, and light and dark themes.
  *Done when:* e2e: the app boots with every base feature; with each base feature's file made to fail (Playwright
  route abort or a renamed file), the app still boots, the stub shows, and the other tabs work; at 320 px wide there
  is no horizontal scroll.
- [x] **T1.6 Checks and self-test** (P0, DESIGN 7.6, 7.5 rule 3). `checks/run.js` (node and JXA: detect
  `typeof process` vs `ObjC`; read files with `fs` or `$.NSString.stringWithContentsOfFileEncodingError`; evaluate in
  global scope), `Desk.check(id, fn)` with `t.ok`/`t.eq`, `checks/check.sh` (bash 3.2; validates the id; `STOP:`
  lines), and `core/selftest.js` (`#selftest`: core checks, each loaded feature's check file loaded at runtime, and
  the contract scan over `String(def.mount)` plus every `logic` function, flagging the banned words).
  *Done when:* `node checks/run.js <id>` works for a sample feature; the self-test page shows green for base features
  and red for a planted feature that uses `innerHTML`; `check.sh` passes `shellcheck` with `--shell=bash` and has no
  bash-4 features. (Running it under `osascript` is V4, tested on a Mac.)
- [x] **T1.7 e2e harness** (P0). `tests/e2e/run.py` (Playwright, uv inline script metadata), Chromium and WebKit, the
  app opened from `file://` and from a local `http.server`; helpers to clear storage, paste text into the paste box,
  and read toasts.
  *Done when:* a smoke test passes on both engines and both origins.

## Phase 2: base features

- [x] **T2.1 `jobs`** (P0, DESIGN 8.1). List with a stage filter and counts; add and edit form (title required,
  the rest optional; dates with native date inputs); one-tap stage change; detail view hosting `job.panel` and
  `job.actions`; delete with undo. `logic`: sorting, filtering, the "next date" for a job.
  *Done when:* check file passes; e2e adds, edits, changes stage, deletes and undoes.
- [x] **T2.2 `profile`** (P0, DESIGN 6 and 9.9). The fields, the share switches with their defaults, and a "What the
  AI will see" preview that uses the same function the recipes use (`Desk.prompt.profileLines`).
  *Done when:* check: `profileLines` includes only shared, non-empty fields; e2e: switching one off removes it from
  the preview.
- [x] **T2.3 `home`** (P0, DESIGN 8.1). The "Today" list: overdue and due follow-ups, interviews in the next 7 days,
  postings closing in 7 days, suggestions waiting (per recipe), starred events this week, pending AI question,
  backup nudge; plus the `home` slot. Empty state: three plain first steps.
  *Done when:* check: `logic.today(records, now)` returns the right items for a fixture at a fixed time; e2e: the
  example data shows items.
- [x] **T2.4 `help` and `locale/toronto.js`** (P0, DESIGN 8.1, 9.5, 11). The locale pack: `help` entries (Employment
  Ontario, 211, Toronto Public Library Career Coaches in Residence, library settlement workers / New to Canada,
  ACCES Employment, JVS Toronto; each with name, what, how to reach, who for, and the `https` source page), `sites` defaults (Job Bank
  first; general-audience-safe only), `services`, `events` (api, tiers), `postingRules` (with source links). The
  `help` feature renders it, "Free, from people" first. **Use only the facts and source links in
  `docs/inputs/toronto-help.md` (supplied by the maintainer). Do not add services or details from memory; anything
  marked unchecked there goes in as a `TODO` comment, not as copy.** `postingRules` for Toronto: pay range, AI
  screening and open-now disclosures, `replyDays: 45`, with the O. Reg. 476/24 source link (DESIGN 8.4).
  *Done when:* every URL in the locale is `https`; e2e: the help tab lists the entries; the task report lists all
  the help copy for the maintainer to review.
- [x] **T2.5 `events`, `net.js` and `tools/snapshot.py`** (P0 snapshot; live is P1, DESIGN 11). Snapshot tool:
  fetch both tiers from Togather for today to +8 weeks, normalise, drop descriptions, find the field holding the
  source link, write `data/events-snapshot.js`. Feature: tiers as two sections or a toggle, This week / Next week /
  All, star, dismiss (with undo), the "Suggested for you" lane with reasons and a "from AI" mark, starred events
  copied into `event-mark.copy`. `net.js` is written now (GET only, host allowlist from the locale, a timeout, falls
  back to the cache) but called only when `settings.liveEvents` is true.
  *Done when:* snapshot written with both tiers; check: filters by week and tier at a fixed `now`; e2e: star,
  dismiss, undo; a starred event survives a snapshot that no longer contains it.
- [x] **T2.6 `data/example.js` and workshop flags** (P0, DESIGN 6 Example data). The made-up person: "Amira", from
  `docs/inputs/example-person.md` (supplied by the maintainer), as the profile, plus 6 jobs across the stages with
  dates relative to load time (so "due tomorrow" is always true), plus 2 starred events. Make clear on screen that
  she is made up. `DESK_WORKSHOP` handling: `autoExample`, `liveEvents: false`, banner text.
  *Done when:* e2e: a workshop copy opens straight into Amira's data with the banner; a normal copy opens empty with
  "Try with a made-up person".

## Phase 3: the chat route

- [x] **T3.1 `prompt.js`** (P0, DESIGN 9.2, 9.3). Code generation (4 characters of Crockford base32 with no
  ambiguous characters), alias assignment by kind letter with numbers unique across letters, template filling
  (`{name}` substitution only; `{items}` placed or appended), the items table with its column header, the
  "HOW TO ANSWER" block built from `answer` and `example`, `profileLines`, the size budget with truncation rules, and
  `prompt` records (keep the last 30).
  *Done when:* unit tests: the envelope matches a golden file; an example events question is under 6,000 characters;
  aliases are stable for a given input order and unique by number; an unknown placeholder is left visible as
  `{name}` and reported by a `missingPlaceholders()` helper (the editor in T3.7 uses it).
- [x] **T3.2 `reply.js`** (P0, DESIGN 9.4). The parser exactly as specified, returning
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
- [x] **T3.3 `recipes.js`: the AI helper screen** (P0, DESIGN 9.1, 9.2, 9.5, 9.9, 9.10). Recipe registry; the
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
- [x] **T3.4 `recipe-events`** (P0, DESIGN 9.6). `needs`: the profile has `roles` or `field`. Builds L and C rows;
  `apply` makes event and lead suggestions; taking an event suggestion stars it.
  *Done when:* check: `build` on the example data gives at most 20 L and 20 C rows with starred and dismissed left
  out; e2e: the full round trip with a fixture answer puts suggestions in the Events lane.
- [x] **T3.5 `recipe-posting`** (P0, cut first if late; DESIGN 9.7). The posting box and the link field; build;
  apply as one `job-draft` suggestion; "Take it" opens the job form pre-filled; saving keeps the posting text in
  `job.posting` and `ASKS` in `job.asks`.
  *Done when:* check: the fields parse to a draft, synonyms map, `CLOSES` "unknown" leaves the date empty, and a long
  posting is cut at 8,000 characters; e2e: round trip to a saved job with its posting kept.
- [x] **T3.6 `recipe-coach`** (P0, DESIGN 9.8). The template (the coach instructions: research, interview,
  feedback, in that order; hard cap 1,500 characters with the options filled in); the context part (job, posting
  cut to 4,000 characters, shared profile, `stories` if present), which is not counted in the cap; options (kind,
  number of questions, research on or off, language); copy and open; the voice and "keep these instructions" tips;
  "Copy only the instructions" for saving as custom instructions.
  *Done when:* check: the instructions are at most 1,500 characters for every option combination; with research
  off, the research step is gone; the context never includes notes; e2e: copy works from a job's detail view
  (`job.actions`: "Practise an interview for this job").

- [x] **T3.7 Improving recipes** (P0, DESIGN 9.11). "Change the instructions" (editor, placeholder list,
  missing-placeholder warning, Save, "Back to the original", the last 5 versions) as `recipe-edit`, which
  `prompt.js` uses in place of the template; the notes list under each recipe; "Improve these instructions with AI"
  as a built-in recipe (its answer is the code line, then a code block of new text, then one "what changed" line;
  the parser takes the block's text whole); the side-by-side view with changed lines marked, and **Use this** /
  **Keep mine**; notes marked used. Also write `docs/RECIPES.md`: making a recipe, and the "Improving a recipe" loop.
  *Done when:* e2e: edit and save an instruction, and the next question uses it; reset brings back the original;
  export then import carries the edit; a fixture "improved" answer shows the side-by-side view, and Use this saves
  it; an answer that drops a placeholder shows the warning.
- [x] **T3.8 Your own AI tasks** (P0, cut early if late; DESIGN 9.11). `recipe-custom`: make, edit and delete a task
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
- [x] **T4.4 Planned-feature briefs** (P0 for 7: `sites`, `calendar`, `print`, `bigtext`, `pay`,
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
- 2026-10-16, T0.1: Node 22 does not accept a folder for `node --test` (`node --test tests/unit` fails with
  "Cannot find module"). The command is now `node --test tests/unit/*.test.js` throughout this file.
- 2026-10-16, T0.1: for T1.7, the Playwright Python package that `uv` picks may not match the browsers cached in
  `~/.cache/ms-playwright`. (Resolved in T1.7: pinned `playwright==1.60.0`, which matches cached chromium-1223.)
- 2026-10-16, T1.3: `merge()` returns a whole new state. T1.4 needs a store method that applies a merged state as
  one batch (so Undo works). Show only `kept` in the import report ("Kept N that were newer here"), not
  `unchanged`; "nothing new" means `added + updated + removed === 0`. The error sentences are inline in
  `core/merge.js` and should move to the string table.
- 2026-10-16, T1.3: unit tests get objects from the `vm` realm, so `assert.deepStrictEqual` against literals fails;
  JSON round-trip results before comparing.
- 2026-10-16, T0.2: `checks/run.js` is node-only for now and does not load the pure core files first; T1.6 adds
  that and the JXA host (file reading and output already go through a small `host` object). The id `example` falls
  back to `docs/example-feature.js` and its check. The shell must call `def.mount(ctx)` as a method (the example
  uses `this.logic`). The contract scan is word-based, so a comment that mentions a banned word fails a feature;
  T1.6 should keep one banned-word list shared by the runner and the self-test.
- 2026-10-16, T1.1: `h()` refuses `style`, `src` (except `data:image/...`), `action` and similar attributes, and drops
  relative and `#` hrefs; DESIGN 7.4 does not say so yet. Job date fields (`applied`, `followUp`, `closes`) are
  assumed to be `YYYY-MM-DD`; DESIGN 6 should say so. `Desk.makeT(table)` is the layered lookup for `ctx.t`.
- 2026-10-16, T1.2: `ctx.store` comes from `Desk.store.scoped(featureId, types)`; it has no `undo` (the shell owns
  undo). Undo depth is 1, as in DESIGN 6. `put` keeps an existing record's `source` on update. The store has no
  hard delete yet: "Remove the made-up person" (T1.4) needs a core-only `purge(ids)`, and imports should go through
  `Desk.merge` then one `batch('Import', ...)`. T1.5 must call `Desk.persist.load()` before mounting and show
  `Desk.persist.message()` when `status()` is `'memory'`. Undo restores the old `updated`, so an undo does not
  survive a sync to another device (design point, not a bug).
- 2026-10-16, T1.7: Chromium passes on both origins. WebKit (webkit-2287) is installed but cannot start on this
  Ubuntu 24.04 dev machine (missing system libraries); the runner reports it SKIPPED. Needs
  `sudo uv run --no-project --with playwright==1.60.0 playwright install-deps webkit` by the maintainer, else WebKit
  is checked on a Mac (V-list). (Resolved: the maintainer installed the WebKit deps; the full matrix runs.) Later tasks: set `Desk.started = true` at the
  end of boot, use the `data-test` names in `tests/e2e/README.md`, and note that `assert_no_errors` fails on 404s
  (so optional data files need a quiet loader or a stub).
- 2026-10-16, T1.5: shell API: `Desk.screen(id, {label, order, hidden, render})` replaces the `data`, `ai` and
  `selftest` placeholders (T1.4, T3.3, T1.6); `Desk.dataSection({id, order, render})` adds blocks to the Data
  screen; `Desk.slots.render(name, el, ...args)` and `ctx.renderSlot`; `Desk.featureDefs()`,
  `Desk.featureStatus(id)`, `Desk.recipeDefs()` (for T3.3), `Desk.setNow()` for tests; `Desk.store.undoToken()` so an
  old toast cannot undo a newer change. Feature CSS is injected as `<style>` elements, so T4.1's CSP needs a hash per
  style or `style-src 'unsafe-inline'`. `h()` drops `#` hrefs, so core builds its own hash links. Optional data files
  (`workshop.js`, `inbox.js`) are still not loaded: a workshop copy adds its own tag (T2.6); the inbox is T5.3.
  `test_smoke` allows `/features/` and "Failed to load resource" until the base feature files exist; make it strict
  again after T2.x. WebKit + `file://` cannot serve faked feature scripts through `page.route`, so those shell cases
  run on the other three combinations only.
- 2026-10-16, T1.6: the banned-word list and scan live in `core/contract.js` (new core file, after `h.js`; T4.1 must
  inline it). The scan strips comments (a comment no longer fails a feature) but not strings, matches whole
  identifiers, and covers every function on the def plus every `logic` function. DESIGN 7.5/7.6 should say so. The
  JXA branch of `checks/run.js` and `check.sh` under `osascript` are untested (V4 on a Mac).
- 2026-10-16, T1.4: new core-only store methods `applyRecords`, `purge`, `putQuiet` (so recording `lastExport`
  does not use up the one undo step). `settings.lastExport` and `exampleLoaded` are device-local and stripped on
  export. `Desk.pasteHandlers` is where T3.3 hooks AI answers; `Desk.io.makePasteBox` is reusable;
  `Desk.io.backupNudge()` is for Home (T2.3). `DESK_EXAMPLE` shape is documented in `data/example.js` (T2.6).
  e2e `clear_storage` does not stay cleared (the `pagehide` flush writes state back); fix the helper to load an
  empty state and flush, as `test_data.py`'s `wipe()` does. A file tombstone for an id never seen here counts as
  "Removed"; consider counting it separately in merge. DESIGN 6 should mention the device-local settings.
- 2026-10-16, T2.4: `events.api` is null until the maintainer gives the Togather staging base URL; net.js must
  treat null as "no live fetch". Tier shape is `{id, name, query}` (T2.5 may change it). Help copy is paraphrased
  from `docs/inputs/toronto-help.md` and awaits the maintainer's review; TODOs in `locale/toronto.js` list the gaps.
  Phone numbers are plain text because `h()` has no `tel:` links.
- 2026-10-16, T2.1: `interviewAt` is `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` local wall-clock (DESIGN 6 should say so).
  Jobs uses hash sub-routes `#jobs`, `#jobs/new`, `#jobs/<id>`, `#jobs/<id>/edit`. Features call `Desk.fmtDate`
  etc. and `Desk.route()` directly because `ctx` has no date or route helpers; contract rule 1 says ctx only, so add
  `ctx.fmt` and `ctx.route()` (or allow these in CONTRACT). A store change while a form is open loses unfocused
  typed values.
- 2026-10-16, T2.2: `Desk.prompt.profileLines` / `profileFields` exist ("<Label>: <value>", fixed order); the
  profile feature repeats the field list in its `logic` and a unit test keeps them in step. `store.put` replaces
  the whole record, so singleton writers must spread the existing record. `checks/run.js` now loads `core/prompt.js`.
- 2026-10-16, T2.3: `ctx.backupNudge()` added. A pending AI question is guessed as "the newest prompt in 7 days
  that no suggestion carries"; T3.x should add `answeredAt` to `prompt` records and Home should use it. T2.5 must
  write `event-mark.copy.start` as local `YYYY-MM-DD[THH:MM]` or ISO. "This week" on Home is today..today+6.
- 2026-10-16, T3.1: codes use 30 characters (Crockford without 0 and 1); prompt records are `p_<code>`, so pass
  `Desk.prompt.usedCodes()` as `taken` to `code()`. `missingPlaceholders` = unknown names; `absentPlaceholders` =
  allowed names the template dropped (T3.7's warning). The title cut needs the column named `title`. Worst-case 40
  rows with long titles and venues go over 6,000 and drop rows. Pruning to 30 uses the new `store.purgeQuiet`.
- 2026-10-16, T3.2: trial lines accepted: 53 of 53. Expected files were generated by the parser and read by hand
  (`UPDATE_FIXTURES=1` rewrites them; review the diff after any parser change). Prompt records store the bare code
  (`7Q3K`); the parser returns `DESK-7Q3K`. Recipes must list `NEW` in `answer` for NEW lines, and pass
  `required:{L:['why']}` if a reason is required. Rejection sentences are inline with stable codes; move them to
  the string table. Suggestion ids are T3.3's job.
- 2026-10-16, T3.2 review (to fix next, before T3.4): trial lines and performance are fine (100 KB parses in under
  50 ms), and so is URL host safety. Defects, most serious first:
  (1) emoji/arrow/check bullets and `>` blockquotes make answer lines vanish;
  (2) letterless numbers in prose (`9:30 am`, `11-02`, `2 - great`) are read as aliases; accept only `|`, tab or two
      spaces after a bare number, and ignore (not reject) unknown bare numbers;
  (3) a title mentioned anywhere in prose is imported, even "I would skip <title>"; only match a title at the start
      of a line or after a separator;
  (4) a title column is glued into the reason (tables, tabs, `L1 (Title) | why`);
  (5) dates: `Mon, Nov 2` and `Nov 2, 2026 at 5pm` give unknown; `2026-11-02 to 2026-11-30` silently keeps the first
      date; "Sep 1" rolls 11 months forward (prefer unknown or this year);
  (6) a found code from another recipe is not refused;
  (7) URL paths accept `<`, `"`, bidi characters and bad ports;
  (8) a trailing prose line is glued into the last reason;
  (9) `L1-2` and `L1 & L3` give garbage reasons;
  (10) lowercase "desk 2026" counts as a code;
  (11) without `ctx.example`, the pasted-back example line is accepted;
  (12) smaller gaps: `#1 L3`, `Top pick: L1`, a second answer block, uncapped `rejected`.
  Add a fixture for each. The full review: the T3.2 reviewer's report from the session of 2026-10-16.
- 2026-10-16, T3.3: the recipe def shape is documented at the top of `core/recipes.js` (`title`, `needs` may return
  `{text, go}`, `options`, `data(ctx, opts)`, `apply` → suggestions or `{suggestions, records, render}`; recipe
  ctx is read-only). `#ai/<recipeId>/<args>` starts a task (coach from a job: `ai/coach/<jobId>`). Prompts get
  `answeredAt` in the same batch as their suggestions; Home should switch to `Desk.recipes.pendingPrompt` logic
  (no `answeredAt`). Parser gap: the "NEW | title | url | why" format line in a pasted-back question is rejected
  as a bad URL; `process` works around it — fix in reply.js with the review items above. Paste box redraws must be
  deferred (focus restore refills a same-id textarea). A feature has no ctx way to copy and open a question in one
  tap; add `ctx.ai.ask(id, opts)` if T3.6 needs it. Real clipboard writes are only exercised in Chromium.
- 2026-10-16, T3.6: the default instructions are interviewer prompt v4 byte for byte (golden file
  `tests/unit/golden/coach-v4.txt`; 1,481 characters; the longest option mix is 1,499 and the shortest 1,269). The default is
  3 questions, not 5: only 3 has been through the harness, and 2, 4 and 5 are untested. New optional recipe fields
  `copies` and `tips` are in `core/recipes.js`; they went into history early, inside `1836e30`. The harness lives in
  `tools/interview-harness/` (`export-prompt.js` prints the release text; `runs/` is ignored; 3 runs are kept in
  `evidence/`). Open: v4's line "Workshops: fictional person only" goes to real users too (maintainer decision);
  the harness's Amira (a beginner in retail) is not the example Amira (an AP clerk), so the real example person still needs a
  fixture; the `story` field names are a guess until `stories` exists; T3.7 must give the edited template to
  "Copy only the instructions"; `test_ai.py` relies on its fixture recipe being registered first. DESIGN 9.8
  still describes 5 questions and paraphrased steps; v4 is the source of truth.
- 2026-10-16, T2.5: Togather staging, `GET /api/v1/events`, gives `{items, next_cursor, timeZone}` as JSON-LD. Its
  parameters are `startDate`, `endDate` (inclusive), `keywords` (comma-separated), `limit` (at most 200), `after`
  (the cursor) and `context=document`. CORS is `*`. The list has no source link; only `GET /api/v1/events/<id>` has
  `url`. So the snapshot does one detail request per event, and live data uses `@id` (the Togather page) unless the
  snapshot already knows the link. Live fetching follows the pages; it is not one request per tier (DESIGN 11 needs
  this fixed). The snapshot has 1,057 events (33 library, 1,024 city), runs Oct 16 to Dec 11 and is 325 KB:
  regenerate it before release (`uv run tools/snapshot.py`). `locale.events.api` is the full endpoint.
  `ctx.events.current()/refresh()` is new, with a CONTRACT row. The events feature owns `event-mark` and
  `suggestion` in its `types`, so it can mark a suggestion taken or dismissed. Revisit this if a second feature
  needs to take suggestions: a small core `takeSuggestion` would be cleaner. Mark ids are `em_<eventId>`. For T3.4,
  `suggestion.target` is the event `id` (the ULID). No UI yet turns on `settings.liveEvents` or offers "Get the
  latest" (T5.1). The T4.1 CSP `connect-src` is `https://staging.toronto.togather.foundation`. The Python and JS
  normalisers are separate copies; a test keeps the tiers and endpoint in step, but not the normalise logic. Staging
  data is mixed (venues like "Members only"), so the T3.4 row caps matter.
- 2026-10-16, T3.2 fixes: all 12 review defects are fixed, each with a fixture in `tests/unit/replies/review/`.
  Trial lines still pass 53/53, and a 100 KB paste parses in about 43 ms. Two quadratic regexes the probe found are
  also fixed. The `process` workaround is gone: a pasted-back question now gives `looksLikeQuestion`. Three expected
  files changed: "Sep 1" with today Oct 16 is now unknown; two question layouts count fewer ignored lines. The yearless
  date rule: up to 31 days back stays this year, otherwise it rolls to next year only within 183 days, else it is unknown.
  A code from another recipe gives `codeStatus: 'other'`; `process` cannot reach this today, so there is no
  `aiOtherTask` string yet. `rejected` is capped at 50, with `rejectedMore`.
- 2026-10-16, T3.6 follow-up (maintainer decision): the workshop sentence appears only on a workshop copy
  (`window.DESK_WORKSHOP` truthy; the recipe ctx has `workshop()`, and an option `default` may be a function of
  the recipe ctx). A workshop copy keeps v4 exactly: 3 questions, 1,481 characters. A normal copy defaults to 5 questions (1,425
  characters; its longest mix is 1,443) and is not yet harness-tested. `export-prompt.js --workshop`; the harness defaults to the workshop text.
  The harness person is now Rosa (rich volunteering history, `fixtures/rosa-v3.md`); the app's example person is Amira.
- 2026-10-16, T3.4: rows come from the next 21 days, leaving out starred, dismissed and finished events. Each tier
  keeps its 20 best by how well the event's words fit the profile's roles and field, then shows them in date order.
  A row is `alias | date | title | venue`. The answer quota is L4 C4 NEW2. Event suggestions have `target` set to
  the event ULID; "Star it" in Events takes them, and the e2e test covers the whole round trip. Open: nothing yet shows
  `lead` suggestions (DESIGN 9.6: a link list on the AI screen, or `sites`), though the result line counts them as
  "added to Events". The recipe ctx has no `events`, so the feature reads them from its mount ctx. Core numbers
  aliases continuously (L1–L5, then C6..), not C21–C40 as DESIGN 9.6 says.
- 2026-10-16, T2.6: `DESK_EXAMPLE` is a function: a profile plus 6 jobs, with dates built from today. It stars the
  first library events still to come with "resume" and "interview" in the title, read from the snapshot at load time,
  so it follows a regenerated snapshot. `Desk.start` loads the example once when `DESK_WORKSHOP.autoExample` is set
  and the store is empty. A normal copy with Amira on screen now shows an "Amira (made up)" banner (`exampleBanner`;
  DESIGN 6 said no banner). Open for T4.x packaging: there is no `data/workshop.js` file and no script tag yet; a
  workshop copy needs `window.DESK_WORKSHOP = { autoExample: true, liveEvents: false }`. On a workshop copy,
  removing Amira and reloading brings her back (fine for a practice computer). DESIGN 6's "the example's label" is
  really the profile background plus the banner.
- 2026-10-16, T3.2 second review: an independent review of 9f1f6d3 found 5 more problems, now fixed with fixtures `e1`–`e5`.
  Markup is no longer stripped inside URLs. Gluing stops at 1,000 characters (`MAX_GLUE`), which removes a quadratic
  slowdown: 100 KB floods parse in 60 ms or less. A label that says no (`Skip: <title>`) no longer imports. Yearless
  dates now consider last year (up to 31 days back), then this year, then next year (up to 183 days ahead), so they
  work across New Year and leap days. An alias followed by a digit parses again. Multi-alias lines are now
  `rejected` with code `multi-alias` ("Give one item per line."). Accepted as is: a lowercase trailing prose line is
  glued to the last reason.
- 2026-10-16, T3.5: the answer is field lines (TITLE, ORG, WHERE, CLOSES, PAY, AI-SCREENING, ASKS, FIT). It becomes one
  `job-draft` suggestion with a fixed id, so pasting the same answer twice adds nothing. The link and posting come
  from the prompt record (`keep`), never from the AI. Take it is in both the result and a "Ready for you to check" lane
  on Jobs; both go to `#jobs/new/<suggestion id>`. Saving marks the draft taken in the same batch. PAY, AI-SCREENING
  and FIT go to `notes` until a checklist exists. New in `core/recipes.js`: recipe `inputs` (text boxes, given as
  `opts.inputs`), `keep(ctx, opts)` saved on the prompt record, and a per-recipe `budget`. `checks/run.js` now loads
  `core/reply.js`. Now jobs and events both list `suggestion` in `types`, so a core `takeSuggestion` is worth doing,
  and CONTRACT should say so. The prompt record holds up to 8,000 characters of posting, and it goes into the backup.
  This recipe and T3.7 were built at the same time, so this commit also carries T3.7's two small hooks in
  `core/recipes.js` (`panelExtras`, `edited`). They do nothing until `core/recipe-edit.js` lands.
- 2026-10-16, T3.7: core owns `recipe-edit` (ids `re_<recipeId>`) in the new `core/recipe-edit.js`, loaded after
  `core/recipes.js`. T4.1 must inline it, and DESIGN 5 should list it. "Back to the original" empties `text` and keeps
  the versions. `improve` is a hidden built-in recipe (`listed:false`), opened at `#ai/improve/<taskId>`. It needs
  `keep` from T3.5. Use this saves the edit and marks the notes used in one undo step. `prompt.js` adds the example
  line for `answer:'text'`. In text mode, `reply.js` now lets a "What changed:" line after the block win over nearer
  prose. Coach "Copy only the instructions" now uses the edited template. Open: an edited coach prompt is not held to
  the 1,500 cap (a warning would be good). The dropped-placeholder warning is only as good as each recipe's
  `placeholders` list. `recipe-edit` records keep `source:'user'` even after Use this.
- 2026-10-16, T3.8: `recipe-custom` is owned by the feature (DESIGN 6 says core; DESIGN should be updated). Each
  record is registered with `ctx.recipe`, using its id, and re-synced on every store change. New core pieces:
  `ctx.removeRecipe(id)`, and an `ai` slot (a block on the AI screen with an optional `paste(text)` hook for text that
  is not an AI answer). Both have CONTRACT rows. The allowed words are `{profile}`, `{events}` and `{replyLanguage}`,
  plus `{job}`, `{title}`, `{org}`, `{where}`, `{asks}` and `{posting}` for a task that starts from a job. Any other word stays visible as text.
  "Save to this job's notes" makes a `job-note` suggestion; the job page's "Add to notes" appends it with a date and
  marks it taken in one undo step. The shared text starts "[A task to share, from Search Desk]". A paste over 6,000
  characters is refused. Smoke is now strict (no missing-feature allowance). Open: Home shows a waiting `job-note` as
  "1 suggestion waiting: rc_xxxx" (the raw id); Home should skip it or name the job. "Copy this recipe" is disabled
  until a job task's needs are met. `ctx.store.subscribe` is used but missing from CONTRACT.
- 2026-10-16, T4.4: there are 15 briefs in `docs/features/`: the 7 P0 ones, plus checklist, contacts, stories, resumes, board,
  week, recipe-weekly and recipe-sites. `Desk.planned` is filled. Each brief adds "Record types", "ctx calls" and "Needs
  from core" lines to the DESIGN 8.3 template. Needs from core:
  (1) `settings` may not exist, so `ctx.store.ext('settings', …)` throws. This hits bigtext and reply-clock; core
      should create `settings` at boot.
  (2) There is no `ctx.download` (calendar's .ics); the brief has a workaround.
  (3) Nothing takes a `job-next` suggestion (recipe-weekly).
  (4) board cannot move stages, by design.
  The `sites` brief covers showing and taking `lead` suggestions. DESIGN 9.6's fallback "link list on the AI
  screen" is not specified anywhere. This commit also lists `recipe-custom` in `Desk.features`.
- 2026-10-16, maintainer decision: instructions longer than 1,500 characters get a warning (not a block), because free
  web chats may keep only 1,500. It shows in the editor, the improve compare view, the custom task form and a pasted
  shared task (`instructions-long`). Coach counts its filled instructions through the optional recipe hook
  `instructionsLength(text, ctx)`. Home now shows a waiting `job-note` by its job's title, linked to the job.
- 2026-10-16, core gaps from T4.4: `store.ext('settings', …)` now creates the record when it is missing. Creating it at
  boot would give it a fresh `updated` that beats an imported backup's settings. New `ctx.download(name, text, type)`:
  safe names and four text types only, returns true or false (`Desk.io.saveText`, `downloadAllowed`). The bigtext,
  reply-clock and calendar briefs now use the real API. A flaky test seen once: `test_ai_odd_pastes_say_what_happened`
  on webkit with file (it passed on rerun).
