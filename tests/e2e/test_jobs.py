"""Jobs tests (T2.1): add, edit, change stage, filter, delete and undo."""

from helpers import assert_no_errors, wait_for_desk, read_toasts, skip_if_built

# Other base features may still be missing (their files 404 and the shell shows stubs).
ALLOW_MISSING = ["/features/", "Failed to load resource"]
ROW = '[data-test="job-row"]'


def open_jobs(page, app, hash="#jobs"):
    page.goto(app.url + hash)
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-screen="jobs"]')


def add_job(page, title, **fields):
    page.click('[data-test="job-add"]')
    page.wait_for_selector('[data-test="job-form"]')
    page.fill('[data-test="job-title"]', title)
    for key, value in fields.items():
        page.fill('[data-test="job-%s"]' % key, value)
    page.click('[data-test="job-save"]')
    page.wait_for_selector('[data-test="job-detail"]')


def has_toast(page, text):
    return any(text in t for t in read_toasts(page))


def jobs(page):
    return page.evaluate("() => Desk.store.all('job').map(j => ({title: j.title, stage: j.stage, id: j.id, "
                         "org: j.org, link: j.link, followUp: j.followUp, interviewAt: j.interviewAt, applied: j.applied}))")


def test_jobs_add_edit_stage_delete_undo(page, app):
    open_jobs(page, app)
    assert page.locator('[data-test="job-empty"]').count() == 1
    # a blank title is refused with a plain line
    page.click('[data-test="job-add"]')
    page.click('[data-test="job-save"]')
    assert "title" in page.locator('[data-test="job-problem"]').inner_text().lower()
    assert jobs(page) == []
    page.click('[data-test="job-cancel"]')
    # add
    page.click('[data-test="job-add"]')
    page.fill('[data-test="job-title"]', "Line cook")
    page.fill('[data-test="job-org"]', "Maple Cafe")
    page.fill('[data-test="job-link"]', "https://example.com/cook")
    page.fill('[data-test="job-followup"]', "2026-11-02")
    page.fill('[data-test="job-interviewdate"]', "2026-11-05")
    page.fill('[data-test="job-interviewtime"]', "14:30")
    page.click('[data-test="job-save"]')
    page.wait_for_selector('[data-test="job-detail"]')
    assert page.locator('[data-test="job-detail-title"]').inner_text() == "Line cook"
    assert page.locator('[data-test="job-link"]').get_attribute("href") == "https://example.com/cook"
    j = jobs(page)[0]
    assert (j["org"], j["stage"], j["followUp"], j["interviewAt"]) == ("Maple Cafe", "saved", "2026-11-02", "2026-11-05T14:30")
    assert has_toast(page, "Job saved.")
    # edit
    page.click('[data-test="job-edit"]')
    page.wait_for_selector('[data-test="job-form"]')
    assert page.input_value('[data-test="job-title"]') == "Line cook"
    assert page.input_value('[data-test="job-interviewtime"]') == "14:30"
    page.fill('[data-test="job-title"]', "Head cook")
    page.fill('[data-test="job-org"]', "")
    page.fill('[data-test="job-link"]', "javascript:alert(1)")
    page.click('[data-test="job-save"]')
    page.wait_for_selector('[data-test="job-detail"]')
    j = jobs(page)[0]
    assert j["title"] == "Head cook" and j["org"] is None and j["link"] is None, j
    assert any("link was left out" in t for t in read_toasts(page)), read_toasts(page)
    assert page.locator('[data-test="job-link"]').count() == 0
    # stage change from the detail view: one tap, toast, applied date set
    page.click('[data-test="job-stage-applied"]')
    page.wait_for_function("() => Desk.store.all('job')[0].stage === 'applied'")
    assert jobs(page)[0]["applied"]
    assert any("Moved to Applied" in t for t in read_toasts(page))
    assert page.locator('[data-test="job-stage-applied"]').get_attribute("aria-pressed") == "true"
    page.click('[data-test="toast-undo"]')
    page.wait_for_function("() => Desk.store.all('job')[0].stage === 'saved'")
    # back to the list: counts, filter, stage change in the row
    page.click('[data-test="job-back"]')
    page.wait_for_selector(ROW)
    assert page.locator('[data-test="stage-filter-all"]').inner_text().endswith("1")
    page.click(ROW + ' [data-test="job-stage-interview"]')
    page.wait_for_function("() => Desk.store.all('job')[0].stage === 'interview'")
    assert page.locator('[data-test="stage-filter-interview"]').inner_text().endswith("1")
    assert page.locator('[data-test="stage-filter-saved"]').inner_text().endswith("0")
    page.click('[data-test="stage-filter-saved"]')
    page.wait_for_selector('[data-test="job-empty"]')
    page.click('[data-test="stage-filter-interview"]')
    page.wait_for_selector(ROW)
    page.click('[data-test="stage-filter-all"]')
    # open, delete, undo
    page.click(ROW + ' [data-test="job-open"]')
    page.wait_for_selector('[data-test="job-detail"]')
    page.click('[data-test="job-delete"]')
    page.wait_for_selector('[data-test="job-empty"]')
    assert jobs(page) == []
    assert has_toast(page, "Job deleted.")
    page.click('[data-test="toast-undo"]')
    page.wait_for_selector(ROW)
    j = jobs(page)
    assert len(j) == 1 and j[0]["title"] == "Head cook" and j[0]["stage"] == "interview"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_jobs_routes_and_missing_job(page, app):
    open_jobs(page, app, "#jobs/nope")
    assert page.locator('[data-test="job-missing"]').count() == 1
    open_jobs(page, app, "#jobs/new")
    page.wait_for_selector('[data-test="job-form"]')
    page.fill('[data-test="job-title"]', "Cleaner")
    page.fill('[data-test="job-where"]', "Downtown")
    page.click('[data-test="job-save"]')
    page.wait_for_selector('[data-test="job-detail"]')
    jid = jobs(page)[0]["id"]
    assert page.evaluate("() => location.hash") == "#jobs/" + jid
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-test="job-detail"]')
    page.goto(app.url + "#jobs/" + jid + "/edit")
    page.reload()
    page.wait_for_selector('[data-test="job-form"]')
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_jobs_detail_hosts_slots(page, app):
    page.add_init_script("""window.addEventListener('DOMContentLoaded', () => {});""")
    open_jobs(page, app)
    page.evaluate("""() => Desk.register({id: 'jobs-extra', name: 'Extra', purpose: 'x', types: [],
      mount(ctx) {
        ctx.slot('job.panel', {id: 'p', title: 'Extra panel', render(el, job) { el.append(ctx.h('p', {'data-test': 'panel-text'}, 'for ' + job.title)); }});
        ctx.slot('job.actions', {id: 'a', label: 'Extra action', run(job) { ctx.ui.toast('ran ' + job.title); }});
      }})""")
    add_job(page, "Barista")
    assert page.locator('[data-test="panel-text"]').inner_text() == "for Barista"
    page.click('[data-test="action-a"]')
    assert has_toast(page, "ran Barista")
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_jobs_selftest_is_green(page, app):
    skip_if_built(app, "the self-test loads checks/*.check.js, which a built file does not carry")
    page.goto(app.url + "#selftest")
    wait_for_desk(page, started=True)
    page.wait_for_function("document.querySelector('[data-test=\"selftest-summary\"]')"
                           " && document.querySelector('[data-test=\"selftest-summary\"]').dataset.status !== 'running'")
    assert page.locator('[data-test="selftest-row-jobs"]').get_attribute("data-status") == "pass"
    assert_no_errors(page, allow=ALLOW_MISSING)
