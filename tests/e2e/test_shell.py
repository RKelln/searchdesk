"""Shell tests (T1.5). No features/<id>.js files exist in the repo yet, so the base features are
served by Playwright routes as tiny fakes that register a tab (the recipe-* ones register no tab)."""

from helpers import assert_no_errors, wait_for_desk, read_toasts

# Browsers log a console error without the URL for a file that is not there (expected: the stubs cover it).
ALLOW_MISSING = ["/features/", "Failed to load resource"]
BASE = ["home", "jobs", "profile", "events", "help", "recipe-events", "recipe-posting", "recipe-coach"]
TABBED = ["home", "jobs", "profile", "events", "help"]

FAKE = """
Desk.register({
  id: '%(id)s', name: 'Fake %(id)s', purpose: 'A fake.', types: %(types)s,
  mount(ctx) {
    %(body)s
  }
});
"""

TAB = """ctx.slot('tab', { id: '%(id)s', label: 'Fake %(id)s', render(el) {
      el.append(ctx.h('h2', {}, 'Screen %(id)s'));
      %(extra)s
    } });"""

JOBS_EXTRA = """
      el.append(ctx.h('p', {'data-test': 'jobs-count'}, 'Jobs: ' + ctx.store.all('job').length));
      el.append(ctx.h('input', {id: 'jobs-note', type: 'text'}));
      el.append(ctx.h('button', {type: 'button', 'data-test': 'jobs-add', on: {click: () => {
        ctx.store.batch('Add job', () => ctx.store.put({type: 'job', title: 'x'}));
        ctx.ui.toast('Job added.', {undo: true});
      }}}, 'Add'));
"""


def fake_source(fid, mode="ok"):
    if fid.startswith("recipe-"):
        body = "ctx.recipe({id: '%s'});" % fid
    else:
        body = TAB % {"id": fid, "extra": JOBS_EXTRA if fid == "jobs" else ""}
    if mode == "throw":
        body = "throw new Error('mount failed on purpose');"
    types = "['job']" if fid == "jobs" else "[]"
    return FAKE % {"id": fid, "types": types, "body": body}


def serve_fakes(page, failing=None, throwing=None):
    """Serve fake base features. `failing` ids are aborted; `throwing` ids register but throw in mount."""
    for fid in BASE:
        if fid == failing:
            page.route("**/features/%s.js" % fid, lambda r, *_: r.abort())
        else:
            src = fake_source(fid, "throw" if fid == throwing else "ok")
            page.route("**/features/%s.js" % fid,
                       lambda r, _req, s=src: r.fulfill(status=200, content_type="application/javascript", body=s))


def routable(page, app):
    return not (page.context.browser.browser_type.name == "webkit" and app.origin == "file")


def open_app(page, app, **kw):
    serve_fakes(page, **kw)
    page.goto(app.url)
    wait_for_desk(page, started=True)


def test_shell_all_files_missing_shows_stubs(page, app):
    """No routes: base features whose file does not exist yet show as stubs; the rest load. Runs everywhere."""
    page.goto(app.url)
    wait_for_desk(page, started=True)
    missing = []
    for fid in BASE:
        status = page.evaluate("(id) => Desk.featureStatus(id)", fid)
        assert status in ("missing", "ok"), (fid, status)
        if status == "missing":
            missing.append(fid)
            assert page.locator('[data-test="nav-%s"]' % fid).count() == 1, fid
    tabbed_missing = [f for f in missing if not f.startswith("recipe-")]
    if tabbed_missing:
        fid = tabbed_missing[0]
        page.click('[data-test="nav-%s"]' % fid)
        page.wait_for_selector('[data-screen="%s"] [data-test="stub"]' % fid)
        assert "not built yet" in page.locator("main").inner_text()
    page.click('[data-test="nav-data"]')
    page.wait_for_selector('[data-screen="data"]')
    assert "Your data" in page.locator("main").inner_text()
    assert page.evaluate("() => document.documentElement.scrollWidth <= innerWidth")
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_shell_boots_with_every_base_feature(page, app):
    if not routable(page, app):
        return  # WebKit on file:// cannot serve fake files (covered by the all-missing test)
    open_app(page, app)
    assert page.evaluate("() => location.hash") == "#home"
    for fid in TABBED + ["data", "ai"]:
        assert page.locator('[data-test="nav-%s"]' % fid).count() == 1, fid
    assert page.locator('[data-test="stub"]').count() == 0
    assert page.locator('[data-screen="home"]').inner_text().startswith("Screen home")
    for fid in TABBED:
        page.click('[data-test="nav-%s"]' % fid)
        page.wait_for_selector('[data-screen="%s"]' % fid)
        assert page.evaluate("() => location.hash") == "#" + fid
    page.click('[data-test="nav-data"]')
    page.wait_for_selector('[data-screen="data"]')
    assert "Your data" in page.locator("main").inner_text()
    assert_no_errors(page)


def test_shell_each_base_feature_can_fail(page, app):
    if not routable(page, app):
        return
    for failing in BASE:
        p = page.context.new_page()
        p.set_default_timeout(10000)
        errors = []
        p.on("pageerror", lambda e: errors.append(str(e)))
        serve_fakes(p, failing=failing)
        p.goto(app.url + "#" + failing)
        wait_for_desk(p, started=True)
        assert p.locator('[data-test="nav-%s"]' % failing).count() == 1, failing
        p.click('[data-test="nav-%s"]' % failing)
        p.wait_for_selector('[data-test="stub"]')
        assert "not built yet" in p.locator("main").inner_text(), failing
        assert "Fake" not in p.locator("main").inner_text()
        others = [t for t in TABBED if t != failing]
        for fid in others:
            p.click('[data-test="nav-%s"]' % fid)
            p.wait_for_selector('[data-screen="%s"]' % fid)
            assert p.locator('[data-test="stub"]').count() == 0
        p.click('[data-test="nav-data"]')
        p.wait_for_selector('[data-screen="data"]')
        assert "Your data" in p.locator("main").inner_text()
        assert not errors, (failing, errors)
        p.close()


def test_shell_mount_that_throws_becomes_a_stub(page, app):
    if not routable(page, app):
        return
    open_app(page, app, throwing="help")
    page.click('[data-test="nav-help"]')
    page.wait_for_selector('[data-test="stub"]')
    page.click('[data-test="nav-jobs"]')
    page.wait_for_selector('[data-screen="jobs"]')
    assert page.evaluate("() => Desk.featureStatus('help')") == "broken"
    assert_no_errors(page)


def test_shell_unknown_hash_goes_home(page, app):
    if not routable(page, app):
        return
    serve_fakes(page)
    page.goto(app.url + "#nowhere")
    wait_for_desk(page, started=True)
    assert page.evaluate("() => location.hash") == "#home"
    page.evaluate("() => { location.hash = '#nowhere2'; }")
    page.wait_for_selector('[data-screen="home"]')
    assert_no_errors(page)


def test_shell_320_wide_has_no_sideways_scroll(page, app):
    if not routable(page, app):
        return
    page.set_viewport_size({"width": 320, "height": 640})
    open_app(page, app, failing="events")
    for tab in ["home", "jobs", "events", "data", "ai"]:
        page.click('[data-test="nav-%s"]' % tab)
        page.wait_for_selector('[data-screen="%s"]' % tab)
        width = page.evaluate("() => document.documentElement.scrollWidth")
        assert width <= 320, (tab, width)
    page.set_viewport_size({"width": 1100, "height": 700})
    assert page.evaluate("() => document.documentElement.scrollWidth") <= 1100
    assert page.evaluate("() => getComputedStyle(document.querySelector('.tabs')).position") == "sticky"
    assert_no_errors(page, allow=["features/events.js", "Failed to load resource"])


def test_shell_toast_undo_and_rerender(page, app):
    if not routable(page, app):
        return
    open_app(page, app)
    page.click('[data-test="nav-jobs"]')
    page.click('[data-test="jobs-add"]')
    page.wait_for_selector('[data-test="toast"]')
    assert read_toasts(page)[0].startswith("Job added.")
    page.wait_for_function("document.querySelector('[data-test=jobs-count]').textContent === 'Jobs: 1'")
    # a change while the person is typing keeps the typing and the cursor
    page.click("#jobs-note")
    page.keyboard.type("typed")
    page.evaluate("() => Desk.store.put({type: 'job', title: 'other'})")
    page.wait_for_function("document.querySelector('[data-test=jobs-count]').textContent === 'Jobs: 2'")
    assert page.input_value("#jobs-note") == "typed"
    page.keyboard.type("!")
    assert page.input_value("#jobs-note") == "typed!"
    assert page.locator('[data-test="toast-undo"]').count() == 0  # a newer change took its step
    page.click('[data-test="jobs-add"]')
    page.wait_for_function("document.querySelector('[data-test=jobs-count]').textContent === 'Jobs: 3'")
    page.click('[data-test="toast-undo"]')
    page.wait_for_function("document.querySelector('[data-test=jobs-count]').textContent === 'Jobs: 2'")
    assert any("Undone." in t for t in read_toasts(page))
    assert_no_errors(page)


def test_shell_workshop_banner(page, app):
    if not routable(page, app):
        return
    page.add_init_script("window.DESK_WORKSHOP = { banner: 'Practice computer here.' }")
    open_app(page, app)
    assert page.locator('[data-test="banner"]').inner_text() == "Practice computer here."
    assert_no_errors(page)


def test_shell_not_saving_notice(page, app):
    if not routable(page, app):
        return
    page.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } })")
    open_app(page, app)
    assert page.locator('[data-test="not-saving"]').is_visible()
    assert "not saving" in page.locator('[data-test="not-saving"]').inner_text()
    assert_no_errors(page)


def test_shell_old_toast_undo_cannot_undo_a_newer_change(page, app):
    if not routable(page, app):
        return
    open_app(page, app)
    page.click('[data-test="nav-jobs"]')
    page.click('[data-test="jobs-add"]')
    page.wait_for_selector('[data-test="toast-undo"]')
    page.click('[data-test="jobs-add"]')
    page.wait_for_function("document.querySelector('[data-test=jobs-count]').textContent === 'Jobs: 2'")
    # the first toast lost its Undo button; only the newest one has one
    assert page.locator('[data-test="toast-undo"]').count() == 1
    page.click('[data-test="toast-undo"]')
    page.wait_for_function("document.querySelector('[data-test=jobs-count]').textContent === 'Jobs: 1'")
    assert_no_errors(page)
