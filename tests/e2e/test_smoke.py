from helpers import assert_no_errors, wait_for_desk

BASE_FEATURES = ["home", "jobs", "profile", "events", "help",
                 "recipe-events", "recipe-posting", "recipe-coach", "recipe-custom"]


def test_smoke_loads(page, app):
    page.goto(app.url)
    wait_for_desk(page)
    # The window title names the place when this build is for one, so a bookmark says which. Read the place from
    # the locale pack rather than writing "Toronto" here, so a second pack keeps this true.
    place = page.evaluate("() => (window.DESK_LOCALE || {}).name || ''")
    assert page.title() == ("Search Desk ({})".format(place) if place else "Search Desk"), page.title()
    ids = page.evaluate("() => Array.from(window.Desk.features)")
    # The base features come first, in order; a feature someone added after them is fine.
    assert ids[:len(BASE_FEATURES)] == BASE_FEATURES, ids
    # Every listed feature exists now, so a failed load is an error (strict).
    assert_no_errors(page, allow=[])
