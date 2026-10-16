"""Self-test screen (T1.6). Feature and check files are served by Playwright routes (see test_shell.py).
WebKit on file:// cannot serve faked files through page.route, so those cases run on the other combinations."""

from helpers import assert_no_errors, wait_for_desk
from test_shell import routable

# Missing check files are expected 404s (the browser logs them without the URL, hence "Failed to load resource").
ALLOW = ["/features/", "/checks/", "Failed to load resource"]

GOOD = """
Desk.register({ id: 'good', name: 'Good one', purpose: 'x', types: [],
  logic: { double: function (n) { return n * 2; } },
  mount: function (ctx) { ctx.slot('tab', { id: 'good', label: 'Good', render: function (el) { el.append(ctx.h('p', {}, 'hi')); } }); } });
"""
GOOD_CHECK = "Desk.check('good', function (t, f) { t.eq(f.logic.double(2), 4, 'doubles'); });"

BAD = """
Desk.register({ id: 'bad', name: 'Bad one', purpose: 'x', types: [],
  logic: { f: function () { return 1; } },
  mount: function (ctx) { var d = document.createElement('div'); d.innerHTML = 'x'; } });
"""
BAD_CHECK = "Desk.check('bad', function (t, f) { t.ok(true, 'fine'); });"

FAILING = """
Desk.register({ id: 'failing', name: 'Failing one', purpose: 'x', types: [], logic: {}, mount: function () {} });
"""
FAILING_CHECK = "Desk.check('failing', function (t, f) { t.eq(1, 2, 'one is two'); });"

NOCHECK = "Desk.register({ id: 'nocheck', name: 'No check', purpose: 'x', types: [], mount: function () {} });"


def js(page, pattern, body):
    page.route(pattern, lambda r, _req, b=body: r.fulfill(status=200, content_type="application/javascript", body=b))


def open_selftest(page, app):
    js(page, "**/features/good.js", GOOD)
    js(page, "**/features/bad.js", BAD)
    js(page, "**/features/failing.js", FAILING)
    js(page, "**/features/nocheck.js", NOCHECK)
    js(page, "**/checks/good.check.js", GOOD_CHECK)
    js(page, "**/checks/bad.check.js", BAD_CHECK)
    js(page, "**/checks/failing.check.js", FAILING_CHECK)
    js(page, "**/features/list.js", "Desk.features = ['good','bad','failing','nocheck','ghost']; Desk.planned = [];")
    page.goto(app.url + "#selftest")
    wait_for_desk(page, started=True)
    page.wait_for_function("document.querySelector('[data-test=\"selftest-summary\"]')"
                           " && document.querySelector('[data-test=\"selftest-summary\"]').dataset.status !== 'running'")


def status(page, fid):
    return page.locator('[data-test="selftest-row-%s"]' % fid).get_attribute("data-status")


def test_selftest_green_red_and_neutral(page, app):
    if not routable(page, app):
        return
    open_selftest(page, app)
    assert status(page, "core") == "pass"
    assert status(page, "good") == "pass"
    assert status(page, "bad") == "fail"
    assert "innerHTML" in page.locator('[data-test="selftest-problems-bad"]').inner_text()
    assert status(page, "failing") == "fail"
    assert "one is two" in page.locator('[data-test="selftest-problems-failing"]').inner_text()
    assert status(page, "nocheck") == "none"
    assert status(page, "ghost") == "missing"
    assert page.locator('[data-test="selftest-summary"]').get_attribute("data-status") == "fail"
    assert page.locator('[data-test="selftest-summary"]').inner_text().startswith("2 problems")
    assert_no_errors(page, allow=ALLOW)


def test_selftest_all_good_when_only_good_features(page, app):
    """No routes at all: every base feature file is missing (shown neutrally), the app itself is green."""
    page.goto(app.url + "#selftest")
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-test="selftest-summary"][data-status="pass"]')
    assert status(page, "core") == "pass"
    assert "All good" in page.locator('[data-test="selftest-summary"]').inner_text()
    assert_no_errors(page, allow=ALLOW)
