# Search Desk: design

> Repo: https://github.com/RKelln/searchdesk (MIT). Status: design v2, 2026-10-16. Maintainer: Ryan Kelln. Written for
> the people and agents who build and extend it. The work plan is `PLAN.md`; the rules a feature file must follow are
> section 7 (copy them into `CONTRACT.md` in T0.2).
>
> Marked **(verify)** where a browser or service behaviour is assumed and not yet tested. Each one is on the verify
> list in section 15 and has a task in `PLAN.md`.

---

## 1. What it is

A job-search desk you keep on your phone or computer:

- the **jobs** you are tracking, with what to do next and when,
- **local events** worth an evening, starting with the public library's own career sessions,
- an **AI helper** that works with *any* free AI chat by copy and paste,
- a page of **free help from people** (employment counsellors, library coaches, settlement workers), shown before the AI.

It is one HTML file. No account, no server, no install. Your data stays in your browser until you export it.

**Who it is for:** job seekers with little or no money for subscriptions and varied computer skill, many of them
newcomers, many of them phone-first. It also works as **workshop material**: a workshop copy opens with a made-up
person, makes no network requests, and has a menu of features a participant can add with a coding agent.
City-specific content (Toronto first) lives in a swappable **locale pack**, so another city or library can make its
own.

## 2. Principles

Each one decides an argument later. When two conflict, the earlier one wins.

1. **Useful with no AI.** The tracker, events and help page work on their own. AI is optional and service-agnostic.
2. **The free chat route is the main path.** Most users will use AI by copying a question into a free chat and
   pasting the answer back. That round trip gets the most design care: **one tap to copy, one paste to bring it
   back, and nothing else unless something went wrong.** Problems explain themselves; success costs no reading.
3. **AI suggests; the person decides.** Anything from AI arrives as a *suggestion*. Taking one is one tap; ignoring
   it costs nothing. The chat route never edits the person's own records.
4. **Your data is yours.** One tap exports everything as a readable file. It imports back by file or paste. A merge
   never loses newer data, and every bulk change can be undone.
5. **Plain words.** Interface text is at about grade 6, all in one string table, so it can be translated later.
6. **Small and readable.** No dependencies, no framework, and no build step needed to run or extend it. A person or
   an agent can read any feature file in one sitting.
7. **Extensible by beginners.** Every feature is one file that follows one contract. A missing feature breaks
   nothing. Planned features are written up so anyone's agent can offer to build one.
8. **Safe by construction.** Text from AI or a feed is shown as text, never run as HTML or code. The page talks to
   one network host, and the page itself enforces that (section 12).
9. **The process is the product.** Recipes (the instructions sent to AI) are plain text that anyone can change by
   hand or with an AI. The app makes "that was not quite right, so change the instructions and try again" a normal
   step (section 9.11).

## 3. Non-goals

- Real sync across devices. That needs a backend. Export, import and merge cover phone-to-laptop by hand.
- Accounts, a server of ours, analytics, or anything that stores a person's data off their device.
- Scraping job boards, auto-applying, auto-emailing, or any action taken on the person's behalf.
- Resume writing or rewriting as a headline feature. The evidence for most "AI resume optimisation" claims is weak.
  The tool helps people organise, rehearse and choose instead.
- Background alerts. A page cannot run while it is closed, so "alerts" are what Home computes each time it opens.
- Building features through a free chat in v1. A guide for doing that at home comes later (`PLAN.md`, P2).

## 4. Where it runs

| Context | Form | Notes |
|---|---|---|
| Workshop or library computer | the `desk/` folder, `index.html` opened from `file://` in Chrome | classic scripts, no build; features are separate files an agent can add |
| Phone | the hosted copy at a URL, installable to the home screen | single-file build, plus a manifest and a service worker |
| Own computer | the hosted URL, or the single file `searchdesk.html` | |
| An agent with file access (Mode A) | the folder; data comes in through `data/inbox.js` | section 10 |

**Browser facts that shape the code:**

- **On `file://`, Chrome blocks ES modules and blocks `fetch`/XHR of local files.** So scripts are classic
  `<script src>` tags, and local data is shipped as JS (`window.DESK_EXAMPLE = {…}`), never as `.json` that gets
  fetched. Injecting a `<script>` element at runtime works, which is how features load (section 5).
- **On `file://`, Chrome gives every local page the same localStorage.** All keys are therefore namespaced `searchdesk1:`.
- **The hosted copy needs an origin to itself.** A `*.github.io` user site shares one origin, and so one storage
  area, with every other project page under that user. Use a dedicated (sub)domain.
- **iOS deletes storage written by scripts after 7 days without a visit**, unless the site has been added to the
  home screen. Hence an install hint, `navigator.storage.persist()`, and the export nudge.
- **`crypto.randomUUID` needs a secure context** (verify on `file://`). IDs use `crypto.getRandomValues` instead.
- **Writing to the clipboard needs a user gesture** and may fail on `file://` (verify). The fallback selects the
  text in a textarea and calls `execCommand('copy')`. If that also fails, the page says "Press and hold to copy".
- **Shared computers vary.** The first workshop machines are managed Macs (macOS 14) with Chrome as the default
  browser, no Python, Node or git, and a reset at every reboot. Test in Chrome first, then WebKit for iPhones and
  Safari.

## 5. Architecture

```
+---------------------------------------------------------------+
|  Shell: tabs, slots, stubs for missing features, phone layout  |
+---------------------------------------------------------------+
|  Features (one file each; register into slots; read any        |
|  record, write only their own; never call each other)          |
+---------------------------------------------------------------+
|  Core: store · persist · merge · io (export/import)            |
|        prompt · reply parser · recipe host · net · h · strings |
|        selftest                                                |
+---------------------------------------------------------------+
|  Data as JS: locale pack · events snapshot · example person    |
|  · workshop flags · Mode A inbox                               |
+---------------------------------------------------------------+
```

### Files

```
index.html             folder entry: loads core, locale, data, features/list.js, then each listed feature
searchdesk.html        (dist only) the single-file build
core/
  desk.js              Desk namespace, register(), slots, boot, stubs for missing features
  h.js                 safe element builder (text only, safe links)
  strings.js           English interface strings (one table) and t()
  store.js             records, batch, undo, subscribe
  persist.js           localStorage wrapper (try/catch; the app works with no storage at all)
  merge.js             merge two states (pure)
  io.js                export, import, share, copy-as-text, the Data screen
  net.js               the only network code: GET the events host named in the locale pack
  prompt.js            prompt envelope, short codes, alias maps, size budget (pure)
  reply.js             AI reply parser (pure)
  recipes.js           recipe registry and the AI helper screen
  selftest.js          the #selftest panel and the contract scan
  desk.css
features/
  list.js              Desk.features = [...ids to load]; Desk.planned = [...ideas not built yet]
  <id>.js              one feature per file; its CSS and strings are inside it
locale/
  toronto.js           window.DESK_LOCALE: help, sites, AI services, events sources, posting rules
data/
  example.js           made-up person and jobs (window.DESK_EXAMPLE)
  events-snapshot.js   frozen events (window.DESK_EVENTS_SNAPSHOT)
  workshop.js          present only in a workshop copy (window.DESK_WORKSHOP)
  inbox.js             Mode A inbox, written by an agent (optional)
checks/
  run.js               runs <id>.check.js under node (Linux) or osascript (Mac)
  check.sh             Mac wrapper: bash checks/check.sh <id>
  <id>.check.js
docs/
  DESIGN.md  CONTRACT.md  RECIPES.md  PLAN.md
  features/<id>.md     briefs for planned features (section 8.3)
tools/
  build.py             single-file build into dist/ (stdlib Python, run with uv)
  snapshot.py          builds data/events-snapshot.js from the events API
tests/
  unit/*.test.js       node --test, no dependencies
  e2e/                 Playwright (Python via uv), Chromium and WebKit, file:// and http://
AGENTS.md              the contract for any agent working in the repo; CLAUDE.md is the line @AGENTS.md
README.md  LICENSE
```

### Boot order

1. Core scripts load in a fixed order from `index.html` (or inline, in `searchdesk.html`).
2. The locale pack, then the optional data files. A missing optional file is fine, since its `onerror` is a no-op.
3. `features/list.js` loads, then core injects one `<script src="features/<id>.js">` per listed id, in order. If one
   fails to load, `Desk.missing(id)` records it, and the shell shows a stub in its place (section 7.5).
4. `Desk.start()` runs once all scripts have loaded or failed. It loads state, runs the Mode A inbox merge, mounts
   every registered feature, renders the current tab, and sets the hash route (`#home`, `#jobs`, `#selftest`, ...).

**Rendering:** the small, deliberately dumb model. On any store change, the shell re-renders the current screen,
calling each slot's render function with fresh state. Features keep no copy of state, so they cannot go stale.
The data sizes involved (hundreds of records) make this cheap.

## 6. Data

### State

```json
{
  "schema": "searchdesk/1",
  "app": "2026.10.19-abc1234",
  "device": "d7k2q9",
  "records": { "<id>": { "id": "...", "type": "...", "updated": "...", "source": "user" } }
}
```

All records live in one map keyed by id. Every record has:

| Field | Meaning |
|---|---|
| `id` | stable; random (`j_` + 10 base32 characters, with a per-type prefix), or fixed for singletons (`profile`, `settings`) |
| `type` | which feature owns it |
| `updated` | ISO timestamp, set by the store on every write |
| `source` | `user`, `ai`, `example`, `feed` or `import` |
| `deleted` | `true` marks a tombstone (kept so merges carry deletes) |
| `ext` | optional: `{ "<featureId>": {...} }`, fields another feature adds to this record |

**Ownership.** A feature may read any record. It writes only records of the types it declares, and only its own
`ext.<id>` on other records. **Unknown types and unknown `ext` keys are kept and exported untouched**, so an export
from a fuller copy imports into a smaller one without losing anything.

**Caches are not state.** The events feed cache (`searchdesk1:events`) and the undo stack (in memory, with the most recent
step also saved as `searchdesk1:undo`) are rebuilt as needed and never exported.

### Core and base record types

| Type | Owner | Fields |
|---|---|---|
| `profile` (singleton) | profile | `roles` (what work), `field`, `background` (1–2 lines), `area` (part of the city, how far they can travel), `languages`, `replyLanguage` (for AI answers), `availability`, `avoid`. Plus `share: { field: bool }`, which says what may go into AI questions. **No name, email or phone field, on purpose.** |
| `settings` (singleton) | core | `service` (last AI chat used), `lastExport`, `exampleLoaded`, `seenPrivacyNote`, `liveEvents` |
| `job` | jobs | `title`, `org`, `link`, `where`, `stage` (`saved` `applied` `interview` `offer` `closed`), `applied`, `followUp`, `interviewAt`, `closes` (dates), `nextStep` (text), `notes`, `tags`, `asks` (main requirements), `posting` (the posting's text, if pasted; at most 8,000 characters) |
| `event-mark` | events | `eventId`, `status` (`starred` or `dismissed`), `copy: {title, start, end, venue, url, tier}` (so a starred event outlives the feed) |
| `suggestion` | core (recipes) | `recipe`, `code`, `alias`, `kind` (`event`, `lead`, `job-draft`, ...), `target` (event id, or fields), `why`, `status` (`new` `taken` `dismissed`) |
| `prompt` | core (recipes) | `code`, `recipe`, `aliases: { "L3": "<event id>" }`, `created`. The page keeps the last 30. |
| `recipe-edit` | core (recipes) | `recipe`, `text` (the changed instructions), `why`, `versions` (the last 5 texts with dates) |
| `recipe-note` | core (recipes) | `recipe`, `code`, `text` ("could be better" notes), `used` |
| `recipe-custom` | core (recipes) | `name`, `text`, `startsFrom` (`ai` or `job`), `answer` (`none` or `job-notes`) |

### Merge

Pure function `merge(local, incoming) → { state, report }`:

- For each id, the newer `updated` wins. On a tie, the higher `device` string wins, so merging is deterministic and
  idempotent: merging the same file twice changes nothing the second time.
- A tombstone is a record like any other, so a delete wins when it is newer.
- Records with `source: "example"` are never exported and never merged in from a file.
- The report counts what was added, what was updated, and what was kept because it was newer here. The UI says it as
  "Added 3 · Updated 5 · Kept 12 that were newer here", with an **Undo** button.

### Export and import

- **Export:** `searchdesk-YYYY-MM-DD.json`, pretty-printed and readable. On phones the Web Share API offers "send to
  myself" (email, messages, Files); elsewhere it downloads. There is also "Copy as text", for pasting into an email to
  yourself.
- **Import:** pick a file, or paste into the paste box (the page detects JSON state by its `schema`). The size cap is
  5 MB. Bad files get one sentence saying why and change nothing.
- **Nudge:** Home shows "Last saved a copy: 9 days ago" (or "never") when there have been changes since the last
  export, and either 7 days have passed or there are at least 10 records.
- **Example data:** `example`-sourced records come from `data/example.js`. They load automatically in a workshop copy
  (`DESK_WORKSHOP.autoExample`); elsewhere they load only when the person picks "Try with a made-up person".
  "Remove the made-up person" deletes them outright (no tombstones). A copy taken home therefore never mixes the
  made-up person with real data unless they chose that.

### Undo

`store.batch(label, fn)` turns many writes into one undo step. Imports, merges, AI answers and "remove example" are
each a single batch. Undo is offered in a toast for 10 seconds and stays available on the Data screen until the next
batch.

## 7. The feature contract

This section is the source for `docs/CONTRACT.md` and for the contract part of `AGENTS.md`.

### 7.1 A feature is one file

```js
// features/sites.js
Desk.register({
  id: 'sites',                       // matches the file name; lowercase, a-z and hyphens
  name: 'Job sites',                 // plain words, shown to people
  purpose: 'Keep the job sites you use in one place.',
  types: ['site'],                   // record types this feature owns (may be empty)
  uses: ['calendar'],                // optional: other features it adds a nicety to when present
  strings: { addSite: 'Add a site', /* ... */ },
  css: `.sites-list { /* ... */ }`,
  logic: {                           // pure functions only: no DOM, no Desk globals, no time or random
    sortSites(sites) { /* ... */ },
  },
  mount(ctx) {                       // called once at start; register slots here
    ctx.slot('tab', { id: 'sites', label: ctx.t('tabLabel'), render: (el) => { /* ... */ } });
  },
});
```

The file does nothing at load time except call `Desk.register`. Nothing touches the DOM until `mount` runs. That is
what lets `checks/run.js` load the file in `osascript` or `node`, with no page, and test `logic`.

### 7.2 What `ctx` gives a feature

| `ctx.` | What it does |
|---|---|
| `store.all(type)` / `store.get(id)` | read records; tombstones are hidden unless `{withDeleted: true}` |
| `store.put(record)` | create or update a record of an owned type; sets `id` (if missing), `updated`, `source` (default `user`) |
| `store.remove(id)` | tombstone an owned record |
| `store.ext(id, patch)` | set this feature's `ext.<id>` on any record |
| `store.batch(label, fn)` | group writes into one undo step |
| `slot(name, def)` | add UI at a named place (7.3) |
| `h(tag, attrs, ...children)` | build elements safely (7.4) |
| `t(key, vars)` | this feature's strings, then the core strings |
| `ui.toast(text, {undo})`, `ui.confirm(text)`, `ui.go(tab)` | small interface helpers |
| `has(featureId)` | whether another feature is loaded, for soft `uses` |
| `locale` | the locale pack, read-only |
| `now()` | the current time (tests can fix it) |
| `profile()` | the profile record |
| `recipe(def)` | register an AI recipe (section 9) |

### 7.3 Slots

| Slot | Where it shows | `def` |
|---|---|---|
| `tab` | a screen in the main menu | `{id, label, order?, render(el)}` |
| `home` | a block on Home, under "Today" | `{id, order?, render(el)}`; render nothing to hide it |
| `job.panel` | a section in a job's detail view | `{id, title, render(el, job)}` |
| `job.actions` | a button on a job's detail view | `{id, label, run(job)}` |
| `event.actions` | a button on an event row | `{id, label, run(event)}` |
| `settings` | a block on the Data and settings screen | `{id, title, render(el)}` |
| `print` | a section in the printable summary (if `print` is loaded) | `{id, title, render(el)}` |

New slots are added to core, never improvised inside a feature. If a planned feature needs one, its brief says
which, and core adds it before anyone builds the feature.

### 7.4 `h()`: the only way to make elements

- Children that are strings become text nodes. There is no way to pass HTML.
- `href` must be `https:`, `http:` or `mailto:`; anything else is dropped. Links get `rel="noopener noreferrer"` and
  open in a new tab.
- `on: { click: fn }` attaches handlers. `class`, `aria-*`, `data-*` and form attributes pass through.

### 7.5 Rules

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
8. **One file.** No other files except `checks/<id>.check.js` and `docs/features/<id>.md`.

### 7.6 Checks

```js
// checks/sites.check.js
Desk.check('sites', (t, f) => {          // f = the registered feature
  t.ok(f.logic.sortSites([]).length === 0, 'an empty list stays empty');
  t.eq(f.logic.sortSites([{name:'b'},{name:'a'}])[0].name, 'a', 'sites sort by name');
});
```

`checks/run.js <id>` loads the pure core files, then the feature file, then its check file, runs them, and prints
`PASS`/`FAIL` lines and a summary. On a Mac, `bash checks/check.sh <id>` runs it through
`osascript -l JavaScript` (no Python, no Node). The script checks that the id is plain a-z and hyphens and that the
file exists; otherwise it prints a `STOP:` sentence. The in-page self-test (`#selftest`) runs the same checks for
every loaded feature, plus the contract scan and the core's own checks.

### 7.7 How the contract is enforced

- **`AGENTS.md`** is the primary rule, and for most agents most of the time it is enough.
- **The self-test** catches what slips through, everywhere the app runs, whoever wrote the code.
- **In a folder copy a host has set up:** agent permission settings pre-approve edits under `features/` and `checks/`,
  and leave edits to `core/`, `locale/` and `data/` on **ask**, not deny. Core may need a fix nobody anticipated, so
  the person (or whoever is helping) can still say yes. The prompt makes "I am about to change the app's core" a
  visible moment instead of a silent one (verify that the agent honours the settings). `opencode.jsonc` is this
  repo's own version of that setup, so the rule is checkable rather than aspirational: allow `features/*`, `checks/*`
  and `docs/*`, ask for `core/*`, `locale/*`, `data/*` and `index.html`, deny `git push *`.

## 8. Features

### 8.1 Base features (shipped, in `list.js` by default)

| id | Name | What it does |
|---|---|---|
| `home` | Today | **The "alerts":** follow-ups due or overdue, interviews coming up, postings closing soon, suggestions waiting, starred events this week, the backup nudge. Computed every time the page opens. |
| `jobs` | Jobs | List with a stage filter; add or edit a job (title, organisation, link, stage, dates, next step, notes); a one-tap stage change; the job detail hosts `job.panel` and `job.actions`. |
| `profile` | About me | The profile fields with their "send to AI" switches, and a preview of exactly what a question will contain. |
| `events` | Events | Events by date, split into the locale's tiers (Toronto: "At the library" and "Around the city"); This week / Next week / All; star or dismiss; a "Suggested for you" lane fed by the events recipe; refresh (hosted copy). |
| `help` | Free help | People who help for free, from the locale pack, **above any AI**: Employment Ontario, 211, library career coaches, settlement workers, newcomer agencies. Each entry has what it is, how to reach it, and "who it is for". |
| `recipe-events` | AI: events worth going to | section 9.6 |
| `recipe-posting` | AI: turn a posting into a job | section 9.7 |
| `recipe-coach` | AI: practise an interview | section 9.8 |
| `build` | (no tab) | A card on the AI helper screen, in the `ai` slot after "Your own tasks": four steps to adding a feature with a coding tool, that it need not cost anything, and the kit route for people who would rather not install anything. No records and no preferences, so it cannot affect anything. It says what BUILDING.md says, to people who are in the app and have no folder open. |

Core, which cannot be removed: the shell, the Data and settings screen (export, import, share, undo, "remove the
made-up person", storage status, version), the AI helper screen that hosts recipes, and the self-test.

### 8.2 Planned features (the menu)

Each has a brief in `docs/features/<id>.md` (template in 8.3) and an entry in `Desk.planned`, so the page can list
them under "Ideas you could build" and an agent can offer one to someone who arrives with no idea. Reference
versions of some are built and tested, but they are kept out of the workshop copy (`PLAN.md`).

| id | Name | In plain words | Size | Data / slots |
|---|---|---|---|---|
| `sites` | Job sites | Keep the job sites you use in one place, with a note about each. | S | `site` / `tab` |
| `calendar` | Add to calendar | Put an interview or a starred event into your phone's calendar. | S | none / `job.actions`, `event.actions` (makes an `.ics` file) |
| `print` | One-page summary | A page you can print or save as a PDF: this week's jobs, dates and events. | S | none / `tab`, provides `print` |
| `bigtext` | Bigger text | Larger text and stronger contrast, remembered on this device. | S | `ext` on settings / `settings` |
| `pay` | Pay notes | The pay each posting gives, beside the pay you are aiming for. | S | `ext.pay` on job / `job.panel` |
| `checklist` | Posting checklist | What a posting must tell you in Ontario, and whether this one does. | S | `ext.checklist` on job / `job.panel` |
| `reply-clock` | Reply due | After an interview, shows the date the employer should have told you the result by. The number of days is a setting (the locale's default; Ontario: 45; 0 turns it off). | S | `ext` on settings (`replyDays`) / `job.panel`, `home`, `settings` |
| `contacts` | People I met | A short note about people you met, linked to an event or a job. | M | `contact` / `tab`, `job.panel`, `event.actions` |
| `stories` | My examples | Short stories from your work, ready for interview questions; the coach recipe can include them. | M | `story` / `tab` (soft-used by `recipe-coach`) |
| `resumes` | Which resume | Which version of your resume you sent where. | S | `ext.resumes` on job / `job.panel` |
| `board` | Board view | **Built, inside Jobs** (not its own tab): a List/Board choice on the Jobs screen, board by default at 1100px and wider. See `docs/built/board.md`. | — | `ext.jobs` on settings |
| `week` | This week | How many you applied to, followed up and went to this week. No streaks and no scores. | S | none / `home` |
| `recipe-followup` | AI: follow-up message | Drafts a short follow-up or thank-you note for a job. You copy it yourself. | S | recipe, no import |
| `recipe-weekly` | AI: weekly check-in | Sends your open jobs and suggests the next step for each, as suggestions. | M | recipe, `job-next` suggestions |
| `recipe-sites` | AI: sites for my field | Suggests job sites and organisations for your kind of work, as suggestions to add to `sites`. | S | recipe; needs `sites` |

### 8.3 Brief template (`docs/features/<id>.md`)

```
# <Name>  (id: <id>, size: S|M)
In plain words: <one sentence a participant can read aloud>
Why someone wants it: <one or two sentences>
Done when:
- [ ] <observable behaviour, one per line, each one a check or a thing you can see>
Data: <types it owns, or the ext it adds, with field names>
Slots: <which ones>   Soft uses: <features, and what changes when they are present>
Checks to write: <the logic functions and what they must return>
Out of scope: <the obvious extensions not to build now>
Ideas for after: <two or three, for a fast person>
```

### 8.4 Rules come from the locale pack

Job-posting rules differ by place, so the feature code stays generic and the locale pack holds the rules:

```js
postingRules: {
  source: { name: 'O. Reg. 476/24 (Ontario)', url: 'https://www.ontario.ca/laws/regulation/r24476' },
  checklist: [ /* { id: 'pay', label: 'Shows a pay range' }, { id: 'ai', label: 'Says if AI screens applicants' },
                 { id: 'vacancy', label: 'Says if the job is open now' } */ ],
  replyDays: 45,   // days after the last interview by which the employer must give the outcome; 0 = no such rule
}
```

`checklist` and `reply-clock` read these. The person can override `replyDays` in settings (0 turns it off). Every
rule shows its source link, so a person can check it themselves. Toronto's values come from Ontario's 2026 posting
rules. A locale author states their own rules and sources; the code never assumes Ontario.

## 9. The AI helper: the free chat route

This is the hardest design problem in the tool and the biggest uplift for the audience. Section 2's target governs
it: **one tap to copy, one paste to bring back.**

### 9.1 The round trip as the person sees it

1. On the AI screen, pick a task ("Find events worth going to"). The page shows one big button, **"Copy and open
   ChatGPT"** (or whichever service they used last), and a smaller "Just copy". A folded "What will be sent"
   section shows the exact text. It is not a gate.
2. The page copies the question and opens the chat service in a new tab, or its app on a phone. They paste and send.
3. They copy the answer with the chat's own Copy button, come back, and paste into the one big box. **The page reads
   it the moment it is pasted.** There is no Import button to find.
4. A result line appears: "6 suggestions added to Events · Undo". The suggestions sit in their lane, each with its
   reason and a small "from AI" mark. Taking one is one tap.
5. Only if something failed: "2 lines could not be read", with a **"Copy a fix-it message"** button. They paste that
   into the same chat, copy the new answer, and paste it into the same box.

The page remembers the pending question across reloads and app switches, and Home shows "Waiting for an answer:
paste it here" until one arrives.

### 9.2 Recipes

A recipe is a task with a prompt and, optionally, an answer the page reads back. Core does everything common:
codes, aliases, the envelope, copy and open, parsing, saving, idempotency, the fix-it message and undo.

**A recipe has two halves, and they are kept apart on purpose:**

- **The instructions** are plain text with `{placeholders}`, written first in the file. People and AIs change these
  (section 9.11).
- **The code** gathers the data the placeholders need and turns answer lines into suggestions. It changes rarely.

```js
ctx.recipe({
  id: 'events', title: 'Find events worth going to', blurb: '…',
  template: `Pick the events most likely to help this person meet people in their line of work,
or learn something useful for finding work.
About the person:
{profile}
Up to {quotaL} from the library list and up to {quotaC} from the city list. A short list is better than a padded one.
For each, say the concrete connection to their situation.
{items}`,
  placeholders: {                    // shown in the instruction editor, with a plain description each
    profile: 'what you chose to share in About me',
    items: 'the events list',
    quotaL: 'how many library events to pick', quotaC: 'how many city events to pick',
  },
  needs(ctx) { /* plain sentences, e.g. "Add the kind of work you want in About me" */ },
  data(ctx, opts) {                  // fills the placeholders; items get aliases from core
    return { profile: ctx.prompt.profileLines(), quotaL: 4, quotaC: 4,
             items: { header: 'alias | date | title | venue', kinds: { L: libraryRows, C: cityRows } } };
  },
  answer: { L: ['why'], C: ['why'], NEW: ['title', 'url', 'why'] },   // line kinds and fields; null = no answer
                                     // or 'text': take the code block's text whole (improve, custom tasks)
  example: 'L1 | why this one fits, in one sentence',
  apply(lines, ctx) { /* returns suggestions; core saves them as one batch */ },
});
```

Core fills the template (only `{name}` substitution, no logic), puts `{items}` where the template places it (at the
end if the template leaves it out), and **adds the "HOW TO ANSWER" block itself from `answer` and `example`.** So an
edit to the instructions can never break the page's ability to read the answer.

`docs/RECIPES.md` documents this for anyone adding one. A new recipe with code is a planned-feature-sized job. A
new recipe with *no* code is something anyone can make in the app (9.11).

### 9.3 The envelope and the answer format

Every question has the same frame:

```
[A question from Search Desk, a job-search page. Code: DESK-7Q3K]

<task>

<column header, e.g. alias | date | title | venue>
<data lines: alias | facts>

HOW TO ANSWER
Put your whole answer inside one code block.
First line: DESK-7Q3K
Then one line for each pick, like this:
L1 | why this one fits, in one sentence
Write the reasons in <replyLanguage>.
```

The design choices, and why each one is there:

- **Short aliases (`L1`, `C27`, `J3`), not real ids.** The page maps them back through the stored `prompt` record.
  They make the question shorter and invented ids rarer, and they survive copying. The letter carries the tier, so a
  quota ("up to 4 L and up to 4 C") is easy for the model to keep and for the page to check. **Numbers are unique
  across letters** (L1–L20, C21–C40), so a wrong or missing letter still finds the right item.
- **A pipe-separated line format, not JSON.** Nothing to quote, so curly quotes from a rendered page cannot break it.
  An unescaped quote inside a reason cannot break it either, and the line still parses when the model ignores the
  code block. Trial evidence is for JSON lines, so this change needs a trial (V5). The parser still accepts JSON
  lines.
- **Why not TOON** (toon-format/toon)? It is built and benchmarked as a format for *input* to models: "encode it as
  TOON for LLM input". Its benchmarks measure how well models read it, not how reliably free chat models write it,
  and writing it correctly means getting declared row counts and indentation right, which is exactly what breaks
  when someone copies from a rendered chat. The question's data rows are already TOON-shaped (one header naming the
  columns, then one row per item). We borrow that and put a column header above the rows: `alias | date | title |
  venue`. The answer stays in pipe lines. If a trial ever shows models write TOON more reliably, the parser can
  accept it as a third format.
- **The code (`DESK-XXXX`, 4 characters from Crockford base32)** ties an answer to its question. That makes imports
  idempotent and lets an old answer still land correctly.
- **No validator code and no self-check line in the prompt.** Trials showed the model rarely runs code and its
  self-reports are unreliable. The page's parser is the one that counts.
- **Size budget:** 6,000 characters per question. The events slice is at most 40 rows: alias, date, title (80
  characters at most) and venue, with no descriptions. A unit test checks the budget against the example data.

### 9.4 The parser (`core/reply.js`, pure)

It is built to find the answer inside noise, because people paste whatever they managed to copy.

**Repair, don't reject.** Every round trip we avoid is worth more than strictness. A line is rejected only when its
meaning cannot be worked out. A repair that cannot change the meaning (a stray bullet, a missing code, a different
separator) is silent. A repair that could have changed it (a fuzzy title match) is kept, with a small "matched by
name" mark on the suggestion. The fix-it message exists for what is left over.

1. **Normalise:** NFKC; curly quotes to straight; remove non-breaking and zero-width spaces; CRLF to LF.
2. **Pasted the question back by mistake?** If the text contains our "HOW TO ANSWER" header and no answer lines, the
   page says "That is the question. Paste the AI's answer instead."
3. **Find the code** anywhere in the text. The text inside the code block containing it is preferred; failing that,
   everything. The code is looked up among stored prompts:
   - **Found:** use that prompt's aliases, even if it is older than the latest.
   - **Missing:** use the newest prompt whose line kinds match. The result line notes "No code found; used your last
     question."
   - **Unknown:** "This answer is for a question this page does not have (maybe from another device)." Nothing is
     imported.
4. **Clean each line:** strip list markers (`-`, `*`, `•`, `1.`, `1)`), markdown emphasis and backticks, the outer
   pipes of table rows; skip table separator rows.
5. **Match the kind, loosely.** Ignore case throughout.
   - **Aliases** in any common dress: `L3`, `l3`, `L 3`, `L-3`, `L03`, `(L3)`, `[L3]`, `#L3`, `**L3**`, `L3.`
   - **A bare number, or the wrong letter,** resolves by number (they are unique), and the letter is then ignored.
   - **Separators:** `|`, `:`, `-`, `–`, `—`, a tab, or two or more spaces.
   - **Fields** are split on `|`. The last field takes the rest of the line, and missing optional fields are left
     empty.
   - **Keyword kinds** (posting fields) match the recipe's synonyms: `ORG` also accepts `COMPANY` and `EMPLOYER`;
     `WHERE` accepts `LOCATION`; `CLOSES` accepts `DEADLINE` and `APPLY BY`; `PAY` accepts `SALARY` and `WAGE`. They
     are read in any order, and duplicates keep the first.
6. **Repair broken lines:** a line that does not match, directly after one that is short a field or ends in part of
   a URL, is joined to it (first with no space, then with one space), and the join is kept if it then validates. This
   handles the line break inside a URL seen in trial 1. A reason that wrapped onto the next line is joined the same
   way.
7. **No alias at all?** If a line contains an item's title (normalised, at least 12 characters, matching exactly one
   item), it is taken as that item, with the "matched by name" mark.
8. **Accept the old format:** JSON lines or a JSON array (`{"t":"pick","id":…}`), with ids or aliases, and trailing
   commas forgiven.
9. **Validate, fixing what is safe to fix:**
   - Over-long text is cut at 300 characters with "…", not rejected, and control characters are removed.
   - Dates are read from any unambiguous form (`2026-11-02`, `Nov 2`, `2 November 2026`). An ambiguous one (`11/02`)
     becomes "unknown", with the text kept.
   - A URL must have a real hostname (no IP addresses, no credentials). An `http:` link is kept, shown as text and
     not made clickable.
   - The same alias twice keeps the first.
   - Over a kind quota, the first N are kept and the rest are dropped silently.
   - Rejected, with a reason: an alias or number that matches no item, a required field that is missing after
     repair, a URL with no usable host.
10. **Result:** accepted lines (with any repair marks), rejected lines with one plain reason each, and a count of
    ignored prose (not shown).

**Idempotency:** a suggestion's id is `s_<code>_<alias>`, or for a `NEW` line, `s_<code>_<hash of title and url>`.
Pasting the same answer twice says "Already added" and changes nothing. A fix-it answer adds only the lines that
were missing.

### 9.5 Services, copy and open

The locale pack lists the services:

```js
services: [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', account: 'optional', prefill: null },
  { id: 'gemini',  name: 'Gemini',  url: 'https://gemini.google.com/app', account: 'needed', prefill: null },
  { id: 'claude',  name: 'Claude',  url: 'https://claude.ai/new', account: 'needed', prefill: null },
  { id: 'duck',    name: 'Duck.ai', url: 'https://duck.ai/', account: 'none', prefill: null },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com/', account: 'optional', prefill: null },
]
```

- `account` drives a plain label ("no account needed"). The values are the vendors' current terms (verify each
  before shipping).
- `prefill` stays `null` until it is tested: a URL template like `https://chatgpt.com/?q={q}` that pre-fills the
  question, used only when the question is under a tested length. Where it works, it saves the paste step on the way
  out. The clipboard copy happens either way.
- The service picker is a row of buttons. The choice is remembered in `settings.service`.

### 9.6 Recipe: events worth going to (`recipe-events`)

- **Data:** the profile's shared fields, plus upcoming events from the next 3 weeks: `L1`–`L20` from the library
  tier and `C21`–`C40` from the city tier, starred and dismissed ones left out.
- **Task:** "Pick the events most likely to help this person meet people in their line of work or learn something
  useful for finding work. Up to 4 from L and up to 4 from C. A short list is better than a padded one. For each,
  say the concrete connection to their situation." Optional `NEW` lines, 2 at most, only for a real public place or
  programme with an exact https address, and only if certain.
- **Answer:** `L<n> | why`, `C<n> | why`, `NEW | title | https://… | why`.
- **Applying:** event suggestions go to the Events "Suggested for you" lane; taking one stars it. `NEW` lines become
  `lead` suggestions, shown with their domain in plain text and "from AI, not checked"; taking one adds it to `sites`
  if that feature is present, and otherwise a link list on the AI screen.

### 9.7 Recipe: turn a posting into a job (`recipe-posting`)

This cuts typing for people with weak keyboard skills, which is the biggest friction in the tracker.

- **Input:** the person pastes the posting text into the page (cut at 8,000 characters), plus an optional link field
  that the page fills in itself. **The AI never supplies the link.**
- **Answer** (one line per field): `TITLE | …`, `ORG | …`, `WHERE | …`, `CLOSES | YYYY-MM-DD or unknown`,
  `PAY | … or not stated`, `AI-SCREENING | yes, no or not stated`, `ASKS | the three main requirements`,
  `FIT | one sentence on how the profile fits, or "no profile"`.
- **Applying:** one `job-draft` suggestion. Taking it opens the job form pre-filled, the person checks it, and saves.
  The posting text is saved on the job (`posting`), so the coach can use it later. The `PAY` and `AI-SCREENING`
  values go into `ext.checklist` if that feature is present.
- The posting is employer text and is untrusted, but the answer is only short text fields, so an instruction hidden
  in a posting can at worst put odd words in a field the person sees before saving.

### 9.8 Recipe: practise an interview (`recipe-coach`)

The question has two parts, so the reusable part stays small:

- **The coach instructions** are the recipe's template, at most 1,500 characters (the free-tier cap for ChatGPT
  custom instructions), so they fit every service and can be saved as custom instructions or in a project.
- **This interview's context**, which is not counted in the cap:
  - the job: title, organisation, where, and the requirements (`ASKS`) if known;
  - the posting text, cut to 4,000 characters, if `recipe-posting` saved one;
  - the profile's shared fields;
  - `stories`, if that feature is present.

**What the instructions say, in order:**

1. **Research first.** If you can search the web, look up the organisation and this kind of role: what they do,
   anything recent, how they describe their values, and what the job involves day to day. Tell me what you found in
   at most five short lines, with where each came from, and say what you could not check. If you cannot search, say
   so in one line and use only the posting and what I tell you. Never make up facts about the organisation. Then ask
   me if I am ready.
2. **Interview.** Play an interviewer from that organisation, using what you found. One question at a time, then
   wait. Questions fit this job and get harder as we go. If my answer is vague, ask a smaller follow-up question
   rather than answering it for me.
3. **No feedback until I say "finished".** Then give one thing I did well, the answer that most needs work and how
   to improve it, and the three questions you would have asked next.

**Options:** kind (general, behavioural), number of questions (5 by default), research on or off, language.

**No answer to read back.** The screen also shows two tips: "Practise out loud: on a phone, use the chat's voice
mode", and "Keep these instructions: paste the first part into custom instructions or a project, or save it in your
notes". The research step is the person's first lesson in checking: the summary says where each fact came from and
what it could not check, which is a habit worth more than the summary itself.

### 9.9 Privacy in the round trip

- What goes into a question: only profile fields whose `share` is on (by default `roles`, `field`, `area`,
  `languages`, `replyLanguage`), plus the recipe's own data: public event facts; a job's title, organisation, place,
  stage and requirements; and a job's posting text (an employer's public text) for the posting and coach recipes.
  **Never notes, contacts, dates applied or anything free-text that the person did not choose.** The same rule
  limits the placeholders a custom recipe can use (9.11).
- The first time someone copies, one line says: "This text goes to the AI service you pick. It has no name or contact
  details in it. You can see it all under 'What will be sent'." After that it is quiet.
- A workshop copy shows a standing banner: "Practice computer: use the made-up person only."

### 9.10 What makes this work on a phone

- The hosted copy is installable, so the app switch to ChatGPT and back returns to the same page with its state.
- The pending question is saved, so if the browser reloads the page in the background, nothing is lost.
- There are big touch targets for Copy and the paste box, and a **"Paste" button** using `navigator.clipboard.readText`
  where the browser allows it (iOS shows its own Paste bubble), which saves a long-press.

### 9.11 Improving the recipes: the process is the product

What people should take away is not the recipes we wrote. It is the habit: **when something was not as good as it
should be, or you have a better idea, change the instructions, by hand or with an AI, and try again.** The app makes
that a normal, small step, not a developer's job.

- **Edit the instructions.** Every recipe has "Change the instructions". It opens the template in a text box, lists
  its placeholders with a plain description each, and has **Save** and **Back to the original**. A placeholder that
  goes missing gets a warning ("`{items}` is gone, so the AI will not see the events"), not a block.
  - Saved edits are `recipe-edit` records: `recipe`, `text`, `why`, and the last 5 versions. They export with
    everything else, so an improvement travels to the phone.
  - The "HOW TO ANSWER" block is not part of the text, so no edit can break reading the answer (9.2).
- **"Could be better" on every result.** One tap, plus an optional sentence ("It picked events too far from
  Scarborough"). Saved as a `recipe-note` on that recipe, with the question's code. The notes are the raw material
  for the next step, and they are listed under the recipe.
- **"Improve these instructions with AI".** A built-in recipe whose question contains the current instructions, their
  placeholders, and the unused notes. It asks for a rewritten version that keeps every placeholder, changes as little
  as needed, and comes in one code block starting with the code, followed by one line saying what changed.
  - Pasting the answer shows the new text beside the old, with changed lines marked, and **Use this** or **Keep
    mine**. This is the one place in the chat route with a choose step, because it changes every future question.
    Undo and "Back to the original" still apply.
  - The notes it used are marked used.
- **Your own AI tasks** (`recipe-custom`). Anyone can make a new task with no code: a name, the instructions with
  placeholders from the allowed set (`{profile}`, `{job}`, `{posting}`, `{events}`, `{replyLanguage}`), and where it
  starts from (the AI screen, or a job's actions). It gets "Copy and open" like the built-in recipes.
  - The answer kind is either none, or "save the answer to this job's notes" (the code block's text goes into
    `notes`, appended and dated).
  - This is how a prompt that worked once becomes a tool.
- **Share a recipe.** "Copy this recipe" gives plain text (name, instructions, placeholders). Pasting that text into
  the paste box offers to add it as your own task. It is text, not code, so a shared recipe cannot do anything a
  recipe made by hand could not.
- **The same loop for agents and developers.** The template is the first thing in each `features/recipe-*.js`
  file. `docs/RECIPES.md` has a section "Improving a recipe" with the loop:
  1. Write down what was off.
  2. Change one thing.
  3. Run the same question again.
  4. Compare.
  5. Keep the change or revert it.
  6. Put the reason in the commit message.

  The recipe's check tests that the template still has its placeholders and that the instructions fit their
  budgets.

## 10. Mode A: an agent with file access

For demos and for people with a coding agent of their own. Workshop participants use the chat route.

- **Reading:** the person exports to `searchdesk-<date>.json` in the folder (`Desk.io.filename` names it, for example
  `searchdesk-2026-10-16.json`), and the agent reads that. `.gitignore` ignores `searchdesk-*.json` so a real export in
  this folder cannot be committed.
- **Writing:** the agent writes `data/inbox.js` containing `window.DESK_INBOX = { schema, records }`, with its
  records marked `source: "ai"`. On load, the page merges the inbox as one batch ("Brought in 5 changes from your
  helper · Undo"). The merge is idempotent, so a reload does not duplicate anything.
- Unlike the chat route, an agent can edit existing records. That is the agent user's choice, and undo covers it.
- `AGENTS.md` has a section "Working with someone's data": stay synthetic in demos, never invent links, write
  `source: "ai"`, and keep `updated` honest.

## 11. Events

- **Sources:** the locale pack's `events.api` and its `tiers`. Toronto: Togather (`/api/v1/events`). The library tier
  uses `keywords=career & job search`; the city tier is the general feed for the same dates. CORS answers
  `access-control-allow-origin: *` (checked 2026-10-16), so `file://` and any host can read it.
- **Normalised shape:** `{id, title, start, end, venue, address, url, tier, tags}`. `url` is the source listing's link
  where the API gives one, and the Togather page otherwise (check which field holds it, in T2.5).
- **Snapshot:** `tools/snapshot.py` writes `data/events-snapshot.js` with **title, dates, venue, address, link and
  tags, and no descriptions**: republishing the original listings' text is a licence question, and facts and links
  avoid it. The snapshot is the
  fallback everywhere and the only source in a workshop copy (`DESK_WORKSHOP.liveEvents = false`).
- **Live:** on the hosted copy, a refresh happens when the cache is older than 12 hours, and there is a "Get the
  latest" button. There is one request per tier, the results are cached in `searchdesk1:events`, and any failure falls back
  to the cache, then the snapshot, with a one-line note.
- **Start with the staging instance** and switch to production when it is ready; it is one locale setting.

## 12. Security and privacy

- **Network:** `core/net.js` is the only code that makes requests, and only to `locale.events.api`'s host. The built
  file carries a CSP `<meta>`:
  - `default-src 'none'`
  - `script-src` with sha256 hashes of the inline scripts (computed by `build.py`)
  - `style-src 'unsafe-inline'`
  - `img-src data:`
  - `connect-src https://<events host>`
  - `manifest-src 'self'`, `worker-src 'self'`
  - `base-uri 'none'`, `form-action 'none'`

  **The browser itself then blocks any other connection**, which is the strongest sentence in the IT data-flow note.
  The folder copy tries the equivalent `'self'`-based policy (verify on `file://`; drop it there if Chrome refuses
  it, and keep it in the built file).
- **Untrusted text:** feed fields, AI answers, imported files and postings are rendered through `h()` as text. URLs
  from AI are shown by domain, and only `https:` links are made clickable.
- **Imports:** size cap, schema check, unknown fields kept and never rendered except as text.
- **No telemetry, no third-party scripts, no fonts or images from the network.**
- **No personal fields by design:** no name, email or phone in the profile. `contacts` (planned) stores what the
  person types, and that type is never sent to AI.

## 13. Accessibility and language

- Semantic HTML, a label on every input, visible focus, touch targets of at least 44 px, works at a 320 px width and at
  200% zoom, AA contrast, status never shown by colour alone, `prefers-reduced-motion`, `prefers-color-scheme` light
  and dark, and a print stylesheet.
- Interface strings live in `core/strings.js` and in each feature's `strings`, written at about grade 6, with dates
  shown as "Tue Oct 22, 6pm". English in v1; the string tables are the place translations go later. AI answers come
  in the person's chosen `replyLanguage` already.

## 14. Hosting and distribution

- **The repo:** https://github.com/RKelln/searchdesk (MIT). `dist/` is built by `tools/build.py`, which is stdlib
  Python: run it with `uv run tools/build.py`. GitHub Pages publishes it from an Action, on a **dedicated
  subdomain**, `searchdesk.ryankelln.com` (section 4 says why).
- **The hosted copy** is `searchdesk.html` served as `index.html`, plus `manifest.webmanifest`, icons, and `sw.js`, a
  service worker that caches the one file for offline use and updates when the version changes. The service worker
  is feature-detected and never registered on `file://`.
- **Releases** are tagged by date (`2026.10.19`). A workshop copies the folder at a tag, so a session is
  reproducible.
- **The README** speaks to three readers in this order: people looking for work (what it is, the link, how to keep
  your data), libraries and other organisations (running a workshop with it, writing a locale pack), and developers
  (`AGENTS.md`, `docs/`).

## 15. The verify list

Each item has a task in `PLAN.md`. "Mac" means a test Mac in Chrome, then Safari.

| # | What | Where | Blocks |
|---|---|---|---|
| V1 | `file://` in Chrome: classic scripts from subfolders, runtime script injection, `onerror` for a missing file, localStorage across reloads, a `fetch` to Togather, clipboard write and read, a blob download, file-picker import, `crypto.randomUUID` | Mac | core |
| V2 | The CSP `<meta>` on `file://` (folder copy) and when hosted (built file) | Mac plus hosted | security |
| V3 | A coding agent in a folder copy a host has set up (first: Claude Code, desktop app) honours its permission settings (allow for `features/` and `checks/`, ask for the rest) and runs `bash checks/check.sh <id>` with no prompt | Mac | host folder |
| V4 | `osascript -l JavaScript checks/run.js` on macOS 14 (JSC features used by core) | Mac | checks |
| V5 | The pipe-line answer format on free Claude, plus Gemini and ChatGPT if possible: parse rate, quota kept, invented aliases, fix-it round trip (each run spends real chat-service usage) | trial kit | chat route |
| V6 | The size of a real events question against what each free service accepts in one paste | trial kit | chat route |
| V7 | `prefill` URLs per service, and the length each accepts | browser | chat route (nice to have) |
| V8 | iPhone: the hosted copy installs to the home screen, storage persists, the app switch keeps state, Share exports, the Paste button | a phone | phone |
| V9 | The `account` label per service (which ones work signed out today) | browser | help text |
| V10 | The Toronto locale's `postingRules` against O. Reg. 476/24's text (the source link is shown in the app either way) | ontario.ca | Toronto locale copy |
| V11 | Which free chat services can search the web in a normal free chat today (ChatGPT, Gemini, Claude, Copilot, Duck.ai), so the coach's research step and its "if you cannot search" fallback both get exercised | browser | coach help text |
