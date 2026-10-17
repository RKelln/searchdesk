"""Mode A inbox (T5.3): an agent's data/inbox.js is merged on load as one batch, with a toast and Undo.
The tests write a fixture to data/inbox.js and always remove it afterwards. A built single file never reads it."""

import contextlib
import datetime
import json
import pathlib

from helpers import Skip, assert_no_errors, read_toasts, skip_if_built, wait_for_desk

ROOT = pathlib.Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "data" / "inbox.js"
ALLOW = ["/features/", "Failed to load resource", "/data/inbox.js"]
UNDO = '[data-test="toast-undo"]'


def stamp(minutes_ago=5):
    t = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=minutes_ago)
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def job(id, title, **more):
    r = {"id": id, "type": "job", "title": title, "stage": "saved", "source": "ai", "updated": stamp()}
    r.update(more)
    return r


@contextlib.contextmanager
def inbox_file(records, schema="searchdesk/1"):
    FIXTURE.write_text("window.DESK_INBOX = " + json.dumps({"schema": schema, "records": records}) + ";\n", encoding="utf-8")
    try:
        yield
    finally:
        if FIXTURE.exists():
            FIXTURE.unlink()


def open_app(page, app):
    page.goto(app.url + "#data")
    wait_for_desk(page, started=True)


def reload(page):
    page.evaluate("() => Desk.persist.flush()")
    page.reload()
    wait_for_desk(page, started=True)


def titles(page):
    return sorted(page.evaluate("() => Desk.store.all('job').map(r => r.title)"))


def test_inbox_brings_records_in_as_one_batch_with_undo(page, app):
    skip_if_built(app)
    with inbox_file([job("job_i1", "Cook"), job("job_i2", "Driver"), job("job_i3", "Cleaner")]):
        open_app(page, app)
        page.wait_for_selector('[data-test="toast"]')
        assert read_toasts(page)[0].startswith("Brought in 3 changes from your helper.")
        assert titles(page) == ["Cleaner", "Cook", "Driver"]
        assert page.evaluate("() => Desk.store.get('job_i1').source") == "ai"
        page.click(UNDO)  # one tap takes all three back
        assert titles(page) == []
        assert_no_errors(page, allow=ALLOW)


def test_inbox_reload_does_not_repeat_or_duplicate(page, app):
    skip_if_built(app)
    with inbox_file([job("job_i1", "Cook"), job("job_i2", "Driver")]):
        open_app(page, app)
        page.wait_for_selector('[data-test="toast"]')
        reload(page)
        assert titles(page) == ["Cook", "Driver"]
        assert read_toasts(page) == []
        assert_no_errors(page, allow=ALLOW)


def test_inbox_undo_stays_undone_after_a_reload(page, app):
    skip_if_built(app)
    with inbox_file([job("job_i1", "Cook")]):
        open_app(page, app)
        page.click(UNDO)
        reload(page)
        assert titles(page) == []
        assert read_toasts(page) == []


def test_inbox_new_content_is_brought_in_and_newer_local_data_is_kept(page, app):
    skip_if_built(app)
    open_app(page, app)  # no file yet: nothing happens, and no toast
    assert read_toasts(page) == []
    page.evaluate("() => Desk.store.put({type: 'job', id: 'job_here', title: 'Mine, newer', stage: 'applied'})")
    with inbox_file([job("job_here", "Helper's older copy", updated=stamp(600)), job("job_new", "Fresh one")]):
        reload(page)
        page.wait_for_selector('[data-test="toast"]')
        text = read_toasts(page)[0]
        assert text.startswith("Brought in 1 change from your helper.") and "Kept 1 that was newer here." in text
        assert titles(page) == ["Fresh one", "Mine, newer"]
        assert_no_errors(page, allow=ALLOW)


def test_inbox_leaves_out_bad_records_and_never_runs_markup(page, app):
    skip_if_built(app)
    bad = [
        job("job_x1", "<img src=x onerror=\"window.__pwned=1\">"),
        job("job_x2", "Odd type", type="mystery"),
        job("job_x3", "A tombstone", deleted=True),
        {"id": "profile", "type": "profile", "email": "a@b.example", "updated": stamp(), "source": "ai"},
    ]
    with inbox_file(bad + [job("job_ok", "Good one")]):
        open_app(page, app)
        page.wait_for_selector('[data-test="toast"]')
        text = read_toasts(page)[0]
        assert "4 items from your helper were left out." in text
        assert titles(page) == ["Good one"]
        assert page.evaluate("() => window.__pwned") is None
        assert page.evaluate("() => Desk.store.get('profile')") is None
        assert_no_errors(page, allow=ALLOW)


def test_inbox_with_a_wrong_schema_says_so_and_changes_nothing(page, app):
    skip_if_built(app)
    with inbox_file([job("job_i1", "Cook")], schema="something/else"):
        open_app(page, app)
        page.wait_for_selector('[data-test="toast"]')
        assert "could not be used" in read_toasts(page)[0]
        assert titles(page) == []
        assert not page.locator(UNDO).count()
        assert_no_errors(page, allow=ALLOW)


def test_missing_inbox_is_silent(page, app):
    skip_if_built(app)
    assert not FIXTURE.exists()
    open_app(page, app)
    assert read_toasts(page) == []
    assert_no_errors(page, allow=ALLOW)  # a 404 line for data/inbox.js is fine; nothing else is


def test_built_copy_skips_the_inbox(page, app):
    if not app.built:
        raise Skip("this case is for the built single file")
    requests = []
    page.on("request", lambda r: requests.append(r.url))
    page.add_init_script("window.DESK_INBOX = " + json.dumps({"schema": "searchdesk/1", "records": [job("job_i1", "Cook")]}) + ";")
    open_app(page, app)
    assert read_toasts(page) == []
    assert titles(page) == []
    assert not [u for u in requests if u.endswith("data/inbox.js")]
    assert_no_errors(page, allow=ALLOW)
