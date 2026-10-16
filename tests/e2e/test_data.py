"""Data screen tests (T1.4): export, import by file and by paste, report and Undo, the made-up person."""

import json
import re

from helpers import assert_no_errors, wait_for_desk, paste_into_paste_box

# Base features do not exist yet, so their files 404 (the shell shows stubs).
ALLOW_MISSING = ["/features/", "Failed to load resource"]
REPORT = '[data-test="import-report"]'
FAKE_EXAMPLE = """window.DESK_EXAMPLE = { records: [
  { type: 'profile', field: 'made up' },
  { type: 'job', title: 'Example cook', stage: 'applied' },
  { type: 'job', title: 'Example driver', stage: 'saved' }
] };"""


def open_data(page, app, example=False):
    if example:
        page.add_init_script(FAKE_EXAMPLE)
    page.goto(app.url + "#data")
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-test="export"]')


def make_user_records(page):
    page.evaluate("""() => {
      Desk.store.put({type: 'job', title: 'Line cook', stage: 'applied', followUp: '2026-11-02'});
      Desk.store.put({type: 'job', title: 'Dishwasher', stage: 'saved'});
      Desk.store.put({type: 'profile', field: 'cooking'});
    }""")


def wipe(page):
    """Empty the store and the saved copy, then reload (a plain storage clear is undone by the pagehide save)."""
    page.evaluate("() => { Desk.store.load({schema: 'searchdesk/1', records: {}}); Desk.persist.flush(); }")
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-test="export"]')


def user_titles(page):
    return sorted(page.evaluate("() => Desk.store.all().filter(r => r.type === 'job').map(r => r.title)"))


def export_file(page):
    with page.expect_download() as info:
        page.click('[data-test="export"]')
    dl = info.value
    with open(dl.path(), encoding="utf-8") as f:
        text = f.read()
    return dl.suggested_filename, text


def report_text(page):
    page.wait_for_selector(REPORT + ":not([hidden])")
    return page.locator(REPORT).inner_text()


def test_data_export_clear_import_adds_everything_back(page, app):
    open_data(page, app)
    make_user_records(page)
    name, text = export_file(page)
    assert re.fullmatch(r"searchdesk-\d{4}-\d{2}-\d{2}\.json", name), name
    data = json.loads(text)
    assert data["schema"] == "searchdesk/1"
    assert sorted(r["title"] for r in data["records"].values() if r["type"] == "job") == ["Dishwasher", "Line cook"]
    assert "\n  " in text  # readable, not one line
    # saving a copy is remembered, and is not an undo step
    page.wait_for_function("() => /\\d+ ?(days|day)|today/.test(document.querySelector('[data-test=last-export]').textContent)")
    assert page.evaluate("() => Desk.store.undoLabel()") == "Save"
    wipe(page)
    assert user_titles(page) == []
    page.locator('[data-test="import-file"]').set_input_files(
        files=[{"name": name, "mimeType": "application/json", "buffer": text.encode("utf-8")}])
    assert report_text(page).startswith("Added 3"), report_text(page)
    assert "Everything was added back" in report_text(page)
    assert user_titles(page) == ["Dishwasher", "Line cook"]
    assert page.evaluate("() => Desk.store.all('profile')[0].field") == "cooking"
    # Undo from the report line takes it all away again
    page.click('[data-test="import-undo"]')
    page.wait_for_function("() => Desk.store.all().filter(r => r.type === 'job').length === 0")
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_data_importing_the_same_file_twice_is_nothing_new(page, app):
    open_data(page, app)
    make_user_records(page)
    name, text = export_file(page)
    wipe(page)
    payload = [{"name": name, "mimeType": "application/json", "buffer": text.encode("utf-8")}]
    page.locator('[data-test="import-file"]').set_input_files(files=payload)
    assert report_text(page).startswith("Added 3")
    page.locator('[data-test="import-file"]').set_input_files(files=payload)
    page.wait_for_function("() => document.querySelector('[data-test=import-report]').textContent.startsWith('Nothing new')")
    assert page.locator('[data-test="import-undo"]').count() == 0
    assert user_titles(page) == ["Dishwasher", "Line cook"]
    # the file does not carry this device's own bookkeeping, so a third time is also nothing new
    page.locator('[data-test="import-file"]').set_input_files(files=payload)
    assert report_text(page).startswith("Nothing new")
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_data_remove_made_up_person_keeps_user_records(page, app):
    open_data(page, app, example=True)
    make_user_records(page)
    assert page.locator('[data-test="example-remove"]').count() == 0
    page.click('[data-test="example-try"]')
    page.wait_for_selector('[data-test="example-remove"]')
    assert page.locator('[data-test="example-try"]').count() == 0
    n = page.evaluate("() => Desk.store.all({withDeleted: true}).filter(r => r.source === 'example').length")
    assert n == 2  # the example profile is skipped: this person already has a profile
    assert page.evaluate("() => Desk.store.get('profile').field") == "cooking"
    # a saved copy never holds the made-up person
    assert "Example" not in page.evaluate("() => Desk.io.exportText(Desk.store.state())")
    page.click('[data-test="example-remove"]')
    page.wait_for_selector('[data-test="example-try"]')
    left = page.evaluate("() => Desk.store.all({withDeleted: true}).map(r => [r.type, r.source, !!r.deleted])")
    assert not any(src == "example" for _, src, _ in left), left
    assert not any(dead for _, _, dead in left), left  # no tombstones
    assert user_titles(page) == ["Dishwasher", "Line cook"]
    # Undo (toast) brings the made-up person back
    page.click('[data-test="toast-undo"]')
    page.wait_for_selector('[data-test="example-remove"]')
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_data_made_up_person_alone_then_removed(page, app):
    open_data(page, app, example=True)
    page.click('[data-test="example-try"]')
    page.wait_for_selector('[data-test="example-remove"]')
    assert page.evaluate("() => Desk.store.all().length") == 4  # profile + 2 jobs + settings
    assert page.evaluate("() => Desk.store.get('profile').source") == "example"
    page.click('[data-test="example-remove"]')
    page.wait_for_selector('[data-test="example-try"]')
    assert page.evaluate("() => Desk.store.all({withDeleted: true}).filter(r => r.type !== 'settings').length") == 0
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_data_no_example_data_hides_the_button(page, app):
    page.add_init_script("window.DESK_EXAMPLE = { records: [] };")  # runs before data/example.js, which keeps it
    open_data(page, app)
    assert page.locator('[data-test="example-try"]').count() == 0
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_data_paste_box_imports_a_copy_and_explains_other_text(page, app):
    open_data(page, app)
    make_user_records(page)
    text = page.evaluate("() => Desk.io.exportText(Desk.store.state())")
    wipe(page)
    label = page.locator('label[for="paste-box"]')
    assert label.is_visible()
    paste_into_paste_box(page, text)
    page.wait_for_function("() => document.querySelector('[data-test=import-report]').textContent.startsWith('Added 3')")
    assert user_titles(page) == ["Dishwasher", "Line cook"]
    assert page.locator('[data-test="paste-box"]').input_value() == ""
    # an AI answer goes to the AI helper (T3.3), which says there is no question to match it to; nothing is changed
    paste_into_paste_box(page, "DESK-7Q3K\nL1 | fits you well")
    page.wait_for_function("() => location.hash.startsWith('#ai')")
    page.wait_for_function("() => /no question yet/.test(document.querySelector('[data-test=ai-result-text]').textContent)")
    page.evaluate("() => { location.hash = '#data'; }")
    page.wait_for_selector('[data-screen="data"] [data-test="paste-box"]')
    # something else gets one sentence
    paste_into_paste_box(page, "just some words")
    page.wait_for_function("() => /does not look like/.test(document.querySelector('[data-test=import-report]').textContent)")
    assert user_titles(page) == ["Dishwasher", "Line cook"]
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_data_copy_as_text_and_status_lines(page, app):
    open_data(page, app)
    make_user_records(page)
    page.click('[data-test="copy-text"]')
    # either the clipboard worked (a toast) or the press-and-hold box shows the text
    page.wait_for_function("""() => document.querySelector('[data-test=toast]') ||
        !document.querySelector('[data-test=copy-fallback]').hidden""")
    if page.locator('[data-test="copy-fallback"]:not([hidden])').count():
        assert "searchdesk/1" in page.input_value("#copy-fallback-text")
    else:
        assert "Copied" in page.locator('[data-test="toast"]').first.inner_text()
    assert "never" not in page.locator('[data-test="last-export"]').inner_text()
    assert page.locator('[data-test="storage-status"]').inner_text().startswith("Saved in this browser")
    assert page.locator('[data-test="app-version"]').inner_text() == "Search Desk version dev"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_data_storage_status_when_blocked(page, app):
    page.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } })")
    open_data(page, app)
    assert "not saving" in page.locator('[data-test="storage-status"]').inner_text()
    assert page.locator('[data-test="export"]').is_visible()
    assert_no_errors(page, allow=ALLOW_MISSING)
