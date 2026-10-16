"""Your own AI tasks (T3.8): make a task from a job, copy and open, paste an answer into the job's notes; share a task
as text and add it back; a word outside the allowed set stays visible.

recipe-custom is added to the feature list by an init script (on DOMContentLoaded, before the shell boots) when
features/list.js does not name it yet, so this test works either way."""

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
  document.addEventListener('DOMContentLoaded', () => {
    if (Desk.features.indexOf('recipe-custom') < 0) Desk.features.push('recipe-custom');
  });
})();
"""

TEXT = "Write a short thank-you note for this interview.\nAbout me:\n{profile}\nThe job:\n{job}\nMy notes: {notes}"
ANSWER = "Sure!\n```\nDESK-{code}\nDear Kingsway team,\nThank you for meeting me.\n```\nAnything else?"


def open_app(page, app, hash_="#home"):
    page.add_init_script(INIT)
    page.goto(app.url + hash_)
    wait_for_desk(page, started=True)
    page.evaluate(
        """() => {
            Desk.store.put({type: 'profile', roles: 'Office administration', background: 'SECRET-BACKGROUND'});
            Desk.store.put({type: 'job', id: 'j_cust', title: 'Office Administrator', org: 'Kingsway Dental Group',
                            where: 'Scarborough', stage: 'interview', asks: 'QuickBooks', notes: 'SECRET-NOTE', link: 'https://example.com/secret'});
        }"""
    )


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


def customs(page):
    return desk_eval(page, "Desk.store.all('recipe-custom')")


def test_make_a_task_from_a_job_copy_and_open_then_answer_goes_to_the_notes(page, app):
    open_app(page, app, "#jobs/j_cust")
    page.click('[data-test="custom-job-new"]')
    page.wait_for_selector('[data-test="custom-form"]')
    page.fill('[data-test="custom-name"]', "Thank-you note")
    page.fill('[data-test="custom-text"]', TEXT)
    # the answer choice is there because it starts from a job; a word outside the set is warned about
    page.select_option('[data-test="custom-start"]', "job")
    page.select_option('[data-test="custom-answer-kind"]', "job-notes")
    page.wait_for_selector('[data-test="custom-warn"]')
    assert "{notes}" in page.locator('[data-test="custom-warn"]').inner_text()
    assert page.locator('[data-test="custom-words"] li').count() == 9
    page.click('[data-test="custom-save"]')
    # now on the task, with this job
    page.wait_for_selector('[data-test="ai-copy-open"]:not([disabled])')
    rec = customs(page)[0]
    assert rec["type"] == "recipe-custom" and rec["startsFrom"] == "job" and rec["answer"] == "job-notes"
    assert page.evaluate("() => location.hash") == "#ai/%s/j_cust" % rec["id"]
    page.click('[data-test="ai-copy-open"]')
    page.wait_for_selector('[data-test="ai-copied"]')
    text = page.evaluate("() => window.__copied[window.__copied.length - 1]")
    code = re.search(r"DESK-([0-9A-Z]{4})", text).group(1)
    assert "Job title: Office Administrator" in text and "Employer: Kingsway Dental Group" in text
    assert "What work: Office administration" in text and "SECRET-BACKGROUND" not in text
    assert "My notes: {notes}" in text, "a word outside the set stays visible as text"
    assert "SECRET-NOTE" not in text and "example.com/secret" not in text
    assert "HOW TO ANSWER" in text and "Then your answer as plain text." in text
    assert page.evaluate("() => window.__opened.length") == 1
    # paste the answer: a suggestion, and the job is not changed yet
    paste(page, ANSWER.replace("{code}", code))
    page.wait_for_selector('[data-test="ai-result-text"]')
    assert "Open the job" in page.locator('[data-test="custom-open-job"]').inner_text()
    assert "Thank you for meeting me." in page.locator('[data-test="custom-answer"]').inner_text()
    assert desk_eval(page, "Desk.store.get('j_cust').notes") == "SECRET-NOTE"
    sugs = desk_eval(page, "Desk.store.all('suggestion')")
    assert len(sugs) == 1 and sugs[0]["kind"] == "job-note" and sugs[0]["target"]["job"] == "j_cust" and sugs[0]["status"] == "new"
    # pasting it again changes nothing
    paste(page, ANSWER.replace("{code}", code))
    assert len(desk_eval(page, "Desk.store.all('suggestion')")) == 1
    # open the job and add it to the notes
    page.click('[data-test="custom-open-job"]')
    page.wait_for_selector('[data-test="job-note-ready"]')
    page.click('[data-test="job-note-add"]')
    page.wait_for_selector('[data-test="job-note-ready"]', state="detached")
    notes = desk_eval(page, "Desk.store.get('j_cust').notes")
    assert re.fullmatch(r"SECRET-NOTE\n\nAI answer, \d{4}-\d{2}-\d{2}:\nDear Kingsway team,\nThank you for meeting me\.", notes), notes
    assert desk_eval(page, "Desk.store.all('suggestion')[0].status") == "taken"
    assert "Thank you for meeting me." in page.locator('[data-test="job-detail"]').inner_text()
    # undo puts it back as it was, in one step
    page.click('[data-test="toast-undo"]')
    page.wait_for_selector('[data-test="job-note-ready"]')
    assert desk_eval(page, "Desk.store.get('j_cust').notes") == "SECRET-NOTE"
    assert desk_eval(page, "Desk.store.all('suggestion')[0].status") == "new"
    # the task shows on the job, and a job task is not in the AI task list
    assert page.locator('[data-test="custom-use"]').count() == 1
    page.click('[data-test="nav-ai"], a[href="#ai"]')
    page.wait_for_selector('[data-test="ai-pending"], [data-test="paste-box"]')
    assert page.locator('[data-test="ai-task-%s"]' % rec["id"]).count() == 0
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_share_a_task_as_text_delete_it_and_add_it_back(page, app):
    open_app(page, app, "#ai")
    page.click('[data-test="custom-new"]')
    page.fill('[data-test="custom-name"]', "Plain-words rewrite")
    page.fill('[data-test="custom-text"]', "Rewrite my summary in plain words.\n{profile}\nExtra: {job}")
    assert "{job}" in page.locator('[data-test="custom-warn"]').inner_text()  # a job word needs a job
    page.click('[data-test="custom-save"]')
    page.wait_for_selector('[data-test="ai-copy-share"]:not([disabled])')
    rec = customs(page)[0]
    assert page.locator('[data-test="ai-task-%s"]' % rec["id"]).count() == 1
    page.click('[data-test="ai-copy-share"]')
    page.wait_for_selector('[data-test="ai-part-copied"]')
    shared = page.evaluate("() => window.__copied[window.__copied.length - 1]")
    assert shared.startswith("[A task to share, from Search Desk]\nName: Plain-words rewrite\nStarts from: ai\nAnswer: none\n")
    assert "Rewrite my summary in plain words." in shared
    # delete it: it leaves the list and the registry; undo brings it back
    page.click('[data-test="custom-delete"]')
    page.wait_for_selector('[data-test="ai-task-%s"]' % rec["id"], state="detached")
    assert desk_eval(page, "Desk.recipes.get(%r) === null" % rec["id"]) is True
    page.click('[data-test="toast-undo"]')
    page.click('[data-test="ai-task-%s"]' % rec["id"])
    page.click('[data-test="custom-delete"]')
    page.wait_for_selector('[data-test="ai-task-%s"]' % rec["id"], state="detached")
    # a friend pastes the text: it is shown as text, with the word that will not be filled in, and added by a tap
    paste(page, "Look at this:\n" + shared)
    page.wait_for_selector('[data-test="custom-shared"]')
    box = page.locator('[data-test="custom-shared"]').inner_text()
    assert "Plain-words rewrite" in box and "{job}" in box
    assert customs(page) == [] or all(r.get("deleted") for r in desk_eval(page, "Desk.store.all('recipe-custom', {withDeleted: true})"))
    page.click('[data-test="custom-shared-add"]')
    page.wait_for_function("() => document.querySelectorAll('[data-test^=\"ai-task-rc\"]').length === 1")
    back = customs(page)
    assert len(back) == 1 and back[0]["name"] == "Plain-words rewrite" and back[0]["startsFrom"] == "ai" and back[0]["answer"] == "none"
    assert back[0]["text"] == rec["text"]
    # pasting it again does not make a second one
    paste(page, shared)
    page.wait_for_selector('[data-test="custom-shared-done"]')
    assert len(customs(page)) == 1
    # an over-long shared task is refused, and nothing is added
    paste(page, shared + "x" * 7000)
    page.wait_for_function("() => /too long/.test(document.querySelector('[data-test=\"ai-result-text\"]').textContent)")
    assert page.locator('[data-test="custom-shared-add"]').count() == 0
    assert len(customs(page)) == 1
    # markup in a shared task is shown as text and never runs
    paste(page, "[A task to share, from Search Desk]\nName: <img src=x onerror=window.__pwned=1>\nInstructions\n-----\n<script>window.__pwned=2</script>\n-----")
    page.wait_for_selector('[data-test="custom-shared-text"]')
    assert "<script>" in page.locator('[data-test="custom-shared-text"]').inner_text()
    assert page.evaluate("() => window.__pwned") is None
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_exported_tasks_come_back_after_import(page, app):
    open_app(page, app, "#ai")
    page.click('[data-test="custom-new"]')
    page.fill('[data-test="custom-name"]', "Keep me")
    page.fill('[data-test="custom-text"]', "Help with {profile}")
    page.click('[data-test="custom-save"]')
    page.wait_for_selector('[data-test^="ai-task-rc"]')
    exported = page.evaluate("() => Desk.io.exportText(Desk.store.state())")
    assert '"recipe-custom"' in exported and "Keep me" in exported
    page.evaluate("() => { Desk.store.load({schema: 'searchdesk/1', records: {}}); Desk.persist.flush(); }")
    page.reload()
    wait_for_desk(page, started=True)
    assert page.locator('[data-test^="ai-task-rc"]').count() == 0
    page.goto(app.url + "#data")
    paste(page, exported)
    page.goto(app.url + "#ai")
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-test^="ai-task-rc"]')
    assert_no_errors(page, allow=ALLOW_MISSING)
