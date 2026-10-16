from helpers import assert_no_errors, wait_for_desk

BASE_FEATURES = ["home", "jobs", "profile", "events", "help",
                 "recipe-events", "recipe-posting", "recipe-coach", "recipe-custom"]


def test_smoke_loads(page, app):
    page.goto(app.url)
    wait_for_desk(page)
    assert page.title() == "Search Desk", page.title()
    ids = page.evaluate("() => Array.from(window.Desk.features)")
    assert ids == BASE_FEATURES, ids
    # Every listed feature exists now, so a failed load is an error (strict).
    assert_no_errors(page, allow=[])
