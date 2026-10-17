"""Helpers for Search Desk browser tests. See README.md for the data-test conventions."""

import json

class Skip(Exception):
    """Raised by a test that cannot run in this setup; the runner prints it as `skip` (not a failure)."""


def skip_if_built(app, why="needs separate feature or data files, which a built single file does not have"):
    if getattr(app, "built", False):
        raise Skip(why)


def csp_safe_waits(page):
    """Playwright's wait_for_function evaluates its expression with eval, which a page with a real CSP (the built
    file) refuses. page.evaluate goes through the debugger and is not blocked, so poll with that instead. Same
    arguments and the same truthy rule. Used by the runner on built files only, so the CSP stays switched on."""
    import time
    from playwright.sync_api import TimeoutError as PWTimeout

    def wait_for_function(expression, arg=None, timeout=None, polling=None):
        limit = (10000 if timeout is None else timeout) / 1000.0
        end = time.time() + limit
        while True:
            value = page.evaluate(expression, arg) if arg is not None else page.evaluate(expression)
            if value:
                return value
            if limit and time.time() > end:
                raise PWTimeout("wait_for_function timed out after %d ms: %s" % (limit * 1000, expression[:200]))
            time.sleep(0.05)

    page.wait_for_function = wait_for_function


TOAST = '[data-test="toast"]'
PASTE_BOX = '[data-test="paste-box"]'



def _is_inbox(url):
    """The optional data/inbox.js is absent on purpose most of the time; the browser's note about it is not an error."""
    return str(url or "").split("?")[0].endswith("/data/inbox.js")


class Monitor:
    """Collects console errors, page errors and failed requests for one page."""

    def __init__(self, page):
        self.console_errors = []
        self.page_errors = []
        self.failed_requests = []
        page.on("console", self._console)
        page.on("pageerror", lambda e: self.page_errors.append(str(e)))
        page.on("requestfailed", lambda r: None if _is_inbox(r.url) else self.failed_requests.append(
            f"{r.url} ({r.failure})"))
        page.on("response", self._response)

    def _console(self, msg):
        if msg.type == "error":
            if _is_inbox(getattr(msg, "location", None) and msg.location.get("url", "")) or "/data/inbox.js" in msg.text:
                return  # the browser's own line for the optional data/inbox.js being absent (T5.3)
            self.console_errors.append(msg.text)

    def _response(self, resp):
        if resp.status >= 400 and not _is_inbox(resp.url):
            self.failed_requests.append(f"{resp.url} (HTTP {resp.status})")

    def problems(self, allow=()):
        """All problems as strings, minus any containing an `allow` substring."""
        out = (["console: " + t for t in self.console_errors]
               + ["pageerror: " + t for t in self.page_errors]
               + ["request: " + t for t in self.failed_requests])
        return [p for p in out if not any(a in p for a in allow)]


def attach_monitor(page):
    page._desk_monitor = Monitor(page)
    return page._desk_monitor


def assert_no_errors(page, allow=()):
    """Fail if the page logged console errors, page errors or failed requests.
    `allow` is a list of substrings for known, expected problems."""
    problems = page._desk_monitor.problems(allow)
    assert not problems, "unexpected browser problems:\n  " + "\n  ".join(problems)


def wait_for_desk(page, started=False, timeout=10000):
    """Wait for window.Desk; with started=True also for Desk.started (set by the shell)."""
    page.wait_for_function("typeof window.Desk === 'object' && window.Desk !== null", timeout=timeout)
    if started:
        page.wait_for_function("window.Desk.started === true", timeout=timeout)


def clear_storage(page):
    """Empty the store and storage, then reload so the app starts fresh.

    A plain localStorage.clear() is undone by persist's pagehide save, so empty the store first."""
    page.evaluate("""() => {
        try { if (window.Desk && Desk.store && Desk.persist) {
            Desk.store.load({schema: 'searchdesk/1', records: {}}); Desk.persist.flush(); } } catch (e) {}
        try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    }""")
    page.reload()


def paste_into_paste_box(page, text, selector=PASTE_BOX):
    """Fill the paste box, then fire a real `paste` event carrying text/plain and an `input` event."""
    box = page.locator(selector)
    box.wait_for(state="visible")
    box.fill(text)
    box.evaluate(
        """(el, text) => {
            const dt = new DataTransfer();
            dt.setData('text/plain', text);
            el.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
            el.dispatchEvent(new Event('input', {bubbles: true}));
        }""",
        text,
    )


def read_toasts(page, selector=TOAST):
    """Return the visible text of every toast, in DOM order."""
    return [t.strip() for t in page.locator(selector).all_inner_texts()]


def desk_eval(page, expr):
    """Evaluate a JS expression in the page (JSON-safe results only)."""
    return json.loads(page.evaluate(f"() => JSON.stringify({expr})"))
