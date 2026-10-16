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
| `[data-test="nav-<id>"]` | nav link for feature `<id>` |
| `[data-test="<feature>-<thing>"]` | anything else, prefixed with the feature id, e.g. `jobs-add`, `jobs-row` |
