"""Helpers for Search Desk browser tests. See README.md for the data-test conventions."""

import json

TOAST = '[data-test="toast"]'
PASTE_BOX = '[data-test="paste-box"]'



class Monitor:
    """Collects console errors, page errors and failed requests for one page."""

    def __init__(self, page):
        self.console_errors = []
        self.page_errors = []
        self.failed_requests = []
        page.on("console", self._console)
        page.on("pageerror", lambda e: self.page_errors.append(str(e)))
        page.on("requestfailed", lambda r: self.failed_requests.append(
            f"{r.url} ({r.failure})"))
        page.on("response", self._response)

    def _console(self, msg):
        if msg.type == "error":
            self.console_errors.append(msg.text)

    def _response(self, resp):
        if resp.status >= 400:
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
    """Clear localStorage and sessionStorage, then reload so the app starts fresh."""
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
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
