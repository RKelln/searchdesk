"""Events tests (T2.5): tiers, week buttons, star, hide, undo, suggestions, a starred event that left the feed.

Most cases serve a small made-up snapshot through page.route and fix the date (Desk.setNow) at the end of that
file, so they skip WebKit on file:// (it cannot serve routed scripts). One case reads the real committed snapshot."""

import json

from helpers import assert_no_errors, wait_for_desk, read_toasts, skip_if_built

ALLOW_MISSING = ["/features/", "Failed to load resource"]
ROW = '[data-test="event-row"]'
LIB = '[data-test="events-tier-library"]'
CITY = '[data-test="events-tier-city"]'
STARRED = '[data-test="events-starred"]'
SUGGESTED = '[data-test="events-suggested"]'


def ev(id, title, start, tier, end="", url=True):
    return {"id": id, "title": title, "start": start, "end": end, "venue": "Hall " + id,
            "address": "1 Main St, Toronto", "url": ("https://example.org/" + id) if url else "", "tier": tier, "tags": []}


# Fixed "now": Fri Oct 16 2026, noon. This week = Oct 16-22, next week = Oct 23-29.
FAKE = [
    ev("lib1", "Resume Clinic", "2026-10-17T10:00", "library", "2026-10-17T11:30"),
    ev("lib2", "Interview Skills", "2026-10-24T14:00", "library"),
    ev("city1", "Spring Hiring Fair", "2026-10-18T13:00", "city"),
    ev("city2", "Trades Night", "2026-10-30T18:00", "city"),
    ev("old", "Yesterday Meetup", "2026-10-15T18:00", "city"),
]


def snapshot_js(events):
    body = {"generated": "2026-10-16T10:00:00Z", "source": "test", "events": events}
    return ("window.DESK_EVENTS_SNAPSHOT = " + json.dumps(body) + ";\n"
            "if (window.Desk) Desk.setNow(new Date(2026, 9, 16, 12, 0));\n")


def serve(page, events):
    page.route("**/data/events-snapshot.js", lambda r, _q, s=snapshot_js(events):
               r.fulfill(status=200, content_type="application/javascript", body=s))


def routable(page, app):
    skip_if_built(app)  # a built file has no separate feature or data files to fake
    return not (page.context.browser.browser_type.name == "webkit" and app.origin == "file")


def open_events(page, app, events=FAKE):
    serve(page, events)
    requests = []
    page.on("request", lambda r: requests.append(r.url))
    page.goto(app.url + "#events")
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-screen="events"]')
    page._requests = requests


def ids(page, scope):
    return page.eval_on_selector_all(scope + " " + ROW, "els => els.map(e => e.dataset.eventId)")


def marks(page):
    return page.evaluate("() => Desk.store.all('event-mark').map(m => ({eventId: m.eventId, status: m.status, copy: m.copy, id: m.id}))")


def row_button(page, event_id, test, scope=""):
    return page.locator('%s %s[data-event-id="%s"] [data-test="%s"]' % (scope, ROW, event_id, test)).first


def test_events_weeks_and_tiers(page, app):
    if not routable(page, app):
        return
    open_events(page, app)
    # this week is the default; both tiers are listed with the locale's names
    assert ids(page, LIB) == ["lib1"] and ids(page, CITY) == ["city1"], (ids(page, LIB), ids(page, CITY))
    assert "At the library" in page.locator(LIB + " h3").inner_text()
    assert "Around the city" in page.locator(CITY + " h3").inner_text()
    assert page.locator('[data-test="events-week-this"]').get_attribute("aria-pressed") == "true"
    # a row: title, a plain date and time, the venue and an https link
    text = page.locator(ROW).first.inner_text()
    assert "Resume Clinic" in text and "Sat Oct 17, 10am to 11:30am" in text and "Hall lib1" in text, text
    assert page.locator(ROW).first.locator('[data-test="events-link"]').get_attribute("href") == "https://example.org/lib1"
    # next week, then all; the event that is over never shows
    page.click('[data-test="events-week-next"]')
    assert ids(page, LIB) == ["lib2"] and ids(page, CITY) == [], (ids(page, LIB), ids(page, CITY))
    assert page.locator(CITY + " .muted").count() == 1  # an empty tier says so
    page.click('[data-test="events-week-all"]')
    # the city tier has `match` words: "Trades Night" is not about finding work, so it waits behind a button
    assert ids(page, LIB) == ["lib1", "lib2"] and ids(page, CITY) == ["city1"], ids(page, CITY)
    assert page.locator('[data-test="events-matched-city"]').count() == 1
    assert page.locator('[data-test="events-all-library"]').count() == 0  # the library tier has no words
    page.click('[data-test="events-all-city"]')
    assert ids(page, CITY) == ["city1", "city2"] and page.locator('[data-test="events-matched-city"]').count() == 0
    page.click('[data-test="events-all-city"]')
    assert ids(page, CITY) == ["city1"]
    page.click('[data-test="events-all-city"]')
    assert "Yesterday Meetup" not in page.locator("main").inner_text()
    # the snapshot date is shown
    assert "Oct 16" in page.locator('[data-test="events-source"]').inner_text()
    assert not [u for u in page._requests if "togather" in u], page._requests  # no live fetching by default
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_events_star_dismiss_undo(page, app):
    if not routable(page, app):
        return
    open_events(page, app)
    # star: the row moves to Starred, a mark is saved with a copy, and Undo puts it back
    row_button(page, "lib1", "event-star", LIB).click()
    page.wait_for_selector(STARRED)
    assert ids(page, STARRED) == ["lib1"] and ids(page, LIB) == []
    m = marks(page)
    assert len(m) == 1 and m[0]["status"] == "starred" and m[0]["eventId"] == "lib1", m
    assert m[0]["copy"] == {"title": "Resume Clinic", "start": "2026-10-17T10:00", "end": "2026-10-17T11:30",
                            "venue": "Hall lib1", "url": "https://example.org/lib1", "tier": "library"}, m[0]["copy"]
    assert any("Starred" in t for t in read_toasts(page))
    page.click('[data-test="toast-undo"]')
    page.wait_for_function("document.querySelectorAll('[data-test=events-starred]').length === 0")
    assert ids(page, LIB) == ["lib1"] and marks(page) == []
    # star, then unstar from the Starred list
    row_button(page, "lib1", "event-star", LIB).click()
    page.wait_for_selector(STARRED)
    row_button(page, "lib1", "event-star", STARRED).click()
    page.wait_for_function("document.querySelectorAll('[data-test=events-starred]').length === 0")
    assert ids(page, LIB) == ["lib1"] and marks(page) == []
    # hide: gone from the list, Undo brings it back
    row_button(page, "city1", "event-dismiss", CITY).click()
    page.wait_for_function("document.querySelectorAll('%s %s').length === 0" % (CITY, ROW))
    assert [x["status"] for x in marks(page)] == ["dismissed"]
    page.click('[data-test="toast-undo"]')
    page.wait_for_function("document.querySelectorAll('%s %s').length === 1" % (CITY, ROW))
    assert marks(page) == []
    # hide again, then show it from the hidden list
    row_button(page, "city1", "event-dismiss", CITY).click()
    page.wait_for_selector('[data-test="events-hidden-toggle"]')
    page.click('[data-test="events-hidden-toggle"]')
    page.wait_for_selector('[data-test="events-hidden"]')
    assert ids(page, '[data-test="events-hidden"]') == ["city1"]
    page.click('[data-test="events-hidden"] [data-test="event-restore"]')
    page.wait_for_function("document.querySelectorAll('[data-test=events-hidden-toggle]').length === 0")
    assert ids(page, CITY) == ["city1"] and marks(page) == []
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_events_starred_event_survives_a_new_snapshot(page, app):
    if not routable(page, app):
        return
    open_events(page, app)
    row_button(page, "lib1", "event-star", LIB).click()
    page.wait_for_selector(STARRED)
    # the next snapshot no longer has it
    page.unroute("**/data/events-snapshot.js")
    serve(page, [e for e in FAKE if e["id"] != "lib1"])
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector(STARRED)
    assert ids(page, STARRED) == ["lib1"]
    text = page.locator(STARRED).inner_text()
    assert "Resume Clinic" in text and "Hall lib1" in text, text
    assert page.locator(STARRED + ' [data-test="events-link"]').get_attribute("href") == "https://example.org/lib1"
    assert "lib1" not in ids(page, LIB)
    # Home still lists it as a starred event this week
    page.click('[data-test="nav-home"]')
    page.wait_for_selector('[data-test="home-item"][data-kind="event"]')
    assert "Resume Clinic" in page.locator('[data-test="home-item"][data-kind="event"]').inner_text()
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_events_suggested_lane(page, app):
    if not routable(page, app):
        return
    open_events(page, app)
    assert page.locator(SUGGESTED).count() == 0
    page.evaluate("""() => { Desk.store.batch('seed', () => {
      Desk.store.put({type: 'suggestion', id: 's_a', recipe: 'events', code: 'DESK-TEST', kind: 'event', target: 'lib2',
        why: 'Practice for the interview you have booked.', status: 'new', source: 'ai'});
      Desk.store.put({type: 'suggestion', id: 's_b', recipe: 'events', code: 'DESK-TEST', kind: 'event', target: 'city2',
        why: 'Trades are hiring.', status: 'new', source: 'ai'});
      Desk.store.put({type: 'suggestion', id: 's_c', recipe: 'events', code: 'DESK-TEST', kind: 'event', target: 'nothere',
        why: 'Not in the list.', status: 'new', source: 'ai'}); }); }""")
    page.wait_for_selector(SUGGESTED)
    rows = page.locator(SUGGESTED + ' [data-test="suggestion-row"]')
    assert rows.count() == 2, rows.count()  # the one whose event is not in the list is left out
    first = rows.first
    assert "Interview Skills" in first.inner_text()
    assert "Practice for the interview you have booked." in first.inner_text()
    assert first.locator('[data-test="events-ai-mark"]').inner_text() == "From AI"
    # take it: it is starred and the suggestion is marked taken
    first.locator('[data-test="suggestion-take"]').click()
    page.wait_for_selector(STARRED)
    assert ids(page, STARRED) == ["lib2"]
    status = page.evaluate("() => Object.fromEntries(Desk.store.all('suggestion').map(s => [s.id, s.status]))")
    assert status["s_a"] == "taken" and status["s_b"] == "new", status
    page.click('[data-test="toast-undo"]')
    page.wait_for_function("document.querySelectorAll('[data-test=events-starred]').length === 0")
    assert page.evaluate("() => Desk.store.get('s_a').status") == "new"
    # not for me: the suggestion goes away and no mark is made
    page.locator(SUGGESTED + ' [data-event-id="city2"] [data-test="suggestion-dismiss"]').click()
    page.wait_for_function("document.querySelectorAll('[data-test=suggestion-row]').length === 1")
    assert page.evaluate("() => Desk.store.get('s_b').status") == "dismissed" and marks(page) == []
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_events_real_snapshot_shows_both_tiers(page, app):
    """The committed snapshot: fix the date inside its window, then both tiers must list events."""
    page.goto(app.url + "#events")
    wait_for_desk(page, started=True)
    page.evaluate("() => { Desk.setNow(new Date(2026, 9, 20, 10, 0)); location.hash = '#home'; location.hash = '#events'; }")
    page.wait_for_selector('[data-screen="events"]')
    page.click('[data-test="events-week-all"]')
    assert page.locator(LIB + " " + ROW).count() > 0
    few = page.locator(CITY + " " + ROW).count()
    assert 0 < few <= 25, few  # only events about finding work, by the locale's words
    page.click('[data-test="events-all-city"]')
    assert page.locator(CITY + " " + ROW).count() <= 25 and page.locator('[data-test="events-more-city"]').count() == 1
    page.click('[data-test="events-more-city"]')
    assert page.locator(CITY + " " + ROW).count() == 50
    hrefs = page.locator('[data-test="events-link"]').evaluate_all("els => els.map(e => e.href)")
    assert hrefs and all(u.startswith("https://") for u in hrefs), hrefs[:3]
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_events_live_when_switched_on(page, app):
    """With settings.liveEvents on, the page asks the (faked) Togather host, shows the answer, and keeps it."""
    if not routable(page, app):
        return
    item = {"@type": "Event", "@id": "https://staging.toronto.togather.foundation/events/01LIVEEVENT0000000000001",
            "name": "Live Hiring Fair", "startDate": "2026-10-19T10:00:00-04:00", "endDate": "2026-10-19T12:00:00-04:00",
            "location": {"@type": "Place", "name": "Live Hall", "address": {"streetAddress": "2 Main St", "addressLocality": "Toronto"}},
            "description": "Never kept."}
    asked = []

    def answer(route, request):
        asked.append(request.url)
        route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"},
                      body=json.dumps({"items": [item], "next_cursor": "", "timeZone": "America/Toronto"}))

    page.route("https://staging.toronto.togather.foundation/api/v1/events*", answer)
    serve(page, FAKE)
    page.goto(app.url + "#events")
    wait_for_desk(page, started=True)
    page.evaluate("() => { Desk.store.put({type: 'settings', liveEvents: true}); }")
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-event-id="01LIVEEVENT0000000000001"]')
    assert len(asked) == 2 and "keywords=career" in asked[0], asked  # one request per tier
    cached = page.evaluate("() => JSON.parse(localStorage.getItem('searchdesk1:events'))")
    assert cached["events"][0]["title"] == "Live Hiring Fair" and "description" not in cached["events"][0]
    assert "Latest list" in page.locator('[data-test="events-source"]').inner_text()
    # a reload inside 12 hours uses the cache: no new requests
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-event-id="01LIVEEVENT0000000000001"]')
    assert len(asked) == 2, asked
    assert_no_errors(page, allow=ALLOW_MISSING)
