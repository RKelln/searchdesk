"""Home tests (T2.3): the Today list, the empty state and the backup nudge."""

from helpers import assert_no_errors, wait_for_desk, clear_storage

# Other base features may still be missing (their files 404 and the shell shows stubs).
ALLOW_MISSING = ["/features/", "Failed to load resource"]
ITEM = '[data-test="home-item"]'

# Adds example-like records with dates relative to the browser's today, then shows Home again.
SEED = """() => {
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n);
    const p = (x) => (x < 10 ? '0' : '') + x;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  Desk.store.batch('seed', () => {
    Desk.store.put({type: 'job', title: 'Accounts Payable Clerk', org: 'Maple Co', stage: 'applied', followUp: day(-2)});
    Desk.store.put({type: 'job', title: 'Office Administrator', stage: 'interview', interviewAt: day(2) + 'T10:00'});
    Desk.store.put({type: 'job', title: 'Library Page', stage: 'saved', closes: day(4)});
    Desk.store.put({type: 'job', title: 'Old Closed Job', stage: 'closed', followUp: day(-5)});
    Desk.store.put({type: 'event-mark', eventId: 'ev1', status: 'starred',
      copy: {title: 'Hiring Fair', start: day(3) + 'T13:00', end: day(3) + 'T16:00', venue: 'Library', url: '', tier: 'library'}});
    Desk.store.put({type: 'suggestion', recipe: 'events', code: 'DESK-TEST', kind: 'event', target: 'x', why: 'w', status: 'new'});
  });
  location.hash = '#jobs'; location.hash = '#home';
}"""


def open_home(page, app):
    page.goto(app.url + "#home")
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-screen="home"]')


def go_home(page):
    page.evaluate("() => { location.hash = '#jobs'; location.hash = '#home'; }")
    page.wait_for_selector('[data-screen="home"]')


def test_home_empty_state(page, app):
    open_home(page, app)
    page.wait_for_selector('[data-test="home-empty"]')
    assert page.locator(ITEM).count() == 0
    assert page.locator('[data-test="home-nudge"]').count() == 0
    assert page.locator('[data-test="home-empty"] button').count() >= 1
    page.click('[data-test="home-step-job"]')
    page.wait_for_selector('[data-test="job-form"]')
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_home_shows_items_in_order(page, app):
    open_home(page, app)
    page.evaluate(SEED)
    page.wait_for_selector(ITEM)
    kinds = page.eval_on_selector_all(ITEM, "els => els.map(e => e.dataset.kind)")
    assert kinds == ["followUp", "interview", "event", "closes", "suggestions"], kinds
    texts = page.eval_on_selector_all(ITEM, "els => els.map(e => e.innerText)")
    assert "Accounts Payable Clerk" in texts[0] and "2 days late" in texts[0], texts
    assert "Office Administrator" in texts[1] and "in 2 days" in texts[1] and "10am" in texts[1], texts
    assert "Hiring Fair" in texts[2], texts
    assert "Library Page" in texts[3] and "in 4 days" in texts[3], texts
    assert "Old Closed Job" not in " ".join(texts)
    assert page.locator('[data-test="home-empty"]').count() == 0
    # a row opens its job
    page.locator(ITEM).first.locator("button").click()
    page.wait_for_selector('[data-test="job-detail"]')
    assert page.locator('[data-test="job-detail-title"]').inner_text() == "Accounts Payable Clerk"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_home_backup_nudge(page, app):
    open_home(page, app)
    page.evaluate("""() => { Desk.store.batch('seed', () => {
      for (let i = 0; i < 10; i++) Desk.store.put({type: 'job', title: 'Job ' + i, stage: 'saved'}); }); }""")
    go_home(page)
    page.wait_for_selector('[data-test="home-nudge"]')
    assert "never" in page.locator('[data-test="home-nudge"]').inner_text().lower()
    page.click('[data-test="home-nudge-go"]')
    page.wait_for_selector('[data-screen="data"]')
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_home_job_note_and_draft_rows_use_plain_words(page, app):
    open_home(page, app)
    page.evaluate("""() => { Desk.store.batch('seed', () => {
      const j = Desk.store.put({type: 'job', title: 'Library Page', stage: 'saved'});
      Desk.store.put({type: 'suggestion', recipe: 'rc_abcd1234', code: 'DESK-NOTE', kind: 'job-note', status: 'new',
        target: {job: j.id, text: 'Some notes', task: 'Prep'}, why: ''});
      Desk.store.put({type: 'suggestion', recipe: 'posting', code: 'DESK-DRAFT', kind: 'job-draft', status: 'new', target: {title: 'T'}, why: ''});
    }); location.hash = '#jobs'; location.hash = '#home'; }""")
    page.wait_for_selector(ITEM)
    texts = page.eval_on_selector_all(ITEM, "els => els.map(e => e.innerText)")
    joined = " ".join(texts)
    assert "rc_" not in joined and "posting" not in joined.lower().replace("postings", ""), texts
    note = page.locator(ITEM + '[data-kind="jobNote"]')
    assert note.count() == 1 and "Library Page" in note.inner_text(), texts
    assert any("jobs from postings" in x for x in texts), texts
    note.locator("button").click()
    page.wait_for_selector('[data-test="job-detail"]')
    assert_no_errors(page, allow=ALLOW_MISSING)
