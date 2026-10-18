"""Jobs tests (T2.1): add, edit, change stage, filter, delete and undo."""

from helpers import assert_no_errors, wait_for_desk, read_toasts, skip_if_built

# Other base features may still be missing (their files 404 and the shell shows stubs).
ALLOW_MISSING = ["/features/", "Failed to load resource"]
ROW = '[data-test="job-row"]'


def open_jobs(page, app, hash="#jobs"):
    page.goto(app.url + hash)
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-screen="jobs"]')


def show_list(page):
    """The Jobs screen shows a board on a wide screen and a list on a phone (the view is remembered), and a
    board's cards carry no stage buttons, because five of them do not fit in one column. Tests that need a
    stage button in a row ask for the list first."""
    page.click('[data-test="jobs-view-list"]')
    page.wait_for_selector('[data-test="job-list"]')


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


def open_with_example(page, app):
    """Add the made-up person on the Data screen, then open the Jobs screen. The default viewport (1280px) is
    wide, so the Jobs screen opens on the board."""
    page.goto(app.url + "#data")
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-test="example-try"]')
    page.click('[data-test="example-try"]')
    page.wait_for_selector('[data-test="example-remove"]')
    page.click('[data-test="nav-jobs"]')
    page.wait_for_selector('[data-screen="jobs"]')
    page.wait_for_selector('[data-test="job-board"]')


def visible_job_ids(page):
    """The data-id of every job row on screen, sorted. A board card is also a job-row."""
    return sorted(page.eval_on_selector_all(ROW, "els => els.map(e => e.dataset.id)"))


def set_follow_up(page, title, offset):
    """Move one made-up job's followUp date `offset` whole days from the app's own today (with `put`, not `patch`)."""
    page.evaluate("""(args) => {
      const [title, offset] = args;
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const p = (n) => (n < 10 ? '0' : '') + n;
      const date = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      const job = Desk.store.all('job').find((j) => j.title === title);
      Desk.store.put(Object.assign({}, job, { followUp: date }));
    }""", [title, offset])
    page.wait_for_function("(t) => { const j = Desk.store.all('job').find((x) => x.title === t); "
                           "return !!j && !!j.followUp; }", arg=title)


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
    show_list(page)
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


def test_jobs_board_and_list_toggle(page, app):
    page.set_viewport_size({"width": 1400, "height": 900})
    open_jobs(page, app)
    # No hash change is needed: the store subscription redraws the screen by itself.
    page.evaluate("""() => Desk.store.batch('seed', () => {
      Desk.store.put({type: 'job', title: 'Baker', stage: 'saved', closes: '2026-12-01'});
      Desk.store.put({type: 'job', title: 'Cook', stage: 'applied', followUp: '2026-11-02'});
      Desk.store.put({type: 'job', title: 'Driver', stage: 'applied', followUp: '2026-10-20'});
      Desk.store.put({type: 'job', title: 'Nurse', stage: 'interview', interviewAt: '2026-11-05T09:30'});
      Desk.store.put({type: 'job', title: 'Odd one', stage: 'waiting'}); })""")
    # a wide screen starts on the board: five stage columns, plus one for a stage that is not one of the five
    board = '[data-test="job-board"]'
    page.wait_for_selector(board)
    assert page.locator(board + ' [data-stage="saved"]').count() == 1
    assert page.locator(board + ' [data-stage="other"]').count() == 1
    assert page.locator(board + ' [data-stage="offer"] [data-test="job-row"]').count() == 0
    assert "None" in page.locator(board + ' [data-stage="offer"]').inner_text()
    # the sooner next date comes first inside a column
    applied = page.eval_on_selector_all(board + ' [data-stage="applied"] [data-test="job-row"]', "els => els.map(e => e.dataset.id)")
    titles = page.eval_on_selector_all(board + ' [data-stage="applied"] [data-test="job-open"]', "els => els.map(e => e.innerText)")
    assert titles == ["Driver", "Cook"], titles
    # a board card opens the job
    page.click(board + ' [data-stage="saved"] [data-test="job-open"]')
    page.wait_for_selector('[data-test="job-detail"]')
    # the view is remembered: the board is still on next time
    page.click('[data-test="job-back"]')
    page.wait_for_selector(board)
    show_list(page)
    assert page.locator(ROW).count() == 5
    page.click('[data-test="jobs-view-board"]')
    page.wait_for_selector(board)
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector(board)
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_jobs_detail_sits_beside_the_list_on_a_wide_screen(page, app):
    page.set_viewport_size({"width": 1400, "height": 900})
    open_jobs(page, app)
    page.evaluate("""() => Desk.store.batch('seed', () => {
      Desk.store.put({type: 'job', title: 'Baker', stage: 'saved'});
      Desk.store.put({type: 'job', title: 'Cook', stage: 'applied'}); });""")
    show_list(page)
    # open the first job by name, so this does not depend on which row Playwright picks first
    page.locator(ROW, has_text="Baker").locator('[data-test="job-open"]').click()
    page.wait_for_selector('[data-test="job-split"]')
    # the list stays on the left, the job on the right, and the job opened is marked in the list
    assert page.locator('[data-test="job-split"] .split-main ' + ROW).count() == 2
    assert page.locator('[data-test="job-split"] .split-side [data-test="job-detail-title"]').inner_text() == "Baker"
    assert page.locator('[data-test="job-split"] .split-main [data-test="job-open"][aria-current="true"]').count() == 1
    assert_no_errors(page, allow=ALLOW_MISSING)
    # on a phone it is the whole screen, as it always was. Dragging the window narrower redraws it.
    page.set_viewport_size({"width": 390, "height": 780})
    page.wait_for_function("() => !document.querySelector('[data-test=job-split]')")
    assert page.locator('[data-test="job-detail"]').count() == 1
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


def test_jobs_search_filters_board_and_list(page, app):
    open_with_example(page, app)
    assert len(visible_job_ids(page)) == 6
    # a word in a title matches the two clerk jobs on the board
    page.fill('[data-test="job-search"]', "clerk")
    page.wait_for_function("() => document.querySelectorAll('[data-test=job-row]').length === 2")
    assert visible_job_ids(page) == ["job_amira_ap_clerk", "job_amira_northgate"]
    # every word has to match: "clerk" (a title) AND "northgate" (a company)
    page.fill('[data-test="job-search"]', "clerk northgate")
    page.wait_for_function("() => document.querySelectorAll('[data-test=job-row]').length === 1")
    assert visible_job_ids(page) == ["job_amira_northgate"]
    # clearing the box brings every job back
    page.fill('[data-test="job-search"]', "")
    page.wait_for_function("() => document.querySelectorAll('[data-test=job-row]').length === 6")
    assert len(visible_job_ids(page)) == 6
    # the list filters by the same words
    show_list(page)
    assert len(visible_job_ids(page)) == 6
    page.fill('[data-test="job-search"]', "kingsway")
    page.wait_for_function("() => document.querySelectorAll('[data-test=job-row]').length === 1")
    assert visible_job_ids(page) == ["job_amira_kingsway"]
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_jobs_search_box_keeps_the_keyboard_while_you_type(page, app):
    """Typing must not lose the box. `ui.go()` draws the screen again but deliberately drops the focus, which is
    right for a button and means a box that filters as you type is taken off you after the first letter.
    `page.fill()` cannot catch this -- it fires one `input` event, not one per key -- so this test types."""
    open_with_example(page, app)
    box = page.locator('[data-test="job-search"]')
    box.click()
    box.press_sequentially("clerk", delay=40)
    page.wait_for_function("() => document.querySelectorAll('[data-test=job-row]').length === 2")
    assert box.input_value() == "clerk", "the text survives the screen being drawn again"
    assert page.evaluate("() => document.activeElement && document.activeElement.dataset.test") == "job-search", \
        "and the box still has the keyboard, or typing would stop after one letter"
    # Editing in the middle must not throw the caret to the end.
    page.evaluate("""() => { const i = document.querySelector('[data-test="job-search"]');
                             i.focus(); i.setSelectionRange(2, 2); }""")
    page.keyboard.type("X")
    page.wait_for_function("() => document.querySelector('[data-test=\"job-search\"]').value === 'clXerk'")
    assert box.input_value() == "clXerk", "the caret stays where it was put"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_jobs_late_mark_respects_stage_and_threshold(page, app):
    open_with_example(page, app)
    # nothing is late to start with: the made-up person's follow-ups are all inside the default 21 days
    assert page.locator('[data-test="job-late"]').count() == 0
    # an open job whose follow-up is lateAfter (21) days in the past is marked late
    set_follow_up(page, "Administrative Assistant", -22)
    page.wait_for_selector('[data-test="job-late"]')
    assert page.locator('[data-test="job-row"][data-id="job_amira_lakeview"] [data-test="job-late"]').count() == 1
    assert page.locator('[data-test="job-late"]').count() == 1
    # a closed job is never late, whatever its follow-up date
    set_follow_up(page, "Data Entry Clerk", -22)
    page.wait_for_function("() => document.querySelectorAll('[data-test=job-row]').length === 6")
    assert page.locator('[data-test="job-row"][data-id="job_amira_northgate"] [data-test="job-late"]').count() == 0
    assert page.locator('[data-test="job-late"]').count() == 1
    # the threshold is a preference on the Data screen: 22 days past is no longer late at 30
    page.click('[data-test="nav-data"]')
    page.wait_for_selector('[data-screen="data"]')
    page.select_option('[data-test="pref-lateAfter"]', "30")
    page.wait_for_function("() => { const s = Desk.store.get('settings'); return s && s.ext && s.ext.jobs "
                           "&& s.ext.jobs.lateAfter === 30; }")
    page.click('[data-test="nav-jobs"]')
    page.wait_for_selector('[data-test="job-board"]')
    assert page.locator('[data-test="job-late"]').count() == 0
    assert_no_errors(page, allow=ALLOW_MISSING)
