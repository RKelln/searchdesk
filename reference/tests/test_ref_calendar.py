"""Reference e2e tests for the calendar feature (the brief's "Done when" list, except the by-hand phone check).

Downloads are read the way tests/e2e/test_data.py reads them: expect_download, then dl.path(), then open the file.
Events are served from a made-up snapshot with page.route, so the file is skipped on a built file (no separate
feature or data files) and on WebKit over file://, as in test_events.py."""

from helpers import assert_no_errors, wait_for_desk, skip_if_built, Skip, TOAST

ALLOW_MISSING = ["/features/", "Failed to load resource"]
JOB_BUTTON = '[data-test="action-calendar-job"]'
EVENT_BUTTON = '[data-test="action-calendar-event"]'

EVENTS = [
    {"id": "ev1", "title": "Cook, line; day 2", "start": "2026-10-22T18:30", "end": "",
     "venue": "Hall 1", "address": "1 Main St, Toronto", "url": "https://example.org/ev1", "tier": "city", "tags": []},
    {"id": "ev2", "title": "Job fair", "start": "2026-10-17", "end": "", "venue": "", "address": "",
     "url": "", "tier": "city", "tags": []},
]


def snapshot_js(events):
    import json
    body = {"generated": "2026-10-16T10:00:00Z", "source": "test", "events": events}
    return ("window.DESK_EVENTS_SNAPSHOT = " + json.dumps(body) + ";\n"
            "if (window.Desk) Desk.setNow(new Date(2026, 9, 16, 12, 0));\n")


def routable(page, app):
    skip_if_built(app)
    if page.context.browser.browser_type.name == "webkit" and app.origin == "file":
        raise Skip("WebKit cannot serve routed scripts over file://")


def open_job(page, app, **fields):
    page.goto(app.url + "#jobs")
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-screen="jobs"]')
    page.evaluate("""(fields) => { Desk.store.put(Object.assign({type: 'job', stage: 'interview'}, fields)); }""", fields)
    job_id = page.evaluate("(title) => Desk.store.all('job').find(j => j.title === title).id", fields["title"])
    page.goto(app.url + "#jobs/" + job_id)
    page.wait_for_selector('[data-test="job-detail"]')
    return job_id


def download_text(page, locator):
    with page.expect_download() as info:
        locator.click()
    dl = info.value
    with open(dl.path(), encoding="utf-8", newline="") as f:
        return dl.suggested_filename, f.read()


def lines_of(text):
    return text.split("\r\n")


def test_ref_calendar_job_button_saves_interview_file(page, app):
    page.goto(app.url + "#jobs")
    wait_for_desk(page, started=True)
    open_job(page, app, title="Line cook", org="Maple Cafe", where="1 Main St",
             link="https://example.org/job", interviewAt="2026-10-22T18:30")
    name, text = download_text(page, page.locator(JOB_BUTTON))
    assert name == "interview-Line-cook.ics", name
    lines = lines_of(text)
    assert lines[0] == "BEGIN:VCALENDAR" and text.endswith("END:VCALENDAR\r\n"), text[:80]
    assert "DTSTART:20261022T183000" in lines, lines
    assert "DTEND:20261022T193000" in lines, "a timed entry with no end lasts 1 hour"
    assert "SUMMARY:Interview: Line cook at Maple Cafe" in lines, "the organisation is in the title"
    assert "LOCATION:1 Main St" in lines and "URL:https://example.org/job" in lines
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ref_calendar_job_without_interview_shows_toast(page, app):
    page.goto(app.url + "#jobs")
    wait_for_desk(page, started=True)
    open_job(page, app, title="Dishwasher", org="Bistro")
    page.click(JOB_BUTTON)
    page.wait_for_selector(TOAST + ':has-text("This job has no interview date yet.")')
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ref_calendar_same_job_twice_keeps_one_uid(page, app):
    page.goto(app.url + "#jobs")
    wait_for_desk(page, started=True)
    open_job(page, app, title="Prep cook", org="Diner", interviewAt="2026-10-23")
    _, first = download_text(page, page.locator(JOB_BUTTON))
    _, second = download_text(page, page.locator(JOB_BUTTON))
    uid = [l for l in lines_of(first) if l.startswith("UID:")]
    assert uid and uid == [l for l in lines_of(second) if l.startswith("UID:")], uid
    assert "DTSTART;VALUE=DATE:20261023" in lines_of(first), "a date with no time is all day"
    assert "DTEND;VALUE=DATE:20261024" in lines_of(first), "an all-day entry ends the next day"


def test_ref_calendar_event_row_saves_escaped_file(page, app):
    routable(page, app)
    page.route("**/data/events-snapshot.js", lambda r, _q: r.fulfill(
        status=200, content_type="application/javascript", body=snapshot_js(EVENTS)))
    page.goto(app.url + "#events")
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-screen="events"]')
    row = '[data-test="event-row"][data-event-id="ev1"] ' + EVENT_BUTTON
    name, text = download_text(page, page.locator(row))
    assert name.endswith(".ics") and "/" not in name, name
    lines = lines_of(text)
    assert "SUMMARY:Cook\\, line\\; day 2" in lines, "commas and semicolons are escaped"
    assert "LOCATION:Hall 1\\, 1 Main St\\, Toronto" in lines, lines
    assert "URL:https://example.org/ev1" in lines
    assert "DTSTART:20261022T183000" in lines and "DTEND:20261022T193000" in lines
    all_day = '[data-test="event-row"][data-event-id="ev2"] ' + EVENT_BUTTON
    _, text2 = download_text(page, page.locator(all_day))
    assert "DTSTART;VALUE=DATE:20261017" in lines_of(text2) and "DTEND;VALUE=DATE:20261018" in lines_of(text2)
    assert_no_errors(page, allow=ALLOW_MISSING)
