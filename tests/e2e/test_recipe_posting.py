"""Posting recipe round trip (T3.5): paste a posting, copy the question, paste a fixture answer with the code, Take it,
Save. The saved job keeps the posting in `posting` and the requirements in `asks`."""

import re

from helpers import PASTE_BOX, assert_no_errors, desk_eval, wait_for_desk

ALLOW_MISSING = ["/features/", "Failed to load resource"]

INIT = """
(() => {
  window.__copied = [];
  window.open = () => null;
  const real = navigator.clipboard;
  Object.defineProperty(navigator, 'clipboard', { value: {
    writeText(t) { window.__copied.push(t); return real && real.writeText ? real.writeText(t).catch(() => {}) : Promise.resolve(); },
    readText() { return Promise.resolve(''); },
  }, configurable: true });
})();
"""

POSTING = (
    "Accounts Payable Clerk, Northside Foods, Scarborough.\n"
    "We need someone with three years of AP experience, Excel and good English. "
    "Apply by November 2, 2026.\n"
)


def open_ai(page, app, hash="#ai/posting"):
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


def copy_question(page, posting=POSTING, link="https://jobs.example.org/ap-clerk"):
    page.wait_for_selector('[data-test="ai-in-posting"]')
    assert page.locator('[data-test="ai-copy"]').is_disabled()
    assert "Paste the job posting" in page.locator('[data-test="ai-needs"]').inner_text()
    page.fill('[data-test="ai-in-posting"]', posting)
    page.wait_for_selector('[data-test="ai-copy"]:not([disabled])')
    page.fill('[data-test="ai-in-link"]', link)
    page.click('[data-test="ai-copy"]')
    page.wait_for_selector('[data-test="ai-copied"]')
    return page.evaluate("() => window.__copied[window.__copied.length - 1]")


def test_posting_round_trip_to_a_saved_job(page, app):
    open_ai(page, app)
    text = copy_question(page)
    code = re.search(r"DESK-([0-9A-Z]{4})", text).group(1)
    assert "Accounts Payable Clerk, Northside Foods" in text
    assert "TITLE | " in text and "AI-SCREENING | " in text
    assert "jobs.example.org" not in text  # the link is not sent
    answer = (
        "Here you go:\n```\nDESK-%s\nTITLE | Accounts Payable Clerk\nORG | Northside Foods\nWHERE | Scarborough, ON\n"
        "CLOSES | 2026-11-02\nPAY | not stated\nAI-SCREENING | not stated\n"
        "ASKS | Three years of AP; Excel; Good English\nFIT | Your AP years match.\nLINK | https://made-up.example/x\n```\n" % code
    )
    paste(page, answer)
    page.wait_for_selector('[data-test="ai-result-text"]')
    assert page.locator('[data-test="ai-result-text"]').inner_text().startswith("1 suggestion added to Jobs.")
    sug = desk_eval(page, "Desk.store.all('suggestion').map(s => [s.kind, s.status, s.recipe])")
    assert sug == [["job-draft", "new", "posting"]]
    # paste again: nothing new
    paste(page, answer)
    page.wait_for_function("() => /Already/.test(document.querySelector('[data-test=\"ai-result-text\"]').innerText)")
    assert desk_eval(page, "Desk.store.all('suggestion').length") == 1
    # Take it opens the form filled in
    page.click('[data-test="posting-take"]')
    page.wait_for_selector('[data-test="job-form"]')
    assert page.input_value('[data-test="job-title"]') == "Accounts Payable Clerk"
    assert page.input_value('[data-test="job-org"]') == "Northside Foods"
    assert page.input_value('[data-test="job-where"]') == "Scarborough, ON"
    assert page.input_value('[data-test="job-closes"]') == "2026-11-02"
    assert page.input_value('[data-test="job-link"]') == "https://jobs.example.org/ap-clerk"
    page.click('[data-test="job-save"]')
    page.wait_for_selector('[data-test="job-detail"]')
    job = desk_eval(page, "Desk.store.all('job')[0]")
    assert job["title"] == "Accounts Payable Clerk"
    assert job["link"] == "https://jobs.example.org/ap-clerk"  # what the person typed, not the AI's
    assert "Excel and good English" in job["posting"]
    assert job["asks"] == ["Three years of AP", "Excel", "Good English"]
    assert job["closes"] == "2026-11-02"
    assert desk_eval(page, "Desk.store.all('suggestion')[0].status") == "taken"
    # the posting and asks show on the detail view
    assert "Excel" in page.locator('[data-test="job-detail"]').inner_text()
    # the draft lane is gone from the list
    page.evaluate("() => { location.hash = '#jobs'; }")
    page.wait_for_selector('[data-test="job-list"]')
    assert page.locator('[data-test="job-drafts"]').count() == 0
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_unknown_closing_date_stays_empty_and_the_lane_survives_a_reload(page, app):
    open_ai(page, app)
    text = copy_question(page, link="")
    code = re.search(r"DESK-([0-9A-Z]{4})", text).group(1)
    paste(page, "DESK-%s\nTITLE | Clerk\nCLOSES | unknown\nASKS | Excel\n" % code)
    page.wait_for_selector('[data-test="posting-draft"]')
    page.evaluate("() => { location.hash = '#jobs'; }")
    page.wait_for_selector('[data-test="job-draft-row"]')
    page.click('[data-test="job-draft-take"]')
    page.wait_for_selector('[data-test="job-form"]')
    assert page.input_value('[data-test="job-closes"]') == ""
    assert page.input_value('[data-test="job-link"]') == ""
    page.click('[data-test="job-save"]')
    page.wait_for_selector('[data-test="job-detail"]')
    job = desk_eval(page, "Desk.store.all('job')[0]")
    assert "closes" not in job and "link" not in job
    assert "Excel and good English" in job["posting"]
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_not_for_me_puts_the_draft_away(page, app):
    open_ai(page, app)
    text = copy_question(page, link="")
    code = re.search(r"DESK-([0-9A-Z]{4})", text).group(1)
    paste(page, "DESK-%s\nTITLE | Clerk\n" % code)
    page.wait_for_selector('[data-test="posting-draft"]')
    page.evaluate("() => { location.hash = '#jobs'; }")
    page.click('[data-test="job-draft-dismiss"]')
    page.wait_for_function("() => !document.querySelector('[data-test=\"job-draft-row\"]')")
    assert desk_eval(page, "Desk.store.all('suggestion')[0].status") == "dismissed"
    assert desk_eval(page, "Desk.store.all('job').length") == 0
    assert_no_errors(page, allow=ALLOW_MISSING)
