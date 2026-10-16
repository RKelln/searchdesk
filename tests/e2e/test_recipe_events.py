"""Events recipe round trip (T3.4): copy the question, paste a fixture answer, suggestions appear in the Events lane,
and "Star it" stars the event. Uses the committed snapshot with the clock fixed on its first day."""

import re

from helpers import PASTE_BOX, assert_no_errors, desk_eval, wait_for_desk

ALLOW_MISSING = ["/features/", "Failed to load resource"]

INIT = """
(() => {
  window.__copied = [];
  window.__opened = [];
  window.open = (...a) => { window.__opened.push(a); return null; };
  const real = navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', { value: {
    writeText(t) { window.__copied.push(t); return real && real.writeText ? real.writeText(t).catch(() => {}) : Promise.resolve(); },
    readText() { return Promise.resolve(''); },
  }, configurable: true });
})();
"""


def open_ai(page, app, hash="#ai/events"):
    page.add_init_script(INIT)
    page.goto(app.url + hash)
    wait_for_desk(page, started=True)
    page.evaluate("() => Desk.setNow(new Date(2026, 9, 16, 12, 0))")


def paste(page, text):
    box = page.locator(PASTE_BOX)
    box.wait_for(state="visible")
    box.fill(text)
    box.evaluate(
        """(el, text) => {
            const dt = new DataTransfer();
            dt.setData('text/plain', text);
            el.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true}));
        }""",
        text,
    )


def test_events_recipe_needs_the_profile(page, app):
    open_ai(page, app)
    page.wait_for_selector('[data-test="ai-needs"]')
    assert "kind of work" in page.locator('[data-test="ai-needs"]').inner_text()
    assert page.locator('[data-test="ai-copy-open"]').is_disabled()
    page.click('[data-test="ai-needs-fix"]')
    page.wait_for_function("() => location.hash === '#profile'")
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_events_recipe_round_trip_suggest_and_star(page, app):
    open_ai(page, app)
    page.evaluate("() => { Desk.store.put({type: 'profile', roles: 'Office administration'}); }")
    page.wait_for_selector('[data-test="ai-copy-open"]:not([disabled])')
    page.click('[data-test="ai-copy-open"]')
    page.wait_for_selector('[data-test="ai-copied"]')
    text = page.evaluate("() => window.__copied[window.__copied.length - 1]")
    code = re.search(r"DESK-([0-9A-Z]{4})", text).group(1)
    assert "What work: Office administration" in text
    assert "alias | date | title | venue" in text and len(text) <= 6000
    assert "up to 4 from the L list" in text and "NEW | title | url | why" in text
    rows = [l for l in text.split("\n") if re.match(r"^[LC]\d+ \| ", l)]
    assert 2 <= len(rows) <= 40
    # pick one library row and one city row (the example line "L1 | why" is not a data row: it has no date)
    dated = [l for l in rows if re.match(r"^[LC]\d+ \| \d{4}-\d\d-\d\d", l)]
    lib = next(l for l in dated if l.startswith("L"))
    city = next(l for l in dated if l.startswith("C"))
    la, ca = lib.split(" ")[0], city.split(" ")[0]
    ids = desk_eval(page, "Desk.store.all('prompt')[0].aliases")
    assert ids[la] and ids[ca]
    answer = (
        "Here you go:\n```\nDESK-%s\n%s | Helps you meet people who hire clerks.\n%s | A job fair for office work.\n"
        "NEW | Open Door Hub | https://example.org/hub | A drop-in help centre.\n```\n" % (code, la, ca)
    )
    paste(page, answer)
    page.wait_for_selector('[data-test="ai-result-text"]')
    assert page.locator('[data-test="ai-result-text"]').inner_text().startswith("3 suggestions added to Events.")
    sug = desk_eval(page, "Desk.store.all('suggestion').map(s => [s.id, s.kind, JSON.stringify(s.target), s.recipe])")
    sug.sort()
    assert [s[0] for s in sug] == sorted(["s_%s_%s" % (code.lower(), la.lower()), "s_%s_%s" % (code.lower(), ca.lower()),
                                        [s[0] for s in sug if s[1] == "lead"][0]])
    assert {s[1] for s in sug} == {"event", "lead"}
    assert all(s[3] == "events" for s in sug)
    # the Events lane shows the two event suggestions (not the lead)
    page.evaluate("() => { location.hash = '#events'; }")
    page.wait_for_selector('[data-test="suggestion-row"]')
    rows_in_lane = page.eval_on_selector_all('[data-test="suggestion-row"]', "els => els.map(e => e.dataset.eventId)")
    assert sorted(rows_in_lane) == sorted([ids[la], ids[ca]])
    # take the first: it is starred and leaves the lane
    first = page.locator('[data-test="suggestion-row"]').first
    eid = first.get_attribute("data-event-id")
    first.locator('[data-test="suggestion-take"]').click()
    page.wait_for_function("(id) => Desk.store.get('em_' + id) && Desk.store.get('em_' + id).status === 'starred'", arg=eid)
    assert page.locator('[data-test="suggestion-row"]').count() == 1
    assert desk_eval(page, "Desk.store.all('suggestion').filter(s => s.status === 'taken').length") == 1
    # the next question leaves the starred event out
    page.evaluate("() => { location.hash = '#ai/events'; }")
    page.wait_for_selector('[data-test="ai-copy-open"]:not([disabled])')
    page.click('[data-test="ai-copy-open"]')
    page.wait_for_function("() => window.__copied.length === 2 && Desk.store.all('prompt').length === 2")
    second = page.evaluate("() => window.__copied[1]")
    ids2 = desk_eval(page, "Desk.store.all('prompt').sort((a, b) => a.created < b.created ? 1 : -1)[0].aliases")
    assert eid not in ids2.values()
    assert second.count("\n") > 5
    assert_no_errors(page, allow=ALLOW_MISSING)
