# Search Desk: work plan

> Written 2026-10-16 for implementing agents (Sonnet or similar) working one task at a time. Design: `DESIGN.md`
> (section numbers below are its). Priorities: **P0** = the first release, tag `2026.10.19`, cut by **Mon Oct 19,
> 2pm**; **P1** = by Nov 16; **P2** = later. Anything specific to one host or one session — installing it on that
> host's machines, its facilitator brief — lives with that host, not here.

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
8. **Mac pitfalls to keep in mind** (shared computers are often managed macOS Macs in Chrome): `python3` and `git`
   may be stubs that open an installer dialog, and `node` may be missing — so scripts must be bash 3.2 and
   BSD-tool safe (`sed -i ''`, no `date -d`, no `timeout`, `shasum -a 256`); `osascript -l JavaScript` runs
   JavaScript with no browser and no Node; Finder drops `.DS_Store` files into folders (ignore them); filenames are
   case-insensitive. Test what is actually there rather than assuming either way.
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

- [x] **T4.1 `tools/build.py`** (P0, DESIGN 12, 14). Inline in boot order: core, then locale, snapshot, example, and
  every feature in `list.js`. `workshop.js` and `data/inbox.js` are never inlined. Compute sha256 for each inline
  script into the CSP `<meta>`; stamp `Desk.version`; write `dist/searchdesk.html`, `dist/index.html` (the same file),
  `manifest.webmanifest` and icons. Flags: `--features a,b` (only these), `--without a,b`.
  *Done when:* the e2e smoke and the round-trip tests pass against `dist/searchdesk.html` on both engines; a test page
  that tries a `fetch` to another host is blocked by the CSP (check the console).
- [x] **T4.2 Hosting** (P0 without the service worker; the service worker is P1). A GitHub Action that runs
  `build.py` and publishes `dist/` to Pages, on the custom domain `searchdesk.ryankelln.com` (DESIGN 14; DNS is
  the maintainer's); an install hint on phones (once,
  dismissible); a `navigator.storage.persist()` request after the first save. Then `sw.js`: cache the page, update
  on a new version, never registered on `file://`.
  *Done when:* the hosted URL loads on a desktop and a phone, and the round trip works there (V8 is checked by the
  maintainer with a real phone).
- [x] **T4.3 README** (P0, DESIGN 14). Three readers in order. For people looking for work: what it is, the link, "your
  data stays on this device: save a copy", the free-help line. For libraries: running a workshop, the locale pack.
  For developers: `AGENTS.md`, `docs/`, tests. Plain words in the first part.
- [x] **T4.4 Planned-feature briefs** (P0 for 7: `sites`, `calendar`, `print`, `bigtext`, `pay`,
  `reply-clock`, `recipe-followup`; P1 for the rest). Write `docs/features/<id>.md` from the template in DESIGN 8.3 and the table
  in 8.2, and fill `Desk.planned` in `list.js` with each id, name and plain sentence. `reply-clock` is in the
  P0 set too (setting `replyDays`, 0 = off).
  *Done when:* each brief has a "Done when" list a beginner's agent could test against and names the slots it needs
  (all of which exist in core), and the Data screen lists the ideas.
- [x] **T4.5 Reference builds of planned features** (P0: `sites`, `calendar`, `print`; P1: the rest). Build each
  strictly from its brief, as a participant's agent would, in `reference/features/<id>.js` plus
  `reference/checks/<id>.check.js` (outside `features/`, so a normal or workshop copy never loads them). This tests
  the brief: **anything the brief did not say but the build needed goes back into the brief.**
  *Done when:* each reference passes its checks; e2e with it copied into `features/` and added to `list.js` passes;
  the brief diff is committed with it.

## Phase 5: building features (P0 for Oct 19; desktop only, by an agent in the folder or by a free chat in the browser)

- [x] **T6.1 Agent skill and `docs/BUILDING.md`** (P0). `.claude/skills/add-feature/SKILL.md`: a thin wrapper that follows
  AGENTS.md "If the person has no idea what to build" (ask about them, offer three briefs one at a time), then builds the
  file, runs `node checks/run.js <id>`, and says what passed. It points at `docs/CONTRACT.md` and `docs/features/`; it
  does not copy their rules. `docs/BUILDING.md` has two paths: (A) an agent in the folder, (B) a free chat in the browser
  with a kit. It says plainly that building is a computer job (a feature is a file you save and reload). It covers the
  P2 "at home" guide. Plain words.
- [x] **T6.2 Build kits** (P0). `tools/kit.py` (stdlib, `uv run`) writes `docs/kits/<id>.txt` for each brief in
  `docs/features/`: a short instruction ("reply with exactly one file, nothing else"), `docs/CONTRACT.md`,
  `docs/example-feature.js`, then that brief. Commit the output so people need no tools. A unit or build check fails when
  a kit is out of date. `docs/BUILDING.md` path B says: copy the kit, paste into a free chat, save the reply as
  `features/<id>.js`, add it to `list.js`, open `#selftest`, and if it fails copy the problem back to the chat.
- [x] **T6.3 Trial the kits** (P0). Give two or three kits (`bigtext`, `pay`, one more) to a free chat; record whether the
  file passes `#selftest` unedited. Fix the kit wording for what breaks. Maintainer runs the chat; the agent records.
  **Done 2026-10-17. Three kits run — `bigtext`, `pay`, `print` — and the kit wording was fixed for what broke.**
  - **Trial 1 of 3: `bigtext`, done 2026-10-17.** One reply, no editing. It **loads and the contract scan is clean**,
    and it met 9 of the brief's 10 acceptance criteria unedited, including the ones worth doubting: it applies at once
    with no reload, survives a reload, nothing scrolls sideways at Biggest on a 320px phone, choosing Normal with
    contrast off leaves the page byte-for-byte as it was, an unrecognised saved value is treated as Normal, and the
    contrast is genuinely darker in light mode and lighter in dark mode (it guessed `prefers-color-scheme` and also
    guarded the override correctly with `:not([data-theme="light"])`).
  - **What it got wrong, and it is not the reply's fault: `h('select', { value })` did nothing.** The brief asks for a
    control that shows the saved choice; the reply wrote the obvious `value`, and a select's value is a property, not an
    attribute, so every browser showed the first option. Fixed in `core/h.js` (commit `6dcbd93`), documented in
    CONTRACT.md. Worth noting what the chat got *right* here: it also built the select twice and left a
    `selects[0].remove()` guard that can never fire, which is dead code and harmless only because the Data screen
    redraws between human interactions.
  - **Packaging defect that hit every kit, not just this one.** All 15 briefs open their Done-when with
    "`node checks/run.js <id>` passes", and all 15 kits embed those briefs — but a kit asks for exactly one file and
    the runner needs two (`checks/<id>.check.js` as well). So no kit can meet its own acceptance criterion. The
    browser path survives it: `#selftest` shows "No check file" as *not red*, deliberately, so the feature loads and
    the scan still runs. `checks/run.js` disagrees with that and hard-stops. Either the runner should match the
    self-test, or the 15 briefs should stop naming a command the person who followed the kit cannot run. Not decided
    yet; it changes what a green means, so it is the maintainer's call.
  - Still to trial: `pay`, and one more.
- **Trial 2 of 3: `bigtext` again, done 2026-10-17, after `ctx.pref` (commit `70ad6c1`) and the Done-when fix.** Same
  brief, same model family, **fresh conversation** so the model could not lean on its own earlier answer. Same 15
  checks as trial 1: **15 of 15, unedited.** It used `ctx.pref` for both settings, wrote no control markup at all, and
  came back 152 lines against trial 1's 202 and 58 for the reference version written by hand. The double-build bug
  from trial 1 is gone, and so is the `value`-on-a-select bug, because the reply never wrote that: `ctx.pref` does it.
  The contract scan is clean, `#selftest` shows the row as `none` ("No check file, 1 of 1 checks passed") and not one
  row in the whole app is `fail` or `missing`. **So the facility did what it was built to do**: the storage half was
  already fine, and the part that was expensive is now one line each.
  - **The kit is not what failed this time; the copy-and-paste was.** The file arrived wrapped in ` ``` ` fences and
    would not parse at all (`SyntaxError`). That is the normal shape of a chat reply, and step 4 said only "Copy that
    file", which is exactly how you end up with the fences. Worth knowing, because the app handled it the way it is
    meant to: `Desk.started` stayed true, every other tab worked, and `#selftest` reported "Did not load". Step 4 now
    says to copy the code inside the box and not the box marks.
  - **That failure also showed a small gap.** A feature that will not load can only be named by `Desk.planned`, so once
    the line there was deleted the stub was labelled `bigtext` rather than "Bigger text" — a workshop participant who
    just built the feature would see a nameless stub. BUILDING.md step 6 now says to leave the `Desk.planned` line
    until the self-test is clean, and step 9 says to delete it then.
  - **Dark mode has now been guessed wrong twice, and the contract never said.** Both replies invented `.dark`,
    `html.dark`, `[data-theme="dark"]` and `[data-color-scheme="dark"]`, none of which exist; only the
    `prefers-color-scheme` media query they also wrote does any work. CONTRACT.md now says dark mode follows the
    device, that there is no `.dark` class and no `data-theme` attribute, and gives the one-class-plus-one-media-query
    shape to use instead — checked against `core/desk.css`, which really has only `@media (prefers-color-scheme: dark)`.
  - The reply's contrast values are worth keeping: `--line` goes from 1.25:1 to 4.06:1 in light mode, where the app's
    own default fails the 3:1 that WCAG AA wants of a border. It picked better numbers than the brief asked for.
  - One judgement call the brief did not ask for: it adds `@media (max-width: 360px) { font-size: 140% }`, so at 320px
    "Biggest" is 140%, not 150%. The brief's criterion (nothing scrolls sideways at 320) passes, but the label is not
    quite true at that width. Left alone rather than pinned down, since a chat that cannot fit 150% on a small phone
    reducing it is a reasonable answer.
  - Trial 1's reply and trial 2's are kept at `/tmp/opencode/t63-trial2/` for comparison. Still to trial: `pay` (whose
    choices come from data rather than a fixed list), and one more. **Trial 2 says nothing about a weak model**, which
    is the case AGENTS.md is written for.
- **Trial 3, 2026-10-17, Gemini on `pay` — and the finding that invalidates trials 1 and 2 as kit tests.** The reply was
  a complete `sites` feature: a different planned feature, with pay nowhere in it. Measured rather than argued, the
  reply's `mount` is `docs/example-feature.js` renamed — 10 of the example's 29 significant statements appear verbatim
  once the names are normalised away, and all 10 are structural.
  - **The cause was not the model. The kit never arrived.** A kit was 40,594 bytes and Gemini's paste stopped at
    31,958, which is exactly where the tail used to begin: PART 3 (the example) and PART 4 (the brief) were both lost.
    **The model was never shown the brief.** It built what it had, which was the contract's own `sites` skeleton near
    the top. That also means the earlier reading — that the contract's `sites` example was pulling the reply — was not
    supported by the evidence, though the change made for it is still right on its own terms (one example, never a
    real feature's id).
  - `tools/kit.py` warns at 60,000 bytes, which was 20,000 more than one free chat would take. Tightened: the brief is
    now PART 2, immediately after the instruction, so a kit that is cut short still says what to build. Everything
    that decides the outcome — instruction, brief, the whole contract — is now delivered by 29,619 bytes. Formatting
    was measured rather than guessed: separators, blank lines, fences and comments come to 1,790 bytes, 4.4% of a kit,
    so trimming them is worth doing and cannot be what fixes this. CONTRACT.md section 8 was a verbatim second copy of
    the example the kit already ships in PART 3, and is now a pointer to the two files.
  - **The reorder exposed a real bug in `docs/kits/index.html`.** `page()` hardcoded "parts 1-3 are shared, part 4 is
    the brief", so every kit on the page would have been handed the *first* brief. Deriving shared-from-own instead of
    counting still put the brief last, because joining two groups loses the order. It now emits one ordered list. Found
    by a probe that opens the page, presses all 14 buttons, and compares each assembled kit byte-for-byte with the
    .txt file beside it — 8/8, and it is the check that would have caught either version of this bug.
  - **The reply, kept at `/tmp/opencode/sites-trial/gemini-sites-reply.js`, met 6 of 13 of its own brief's criteria.**
    No note field, no edit, no link validation (so it required a link, stored a `javascript:` URL, and refused no
    duplicate links), sorted newest-first instead of by name, delete with no Undo, neither the locale's starting sites
    nor the AI-lead lane, and none of the 21 `data-test` names the brief lists. Right: pure logic in `logic` rather
    than mount, and although it never validates a URL, `h()` refused to render the `javascript:` one — the safety net
    caught what the feature missed.
  - **So `pay` has still not been trialled.** Trials 1 and 2 (bigtext, ChatGPT) are valid: that chat took the whole
    40k. Gemini's does not. Worth knowing before reading anything into the model comparison.
- **Trial 4, 2026-10-17, Gemini on `pay`, after the kit was reordered — and a much better reply.** 225 lines,
  `id: 'pay'`, contract scan clean, and it met **19 of 20** checks measured in a browser. Kept at
  `/tmp/opencode/pay-trial/gemini-pay-reply.js`.
  - The logic is nearly all right. `cleanAmount` takes `24`, `24.50`, `$24`, `65,000`, `''` and refuses `abc`, all as
    the brief says. `describe` gives `$20 to $24 an hour`, `$20 an hour`, `$65,000 a year` and `''`. `compare` is
    right for below, inside, an empty side and two different units — **and never returns `'above'` at all.** The rule
    is written inverted (`aimLow > postedTop` where it should be `aimTop < postedLow`), and because the `inside`
    branch above already excludes the case, the branch is *dead* rather than wrong. A wrong-but-reachable answer would
    have been noticed by eye; a dead one looks fine in the code. The string and the render branch both exist.
  - **The brief's own check list catches it in one line.** Written from "Checks to write" in pay.md, against this
    reply: 20 passed, 1 failed, and the failure names the rule. That is the argument for the check step: a kit asks for
    one file, so the chat cannot write the check that would catch its own bug, but the brief names it and an agent
    writes it in a minute. Keep both lists in the briefs for this reason.
  - **One real interface fault, and the house style says otherwise.** Saving pay ends in `ctx.ui.go(ctx.route().tab)`,
    which is `#jobs` — so you are thrown out of the job you were reading, the boxes vanish and the summary is not on
    screen (only a toast, gone in 10 seconds). Saving the job itself ends at `ctx.ui.go('jobs/' + saved.id)`
    (features/jobs.js:770) and keeps your place. Measured, both ways, side by side.
  - No `data-test` names at all, which for this brief is not a miss: unlike sites.md, pay.md lists none, so there was
    nothing to use. Worth adding the list to the briefs that lack one, since tests need hooks.
- **Trial 5, 2026-10-17, Gemini on `print` — the first reply whose logic is entirely right.** 256 lines, `id: 'print'`,
  contract scan clean, and it met every Done-when in the brief that is about the screen. The check written from the
  brief's own "Checks to write" list passes **72 of 72**. `todayKey`, `isDay`, `dayOf` and `daysFrom` are all right,
  including the two the brief warns about by name, and `weekDates`, `lateJobs` and `starredThisWeek` do what it says.
  Kept at `wip/print-reply.js` with its check at `wip/print.check.js`.
  - **The check caught nothing, and the first run failed on my own mistake, which is worth recording.** I expected the
    starred events in the order I had written them down. The brief says "by start, then title", and an event that is
    on now started on the 15th, so it sorts before one that starts on the 18th: the feature was right and the test was
    wrong. Writing a check is the same discipline as writing a feature.
  - **The brief's two date warnings are real hazards and the reply cleared both.** It used the local getters for
    `todayKey` and `Date.UTC` for `daysFrom`. Proved the test is load-bearing by breaking `todayKey` into
    `toISOString().slice(0, 10)`, and the check fails — and in this repo's own zone (`America/Toronto`) it fails
    without needing `TZ` set at all, because a 23:30 local evening is already the next day in UTC. Under `TZ=UTC`
    the correct feature still passes 72/72, so the test is not failing for the wrong reason. Worth running both ways:
    in a UTC run a UTC answer looks right.
  - **Three faults, all in the words rather than the logic, and all of the kind only a person notices.**
    - `jobTitle`, `eventTitle` and `dateLabel` are declared in `strings` and never used: three strings a translator
      would translate for nothing. (`interview` and `closes` look dead to a grep and are not — they are reached
      through `ctx.t(item.kind)`.)
    - It called the page "Your week", which is the name `week.md` gives its Home block. Two different screens, the
      same heading, once both features exist.
    - With nothing to show it says so four times: each of the three sections draws its own empty line, and then
      "Nothing this week." is added on top. The brief asks for that last one and says nothing about the other three.
  - No `data-test` names, and here that is expected rather than a miss: this trial ran against `print.md` as it was
    before the hooks went in, so there was nothing for the reply to use. It is the trial that shows why the briefs
    needed them.
- **What the trials say together.** A reply that arrives whole is good: clean scan, right feature, most of the logic,
  the interface words taken from the brief. The two failures that matter are both invisible without work — one is a
  dead branch in logic, one is where the screen goes after Save — and both are what the existing machinery is for:
  `logic` plus a check, and a browser. **The kit path can only ever prove a file loads.** Everything past that is the
  agent's step, and that is the honest shape of path B.
- **And a check is not the same as a good feature, which trial 5 is the evidence for.** Its check passed 72 of 72 and
  three faults stood: three strings declared and never used, a heading that collides with another feature's, and a page
  that says it is empty four times. **All three are in the words, and the words are the one layer nothing checks.**
  That matters more here than it would elsewhere, because the strings are the layer a translator touches (principle 5
  in AGENTS.md): a dead string is a string somebody translates for nothing, and a heading that collides is one nobody
  can fix without reading the other feature. The faults a check catches are the ones you can write down; the ones it
  misses are the ones you have to read for.
  - A static scan for a declared string key that never appears again in its own file would catch the dead ones, but
    `interview` and `closes` in trial 5 are reached dynamically through `ctx.t(item.kind)` and would be flagged too.
    So it needs a way to say "these are reached some other way", which means a decision, not a grep.
    **Decided 2026-10-17: not building it.** A scan that flags two live strings would teach people to ignore it, and
    the false positives are the whole cost. There is no cheap way to let a key say "I am reached some other way"
    without asking every feature to declare it, which is more work than the three dead strings in one reply were.
    Those were found by reading the file, which is what a person is for.
  - The collision is the more interesting one and no scan will find it: two features can each be correct alone and
    wrong together, and nothing in a per-feature check can see the other file. That is an argument for reading a reply
    against the *other* briefs it lands next to, which is cheap and is what found it here.
- **Who runs a kit at the workshop is an agent with file tools, not a web chat, and that settles the packaging defect
  above.** A chat can be told to return one file and can only return one, so the defect is real for it. An agent can
  write both, and the brief's own Done-when already names `checks/<id>.check.js`, so nobody following a kit as a
  harness agent gets stuck on it. Three kits run is enough to call this done.
  - **It still bites anyone using a kit the other way**, which is what the kit is *for* in BUILDING.md, so the defect is
    recorded rather than closed. And one line of kit text is now wrong for the agent path: PART 1 says "Reply with
    exactly one JavaScript file, in one code block, and nothing else", which is a chat's instruction and an agent's
    instruction to write one file and stop. Worth a sentence in PART 1 that covers both — write both files if you have
    tools, reply with one if you do not — rather than two kits that drift apart.

## P1 (by Nov 16)

- [ ] T5.1 Live events (`net.js` on; the 12-hour cache; "Get the latest"; failure falls back to the cache, then the
  snapshot). Switch to Togather production when the maintainer says it is ready.
- [x] T5.2 Service worker and offline (from T4.2; landed with it).
- [x] T5.3 Mode A inbox (`data/inbox.js` merge on load; the AGENTS section) and a demo script.
- [ ] T5.4 The remaining briefs and reference builds.
- [ ] T5.5 Verified `prefill` URLs and `account` labels (V7, V9); a recipe choice that is remembered per service.
- [ ] T5.6 `recipe-weekly` and `recipe-sites`.
- [ ] T5.8 "Build a feature" card in the AI helper screen: a feature file that fills the kit and has a copy button.
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
- 2026-10-16, T4.5: there are reference builds of sites (Sonnet), calendar and print (Haiku, on purpose, as a harder
  test of the briefs) in `reference/` (features, checks, tests). They passed 29, 37 and 29 checks, and their e2e passed in
  a worktree with each one listed. Each brief gained what the build needed: field names, sort orders, today's day
  key, redraw and state, ICS rules. CONTRACT now says: every slot entry needs an `id`, `label` is the visible words,
  action buttons are `action-<id>`, `renderSlot` returns a count, the screen redraws on every store change (keep
  state in `mount`), `put` the whole record, and `ctx.locale` is frozen. Still to fix: when a participant lands a
  planned feature, `test_smoke` (strict base list) and `test_data` (the P0 ideas must be listed) fail; make both
  tolerate a built planned feature. Not done: the print preview hand check, and opening the .ics on a phone.
- 2026-10-16, T4.1: `uv run tools/build.py [--workshop [--banner T]] [--features a,b | --without a,b] [--out DIR]`.
  It reads the boot order from index.html and the features from list.js, and writes 29 hashed inline scripts (735 KB).
  The CSP is `default-src 'none'`, with script hashes only, `style-src 'unsafe-inline'` (feature CSS is injected at run time; CSS
  cannot run code here), `img-src data:`, and `connect-src` set to the origin of `locale.events.api`. `--workshop` inlines
  the `DESK_WORKSHOP` stanza with `connect-src 'none'`. There is no external `data/workshop.js`, because hash-only
  scripts would block it on file://. The manifest link is added at run time, on http(s) only. `Desk.version` is the tag
  or date plus 8 hex of a source hash; use it as the service worker cache key. In the e2e, `--app dist/searchdesk.html` is
  detected as built: 64 routed or self-test cases are skipped, and `test_csp` runs only there. Playwright's
  `wait_for_function` uses eval, so a polling helper replaces it on built files. Tests now open `#ai/fixtureq` by
  name, since load order differs when built. Open: `data/inbox.js` cannot work in a built file (T5.3 decides), and
  `#selftest` is neutral when built. DESIGN 12 could record the style-src and manifest choices.
- 2026-10-16, T4.3: README.md has three parts (job seekers, workshop hosts, developers). Its button words and commands
  were checked against the code, and I ran the workshop build myself (`dist/workshop/searchdesk.html`, connect-src 'none').
  There is no doc for swapping in another city's locale pack beyond "point index.html at your file"; that belongs to the P2 `docs/LOCALE.md`.
- 2026-10-16, T4.2: `.github/workflows/pages.yml` runs the unit tests, then `build.py --cname searchdesk.ryankelln.com`,
  and publishes `dist/` on every push to main. `core/hosting.js` (http(s) only) shows a once-only "add to home screen" hint
  on phones (the dismissal is a per-device localStorage key, not a setting, so it is not exported), asks
  `navigator.storage.persist()` once after the first save that works, and registers `sw.js` only in a built copy. `sw.js` is
  network first for the page (4 s wait, then the saved copy) and cache first for the icons and manifest. Its cache name is
  `searchdesk-<Desk.version>`, stamped by the build, and old caches are dropped on activate. The CSP gains `worker-src 'self'`.
  The maintainer has done DNS and Pages (it resolves to GitHub). The site shows GitHub's 404 until the first push of main.
  In e2e, Playwright's WebKit cannot reload offline under a service worker, so that one step is skipped there; Chromium
  runs the full offline test. Source e2e: 334 pass. Dist e2e: 283 pass. Unit: 338. Build: 25.
- 2026-10-16, events (maintainer's request after the site went live): "Around the city" was the whole Togather feed
  (1,024 events, mostly not about work). Togather's tags are too sparse to filter on (one event in a month has
  `career & job search`), so a locale tier can now have `match` words. Its list shows only events whose title or tags
  have one (at the start of a word, any case; `logic.matchesWords`), with "Show all events here (n more)". Toronto's
  city words keep about 20 events. The events recipe still sees the whole feed. DESIGN 9.x and the locale docs could
  record `match`.
- 2026-10-16, design pass (separate session, `27e28a6`, `c7e17ce`, `89534c4`, `9278147`): this touched `core/` on purpose.
  `core/desk.css` has new tokens for a light and dark palette, shared cards, chips and `sr-only`, and styled inputs, focus and
  pressed states. The phone menu fits all seven tabs at 375 px; the desktop sidebar shows the app name. `core/net.js` now
  cleans HTML entities and "Event location:" text from events (tested), and `tools/snapshot.py` does the same. Fixed: Jobs
  showed "null" with no drafts, and "1 things are kept here". Today marks due-today items with an orange edge, and a
  closing date days away is grey. `tools/screens.py` takes every screen on phone and computer, light and dark
  (`--route` for one screen). Unit: 339 pass. Source e2e: 334 pass, 0 fail, 30 skipped. CONTRACT.md gained 11 lines
  about the shared classes. T5.7 (accessibility) should start from these screenshots.
- 2026-10-16, first phone trial (maintainer): the hosted site on a phone, the "find events" AI route copied into ChatGPT and
  the answer pasted back. It worked well. This covers part of V8 and one chat-route trial. Not yet tried: other chat
  services, the Mac in Chrome (V1–V4), the other recipes.
- 2026-10-16, T6.2: `uv run tools/kit.py` writes `docs/kits/<id>.txt` (4 parts: instruction, CONTRACT.md, example-feature.js,
  the brief); `--check` names stale, missing and orphan kits. Each kit is 25–30k characters (the contract and example
  are about 25k of that), so none is near a size that a free chat might refuse. A unit test (`tests/unit/kits.test.js`)
  runs the check, so any edit to CONTRACT.md, the example or a brief fails until the kits are regenerated and committed.
  The instruction wording is untested in a real chat (T6.3). Unit: 340.
- 2026-10-16, T6.1: `.claude/skills/add-feature/SKILL.md` (about 35 lines, points at the docs) and `docs/BUILDING.md` (path A: an
  agent; path B: a kit in a free chat; a table of the 15 briefs). Gaps: CONTRACT.md does not say to remove an id from
  `Desk.planned` when it is added to `Desk.features` (the skill and BUILDING.md say it); kits and path B do not ask the
  chat for a `checks/<id>.check.js`, so chat builders rely on `#selftest`. Decide in T6.3 whether to ask for one. AGENTS.md
  no longer says the workshop Macs lack Python, Node and git (the maintainer says that was wrong), and its "Mac pitfalls"
  is now a general "Portability" section. Changing CONTRACT.md means regenerating the kits.
- 2026-10-16, decision (maintainer): check files (`checks/<id>.check.js`) are expected when an agent builds a feature (the
  skill does this) and are not asked for in a free-chat kit, where `#selftest` and its source scan are the check. T6.3
  should only revisit this if wrong logic gets past `#selftest` in the trials.
- 2026-10-16, T5.3: `core/inbox.js` (new; inlined by the build like other core files). `Desk.boot` injects `data/inbox.js` the
  way features are injected (silent when missing) and `Desk.start` merges it before features mount: one `batch`, one Undo,
  newer `updated` wins and a tie keeps the page's record. It runs only in the source copy (no `core/desk.js` script tag
  means a built file, which skips it; a preset `window.DESK_INBOX` is ignored there). `settings.inboxSeen` (a device key,
  not exported) holds a fingerprint, so a reload does not merge or toast again; the cost is that clearing all data and
  reloading with the same file does not bring it back (change the file). Left out and counted: unknown types, `settings`,
  deletes, bad or future `updated`, bad ids, a profile with name/email/phone keys, HTML-looking text, `javascript:`,
  records past 500. `data/example.js` gives the Bookkeeper job the fixed id `job_amira_bookkeeper` so a demo can change
  it. `docs/examples/inbox-demo.js` is a 5-record demo for Amira; its `WROTE` time must be set to the real copy time.
  The event note is stored on the event-mark record but the events feature does not show it yet. Unit: 350. Source e2e:
  362 pass. Build tests: 25. The paragraph that T5.3 added to AGENTS.md is in the working tree, mixed with another
  session's edits to that file, and is not in this commit.
- 2026-10-17, Mode A trial with the made-up person (maintainer's request to see the harness act as the AI): events picks written to
  `data/inbox.js` as `suggestion` records (the same shape the chat route saves) landed in "Suggested for you", and Undo
  worked. Not yet looked at by the maintainer: the "Brought in N changes" toast. `data/example.js` now gives all six example
  jobs fixed ids (`job_amira_*`), so an agent can edit them; an AI edit makes a job `source: "ai"`, so "Remove the made-up
  person" leaves it and pressing the button again skips it. Unit: 353. Source e2e: 362 pass (one earlier run showed 9
  failures while another session was editing the repo; two later runs were clean).
- 2026-10-17, found in that trial (to fix, not done): (1) exports leave out every `source: "example"` record on purpose, so an
  agent cannot read the made-up person from an export; it has to read `data/example.js`. (2) The app saves
  `searchdesk-YYYY-MM-DD.json` (`core/io.js`), but AGENTS.md, DESIGN.md and `.gitignore` say `searchdesk-backup-*.json`.
  A real person's export dropped in the folder would not be ignored by git. Fix the docs to the real name, or the name to
  the docs, and make `.gitignore` match both.
- 2026-10-17, agent support for five tools, added after the Mode A trial (no task number; asked for by the maintainer).
  `AGENTS.md` already worked everywhere, so the work was commands, skills and settings. Commands are written once in
  `tools/commands/` and skills in `tools/skills/`; `uv run tools/agent-files.py` copies them to `.opencode/commands/`
  (OpenCode), `.claude/commands/` (Claude Code), `.pi/prompts/` (Pi), `.agents/skills/<name>/SKILL.md` (Codex, Antigravity,
  Pi and OpenCode all read this one folder) and `.claude/skills/` (Claude Code). `opencode.jsonc` sets no model on purpose
  (the free models come and go): it allows the checks and the everyday work, asks before `core/`, `locale/` and `data/`,
  and denies `git push`. `AGENTS.md` gained "For a small or free model" and a line saying whoever runs the model may keep
  what you send it; `BUILDING.md` gained a free-options section and a table of how to type a command per tool. Two tools get
  a command as a skill rather than a command: Codex custom prompts are deprecated and live in `~/.codex/prompts`, which a
  repository cannot share, and Antigravity workflow files stop working on 19 October 2026. Symlinks were tried first and
  rejected: git writes them as plain text files on a Windows checkout, so a broken command would still appear in the menu
  and do the wrong thing. `tests/unit/agent-files.test.js` fails when a copy is stale. Unit: 353. Python: 25. Source e2e: 362.
- 2026-10-17, CI now runs every `checks/<id>.check.js` before the build. It ran the unit tests and the build only, so a
  feature could land with a failing check and stay green until someone opened `#selftest` by hand.
- 2026-10-17, fixes the second item found in the Mode A trial (the export name): `.gitignore` ignores `searchdesk-*.json`,
  `AGENTS.md` and `DESIGN.md` name the file `Desk.io.filename` names, and a new test in `tests/unit/io.test.js` fails unless
  the name the code produces is one git actually ignores and both docs name it. `PLAN.md` item (2) above is now done.
- 2026-10-17, the first item from the Mode A trial is handled without changing what the app does. An agent could not see the
  shape of a saved copy without a real person's data, because every export leaves out the made-up person on purpose, and
  `loadExample` deletes `updated` from the example records so only the live store has it. `node tools/demo-export.js` now
  loads the made-up person the way the page does and hands the state to the real export writer with `source` put back to
  "user", so it prints a copy the page would actually read (`--ids` for one line per record). Nothing is written to disk and
  no real data is read. `AGENTS.md` gained the rule that mattered more: when you change a record that is already on the
  device, give it a NEW `updated`, never the one you read, or the merge sees a tie, keeps the page's record and reports the
  change as "kept". `core/inbox.js` now says why a tie keeps the page's record (the incoming state carries no `device`, and
  `Desk.merge` breaks a tie on that) and warns against adding one. Considered and not done: a dev flag that keeps the
  made-up person in a real export, which would put a hole in "she is not in the copies you save". Unit: 356. Python: 25.
  Source e2e: 362 (not re-run for this change: no file the browser loads is different). PLAN.md item (1) above is now done.
- 2026-10-17, two Pages failures in a row, both worth keeping in mind. (a) `.gitignore` had `screens/` with no leading slash,
  so it matched any folder named screens at any depth and swallowed `.agents/skills/screens/`: the copy existed on disk and
  was never committed, which is why the staleness test passed here and failed on the runner. `dist/` and `screens/` are now
  anchored, and a test asks git whether each generated copy is tracked rather than only whether it is on disk. (b) The reply
  parser test held the parse to a flat 100 ms and read 112 ms on a shared runner while the same commit measured 44 ms here.
  It now compares 100 KB against 400 KB on the same machine (a linear parse costs about 4x, a quadratic one about 16x, so
  the limit is 10x), which tests the thing it was written for instead of the speed of the runner. Also: every action in the
  Pages workflow moved to the first major that declares node24 (checkout v5, setup-node v5, setup-uv v7, configure-pages v6,
  upload-pages-artifact v5, deploy-pages v5), which clears the Node 20 deprecation warnings. Unit: 357. Python: 25.
- 2026-10-17, a note for whoever reads the version string next: `2026.10.17+9632a10b` is not a commit. The suffix is the
  first 8 characters of a sha256 over the sources that went into the build (`tools/build.py`, `default_version`), and there
  are no git tags yet so the front part is the build date. Two builds of the same sources match; a commit that only changes
  docs, tests or tools leaves it untouched.
- 2026-10-17, desktop layout work, while writing the board: **drag and drop needs no contract change**, which had been
  assumed it did. `h()` passes *any* event through `on:` (`core/h.js` is a bare `addEventListener` loop over the keys you
  give it), and `draggable` is not in `BAD_ATTRS`. Proved with a real HTML5 drag in the real app: the drop fired and the
  payload arrived via `dataTransfer`. Documented in CONTRACT.md §4 with the two traps (`dragover` needs
  `preventDefault()`, and the data must travel through `dataTransfer` because a drag handler closes over nothing).
- 2026-10-17, same work: **there is no shared way to remember a preference**, and that is the largest gap found for the
  workshop. What exists is enough to build one — `ctx.store.ext('settings', patch)` persists (merges, and core makes the
  record on the first save), the `settings` slot on the Data screen is empty and free, and prefs travel in the backup
  file — but every feature that wants a setting has to hand-roll the same five things: its own key names, its own control,
  its own validation of a value it does not recognise, its own reset, and its own strings. `bigtext` is briefed to do
  exactly this by hand, and it is one of the T6.3 trial kits, so **T6.3 should run before this is built**: the trial is
  the cheapest way to find out whether hand-rolling a preference is what actually breaks a kit reply. CONTRACT.md §3
  now documents the mechanism and the `localStorage` trap, so at least the failure is explained rather than mysterious.
- 2026-10-17, same work: the sidebar's white stopping at the fold in full-page pictures is a picture artefact, not a bug.
  `.app` is `display: flex; align-items: flex-start` on a wide screen, so the sticky sidebar is exactly one viewport tall,
  which is right. Fixed in `tools/screens.py` for full-page shots only. See commit `f9bca63`.
- 2026-10-18, the person-facing docs are three pages, one per situation, because two pages were carrying three
  readers. `BUILDING.md` is an idea of your own with an agent, `BRIEFS.md` is one of the fourteen already written up
  with an agent, and `KITS.md` is the same fourteen as paste packets for a machine that will not install one. The cut
  before this was by tool (agent page, chat page), so a person with no idea of their own had to read a page about
  somebody else's idea first, and `KITS.md` kept flipping between "the kits are the product" and "the kits are the
  fallback" because it was answering both readers at once. The rule is now where the idea comes from (yours, or
  already written up), and then what the agent can see (a folder, or only what you paste).
  `BUILDING.md` no longer carries the table of fourteen. That duplicate was how `board` survived in it after the
  brief moved to `docs/built/`, and `tests/unit/docs.test.js` now asserts that page offers no ids at all: the menus
  are `BRIEFS.md` and `KITS.md`, set-equal to `docs/features/`, and each of the three pages has to name the other
  two. Verified by putting a `pay` row back into `BUILDING.md`: it fails with "docs/BUILDING.md offers feature ids".
  The kit is described as what it is, the brief packed for something that cannot open a file, rather than as a
  fallback for somebody without an agent: an agent in the folder reads the brief, and nothing is pasted.
  `AGENTS.md`, `README.md` and `tools/skills/add-feature.md` with its generated copies say the same thing now.
  Unit: 375. Kits: 14 up to date. Agent files: 22 up to date.
