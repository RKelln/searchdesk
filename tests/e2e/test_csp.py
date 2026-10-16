"""The built single file carries a Content-Security-Policy <meta> (DESIGN 12; tools/build.py). The browser itself must
refuse any connection to another host, and any script that is not one of the hashed ones.
Run against a built file: uv run tests/e2e/run.py --app dist/searchdesk.html -k csp. On the source page there is no
policy, so these cases are skipped."""

from helpers import Skip, wait_for_desk

OTHER = "https://example.com/steal"
STAGING = "https://staging.toronto.togather.foundation/api/v1/events"

WATCH = """() => { window.__violations = [];
  document.addEventListener('securitypolicyviolation', e => window.__violations.push(e.effectiveDirective)); }"""

FETCH = """async (url) => {
  const wait = () => new Promise(r => setTimeout(r, 150));  // the violation event arrives just after the rejection
  try { await fetch(url, {mode: 'no-cors'}); await wait(); return {rejected: false, violations: window.__violations}; }
  catch (e) { await wait(); return {rejected: true, name: e.name, violations: window.__violations}; }
}"""


def need_built(app):
    if not app.built:
        raise Skip("the source page has no CSP; run with --app dist/searchdesk.html")


def open_built(page, app):
    page.goto(app.url)
    wait_for_desk(page, started=True)
    page.evaluate(WATCH)


def policy(page):
    return page.eval_on_selector('meta[http-equiv="Content-Security-Policy"]', "m => m.content")


def test_csp_fetch_to_another_host_is_blocked(page, app):
    need_built(app)
    hits = []
    page.route("**/*", lambda r: (hits.append(r.request.url), r.fulfill(status=200, body="ok"))
               if "example.com" in r.request.url else r.continue_())
    console = []
    page.on("console", lambda m: console.append(m.text))
    open_built(page, app)
    out = page.evaluate(FETCH, OTHER)
    assert out["rejected"], "the fetch to another host was not refused: %r" % out
    assert "connect-src" in out["violations"], out
    assert not hits, "the request left the page: %r" % hits
    if page.context.browser.browser_type.name == "chromium":
        assert any("Content Security Policy" in t and "connect-src" in t for t in console), console


def test_csp_allows_the_events_host_and_nothing_else_in_connect(page, app):
    need_built(app)
    page.route(STAGING + "*", lambda r: r.fulfill(status=200, body="{}", headers={"access-control-allow-origin": "*"}))
    open_built(page, app)
    out = page.evaluate(FETCH, STAGING + "?x=1")
    assert not out["rejected"] and not out["violations"], out
    csp = policy(page)
    connect = [p for p in csp.split(";") if p.strip().startswith("connect-src")]
    assert connect and connect[0].split() == ["connect-src", "https://staging.toronto.togather.foundation"], csp


def test_csp_scripts_are_hashed_only(page, app):
    need_built(app)
    open_built(page, app)
    csp = policy(page)
    script_src = [p for p in csp.split(";") if p.strip().startswith("script-src")][0]
    assert "unsafe-inline" not in script_src and "unsafe-eval" not in script_src and "http" not in script_src, script_src
    assert csp.startswith("default-src 'none'"), csp
    assert "form-action 'none'" in csp and "base-uri 'none'" in csp, csp
    # An inline script added now is not one of the hashed ones: it must not run.
    page.evaluate("""() => { const s = document.createElement('script'); s.textContent = 'window.__ran = 1';
      document.head.appendChild(s); }""")
    page.wait_for_timeout(150)
    assert page.evaluate("() => window.__ran === undefined")
    found = page.evaluate("() => window.__violations")  # Chromium says script-src-elem, WebKit script-src
    assert any(v.startswith("script-src") for v in found), "no script-src violation was reported: %r" % found
