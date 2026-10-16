"""About me tests (T2.2): fields, share switches, and the "What the AI will see" preview."""

from helpers import assert_no_errors, wait_for_desk

# Other base features may not be built yet; their files 404 and the shell shows stubs.
ALLOW_MISSING = ["/features/", "Failed to load resource"]
PREVIEW = '[data-test="profile-preview"]'


def open_profile(page, app):
    page.goto(app.url + "#profile")
    wait_for_desk(page, started=True)
    page.wait_for_selector(PREVIEW)


def preview_lines(page):
    return page.locator(PREVIEW).inner_text().split("\n")


def field(page, key):
    return page.locator('[data-test="profile-field-%s"]' % key)


def share(page, key):
    return page.locator('[data-test="profile-share-%s"]' % key)


def preview_has(page, word, present=True):
    page.wait_for_function(
        "([w, p]) => document.querySelector('[data-test=\"profile-preview\"]').innerText.includes(w) === p",
        arg=[word, present])


def test_profile_defaults_and_preview(page, app):
    open_profile(page, app)
    # Default switches: these five are on, the rest are off.
    for key in ("roles", "field", "area", "languages", "replyLanguage"):
        assert share(page, key).is_checked(), key
    for key in ("background", "availability", "avoid"):
        assert not share(page, key).is_checked(), key
    # Nothing typed yet: the preview says so.
    assert "Nothing yet" in page.locator(PREVIEW).inner_text()
    field(page, "roles").fill("Office administration")
    field(page, "background").fill("Ten years in an office.")
    field(page, "replyLanguage").fill("English")
    preview_has(page, "English")
    # Background is off by default, so it is not in the preview.
    assert preview_lines(page) == ["What work: Office administration", "Reply language: English"]
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_profile_switch_off_removes_and_on_adds(page, app):
    open_profile(page, app)
    field(page, "roles").fill("Bookkeeping")
    field(page, "field").fill("Finance")
    field(page, "avoid").fill("Night shifts")
    preview_has(page, "Finance")
    assert preview_lines(page) == ["What work: Bookkeeping", "Field: Finance"]
    share(page, "field").uncheck()
    preview_has(page, "Finance", False)
    assert preview_lines(page) == ["What work: Bookkeeping"]
    share(page, "avoid").check()
    preview_has(page, "Night")
    assert preview_lines(page) == ["What work: Bookkeeping", "Avoid: Night shifts"]
    # The preview is the same function the recipes use.
    expected = page.evaluate("() => Desk.prompt.profileLines(Desk.store.get('profile')).join('\\n')")
    assert page.locator(PREVIEW).inner_text() == expected
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_profile_persists_across_reload(page, app):
    open_profile(page, app)
    field(page, "roles").fill("Cook")
    field(page, "area").fill("Scarborough")
    share(page, "area").uncheck()
    preview_has(page, "Scarborough", False)
    page.evaluate("() => Desk.persist.flush()")
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector(PREVIEW)
    assert field(page, "roles").input_value() == "Cook"
    assert field(page, "area").input_value() == "Scarborough"
    assert not share(page, "area").is_checked()
    assert share(page, "roles").is_checked()
    assert preview_lines(page) == ["What work: Cook"]
    rec = page.evaluate("() => Desk.store.get('profile')")
    assert rec["id"] == "profile" and rec["type"] == "profile"
    assert not any(k in rec for k in ("name", "email", "phone"))
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_profile_typing_is_not_disrupted(page, app):
    open_profile(page, app)
    box = field(page, "background")
    box.click()
    text = "I like to work with people. Slow typing check."
    page.keyboard.type(text, delay=15)
    assert box.input_value() == text
    assert page.evaluate("() => document.activeElement.getAttribute('data-test')") == "profile-field-background"
    assert_no_errors(page, allow=ALLOW_MISSING)
