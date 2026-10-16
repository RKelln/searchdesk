# Browser tests

Run all: `uv run tests/e2e/run.py`. Options: `-k NAME`, `--engine chromium|webkit`, `--origin file|http`,
`--headed`, `--app dist/searchdesk.html` (default `index.html`).

Each `tests/e2e/test_*.py` holds `def test_*(page, app)` functions. They run on chromium and webkit, from `file://`
and from a local http server, each in a fresh browser context (empty storage). `app.url` is the page to open;
`app.origin` is `file` or `http`. A WebKit that cannot start is reported SKIPPED with the reason.

Helpers are in `helpers.py`: `wait_for_desk(page, started=False)`, `clear_storage(page)`,
`paste_into_paste_box(page, text)`, `read_toasts(page)`, `assert_no_errors(page, allow=())`.
Every test should end with `assert_no_errors(page)` (console errors, page errors, failed requests).

## data-test selectors

Features that tests need to reach put a `data-test` attribute on the element (via `h()`: `{ 'data-test': 'toast' }`).
Do not change a name once used. Do not select by visible text, since text lives in the string table.

| Selector | Element |
|---|---|
| `[data-test="paste-box"]` | the paste textarea (T1.4 import, T3.3 reply paste) |
| `[data-test="toast"]` | each toast, one element per message (an Undo button inside uses `[data-test="toast-undo"]`) |
| `[data-test="export"]`, `share`, `copy-text`, `copy-fallback` | Data screen: save to a file, Web Share (only where supported), copy as text, the press-and-hold box |
| `[data-test="import-file"]`, `paste-button`, `import-report`, `import-undo` | Data screen: file picker, the Paste button, the result line, its Undo button |
| `[data-test="example-try"]`, `example-remove` | Data screen: add or remove the made-up person |
| `[data-test="storage-status"]`, `app-version`, `last-export` | Data screen: saving status, version line, "Last saved a copy" line |
| `[data-test="help-entry"]`, `help-source`, `help-status`, `help-classes` | Help tab: one per entry (with `data-help-id`), its source link, the status line, the library-classes line |
| `[data-test="profile-field-<key>"]`, `profile-share-<key>`, `profile-preview` | About me: the input for a profile field, its "Send to AI" checkbox, and the "What the AI will see" box (keys: roles, field, background, area, languages, replyLanguage, availability, avoid) |
| `[data-test="job-add"]`, `job-form`, `job-title`, `job-save`, `job-cancel`, `job-problem` | Jobs: add button, form, title input, save, cancel, the problem line. Other inputs are `job-org`, `job-link`, `job-where`, `job-applied`, `job-followup`, `job-closes`, `job-interviewdate`, `job-interviewtime`, `job-nextstep`, `job-notes`, and the stage select `job-stage` |
| `[data-test="job-row"]` (with `data-id`), `job-open`, `job-stage-<stage>`, `stage-filter-<stage or all>`, `job-empty`, `job-next` | Jobs list: a row, its open button, the stage buttons (list rows and detail), the filter buttons (each ends with its count), the empty line, the next-date line |
| `[data-test="job-detail"]`, `job-detail-title`, `job-edit`, `job-delete`, `job-back`, `job-link`, `job-missing`, `job-actions` | Jobs detail view and its buttons. Routes: `#jobs`, `#jobs/new`, `#jobs/<id>`, `#jobs/<id>/edit` |
| `[data-test="home-item"]` (with `data-kind`), `home-open`, `home-empty`, `home-step-job`, `home-step-profile`, `home-step-help`, `home-nudge`, `home-nudge-go` | Home: one row per thing that needs you (kinds: followUp, interview, closes, event, suggestions, question) and its button, the empty state and its three step buttons, the backup reminder and its button |
| `[data-test="ai-task-<id>"]`, `ai-needs`, `ai-needs-fix`, `ai-service` (buttons have `data-service`), `ai-opt-<optionId>` | AI helper: a task button, the "what is missing" block and its fix button, the service picker, a recipe's option select |
| `[data-test="ai-copy-open"]`, `ai-copy`, `ai-copied`, `ai-copy-fallback`, `ai-open-link`, `ai-privacy`, `ai-preview` (the details; text in `ai-preview-text`) | AI helper: Copy and open, Just copy, the status after a copy, the press-and-hold box when copying failed, the link to open the chat yourself, the first-copy privacy line, "What will be sent" |
| `[data-test="ai-pending"]` (with `data-code`), `ai-pending-clear` | AI helper: the waiting-for-an-answer card and its button. The paste box there is `paste-box` (with `paste-button`) |
| `[data-test="ai-result"]`, `ai-result-text`, `ai-note`, `ai-undo`, `ai-problem`, `ai-rejected`, `ai-fixit`, `ai-fixit-status`, `ai-fixit-fallback` | AI helper: the result block, its line, notes, Undo, the unreadable-lines sentence and list, "Copy a fix-it message" and its status |
| `[data-test="ai-better"]`, `ai-better-text`, `ai-better-save`, `ai-better-done` | AI helper: "Could be better", its optional sentence, Save, the thanks line |
| `[data-test="ai-copy-<partId>"]`, `ai-part-copied`, `ai-part-fallback`, `ai-tips`, `action-coach` | AI helper: a recipe's extra copy button (`copies`, e.g. `ai-copy-instructions`), its status line and press-and-hold box, the tips list; the job button "Practise an interview for this job" |
| `[data-test="event-row"]` (with `data-event-id`), `event-star`, `event-dismiss`, `event-restore`, `events-link` | Events: one row per event, its Star / Unstar and Hide buttons (Unstar sits in the Starred list), Show again (hidden list), the "See the listing" link |
| `[data-test="events-week-this"]`, `events-week-next`, `events-week-all`, `events-tier-<id>` (`library`, `city`), `events-starred`, `events-suggested`, `events-source`, `events-more-<tier>`, `events-hidden-toggle`, `events-hidden` | Events: the week buttons (`aria-pressed`), the tier sections, the Starred and Suggested for you sections, the "list saved on" line, Show more, the hidden-events toggle and list |
| `[data-test="suggestion-row"]` (with `data-event-id`), `suggestion-take`, `suggestion-dismiss`, `events-ai-mark` | Events, "Suggested for you": a row, "Star it", "Not for me", the "From AI" mark |
| `[data-test="nav-<id>"]` | nav link for feature `<id>` |
| `[data-test="<feature>-<thing>"]` | anything else, prefixed with the feature id, e.g. `jobs-add`, `jobs-row` |

## AI helper tests (`test_ai.py`)

No real recipe exists yet, so the test adds a test-only feature with an init script that runs on `DOMContentLoaded`,
before the shell boots (works on file:// in WebKit too, unlike `page.route`). The same script records every clipboard
write in `window.__copied` and every `window.open` in `window.__opened` (and returns null), makes `readText` return
`window.__clip`, and `window.__failCopy = true` makes both copy routes fail. Read what was copied from `__copied`
instead of the real clipboard, since WebKit does not grant clipboard permissions.

## Events tests (`test_events.py`)

The data comes from `data/events-snapshot.js`. Cases serve a small made-up snapshot through `page.route` and fix the
date by adding `Desk.setNow(...)` to the end of that script, so they skip WebKit on `file://` like the shell cases.
One case reads the real committed snapshot (it fixes the date inside the snapshot's window, 2026-10-20). Live events
are tested by faking the Togather host with `page.route` after setting `settings.liveEvents`.
