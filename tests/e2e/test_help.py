from helpers import assert_no_errors, wait_for_desk

# Other base feature files may not exist yet: browsers log a console error for each missing script.
ALLOW_MISSING = ["/features/", "Failed to load resource"]


def test_help_lists_entries(page, app):
    page.goto(app.url)
    wait_for_desk(page, started=True)
    page.locator('[data-test="nav-help"]').first.click()
    entries = page.locator('[data-test="help-entry"]')
    entries.first.wait_for(state="visible")
    expected = page.evaluate("() => window.DESK_LOCALE.help.length")
    assert entries.count() == expected and expected >= 6, (entries.count(), expected)
    names = page.evaluate("() => window.DESK_LOCALE.help.map(e => e.name)")
    text = page.locator("body").inner_text()
    for n in names:
        assert n in text, n
    # people come before the "on your own" entries
    kinds = page.evaluate("() => window.DESK_LOCALE.help.map(e => e.kind)")
    assert kinds.index("online") > max(i for i, k in enumerate(kinds) if k == "person")
    hrefs = page.locator('[data-test="help-source"]').evaluate_all("els => els.map(e => e.href)")
    assert len(hrefs) == expected
    assert all(u.startswith("https://") for u in hrefs), hrefs
    assert_no_errors(page, allow=ALLOW_MISSING)
