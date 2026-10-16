"""Improving recipes (T3.7): change the instructions, reset, export and import, the notes list, and the improve task.

Uses the same test-only recipe as test_ai.py ("fixtureq": template 'Pick the best events.\\n{profile}\\nUp to {n} picks.\\n{items}'),
and the real coach recipe for "Copy only the instructions"."""

import json

from helpers import assert_no_errors, desk_eval
from test_ai import INIT, copy_question, open_ai, paste, result_text

ALLOW_MISSING = ["/features/", "Failed to load resource"]
EDITED = "Choose the events that help most.\n{profile}\nNo more than {n} picks.\n{items}"


def open_editor(page):
    page.click('[data-test="recipe-edit"] summary')
    page.wait_for_selector('[data-test="recipe-edit-text"]')


def save_text(page, text, why=""):
    page.fill('[data-test="recipe-edit-text"]', text)
    if why:
        page.fill('[data-test="recipe-edit-why"]', why)
    page.click('[data-test="recipe-edit-save"]')
    page.wait_for_selector('[data-test="recipe-edit-saved"]')


def stored(page):
    return desk_eval(page, "Desk.store.get('re_fixtureq') || null")


def preview(page):
    if not page.locator('[data-test="ai-preview-text"]').is_visible():
        page.click('[data-test="ai-preview"] summary')
    return page.locator('[data-test="ai-preview-text"]').inner_text()


def test_edit_save_the_next_question_uses_it_and_reset_brings_back_the_original(page, app):
    open_ai(page, app)
    assert "Pick the best events." in preview(page)
    open_editor(page)
    assert page.locator('[data-test="recipe-edit-text"]').input_value().startswith("Pick the best events.")
    assert page.locator('[data-test="recipe-edit-reset"]').is_disabled()
    assert page.locator('[data-test="recipe-edit-placeholders"] li').count() == 3
    save_text(page, EDITED, "Shorter, and it names the limit.")
    rec = stored(page)
    assert rec["type"] == "recipe-edit" and rec["recipe"] == "fixtureq" and rec["text"] == EDITED
    assert rec["why"] == "Shorter, and it names the limit." and len(rec["versions"]) == 1
    # the next question uses it, and the answer block is still the page's
    text, code = copy_question(page)
    assert "Choose the events that help most." in text and "No more than 3 picks." in text
    assert "Pick the best events." not in text
    assert "HOW TO ANSWER" in text and "First line: DESK-%s" % code in text
    # an answer to it is still read
    paste(page, "DESK-%s\nL1 | Fits." % code)
    assert result_text(page).startswith("1 suggestion added.")
    # a second edit makes a second version; the earlier one can be put back in the box
    save_text(page, EDITED + "\nBe brief.")
    assert len(stored(page)["versions"]) == 2
    page.click('[data-test="recipe-edit-versions"] summary')
    page.click('[data-test="recipe-edit-version-0"]')
    page.wait_for_function("() => document.querySelector('[data-test=\"recipe-edit-text\"]').value === %s" % json.dumps(EDITED))
    # back to the original
    page.click('[data-test="recipe-edit-reset"]')
    page.wait_for_selector('[data-test="recipe-edit-saved"]')
    assert stored(page)["text"] == "" and len(stored(page)["versions"]) == 2
    assert page.locator('[data-test="recipe-edit-text"]').input_value().startswith("Pick the best events.")
    text2, _ = copy_question(page)
    assert "Pick the best events." in text2 and "Choose the events" not in text2
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_edit_survives_export_and_import(page, app):
    open_ai(page, app)
    open_editor(page)
    save_text(page, EDITED, "Names the limit.")
    exported = page.evaluate("() => Desk.io.exportText(Desk.store.state())")
    assert '"recipe-edit"' in exported and "Choose the events that help most." in exported
    page.evaluate("() => { Desk.store.load({schema: 'searchdesk/1', records: {}}); Desk.persist.flush(); }")
    page.reload()
    page.wait_for_function("() => window.Desk && Desk.started === true")
    assert stored(page) is None
    page.evaluate("(t) => Desk.io.importText(t)", exported)
    assert stored(page)["text"] == EDITED and stored(page)["why"] == "Names the limit."
    page.evaluate("() => { Desk.store.put({type: 'profile', roles: 'Clerk'}); }")
    page.wait_for_selector('[data-test="ai-task-fixtureq"]')
    text, _ = copy_question(page)
    assert "Choose the events that help most." in text
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_a_missing_placeholder_shows_a_warning_not_a_block(page, app):
    open_ai(page, app)
    open_editor(page)
    assert page.locator('[data-test="re-warn"]').count() == 0
    page.fill('[data-test="recipe-edit-text"]', "Pick the best ones.\n{profile}\nUp to {n} picks. {extra}")
    warns = page.locator('[data-test="recipe-edit-warnings"]').inner_text()
    assert "{items} is gone" in warns
    assert "{extra} is not a word this task knows" in warns
    page.click('[data-test="recipe-edit-save"]')  # a warning does not stop a save
    page.wait_for_selector('[data-test="recipe-edit-saved"]')
    assert "{extra}" in stored(page)["text"]
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_notes_are_listed_under_the_task(page, app):
    open_ai(page, app)
    _, code = copy_question(page)
    paste(page, "DESK-%s\nL1 | Fine." % code)
    result_text(page)
    page.click('[data-test="ai-better"]')
    page.fill('[data-test="ai-better-text"]', "It picked events too far from Scarborough.")
    page.click('[data-test="ai-better-save"]')
    page.wait_for_selector('[data-test="recipe-notes"]')
    assert "too far from Scarborough" in page.locator('[data-test="recipe-notes"]').inner_text()
    assert page.locator('[data-test="recipe-notes"] li[data-used="0"]').count() == 1
    assert_no_errors(page, allow=ALLOW_MISSING)


IMPROVED = """Sure, here is a better version:
```
DESK-{code}
Choose the events that help most.
{{profile}}
Up to {{n}} picks. Stay close to home.
{{items}}
```
What changed: Added a rule about distance, so picks stay near the person."""


def start_improve(page):
    page.click('[data-test="recipe-improve-open"]')
    page.wait_for_function("() => location.hash === '#ai/improve/fixtureq'")
    page.wait_for_selector('[data-test="improve-for"]')
    return copy_question(page)


def test_improve_with_ai_shows_the_two_versions_and_use_this_saves_it(page, app):
    open_ai(page, app)
    _, code0 = copy_question(page)
    paste(page, "DESK-%s\nL1 | Fine." % code0)
    result_text(page)
    page.click('[data-test="ai-better"]')
    page.fill('[data-test="ai-better-text"]', "It picked events too far from Scarborough.")
    page.click('[data-test="ai-better-save"]')
    page.wait_for_selector('[data-test="recipe-notes"]')
    open_editor(page)
    text, code = start_improve(page)
    # the question carries the instructions, the kept words, and the unused note
    assert "for this task: Fixture task." in text
    assert "-----\nPick the best events.\n{profile}\nUp to {n} picks.\n{items}\n-----" in text
    assert "KEPT WORDS\n{profile}\n{n}\n{items}\n" in text and "- It picked events too far from Scarborough." in text
    assert "First line: DESK-%s" % code in text and "What changed:" in text
    # the answer is read whole; nothing is saved until the person chooses
    paste(page, IMPROVED.format(code=code))
    page.wait_for_selector('[data-test="recipe-diff"]')
    assert result_text(page).startswith("The AI wrote new instructions.")
    assert stored(page) is None
    assert "Added a rule about distance" in page.locator('[data-test="recipe-compare-summary"]').inner_text()
    assert page.locator('[data-test="re-warn"]').count() == 0
    assert page.locator(".re-changed").count() >= 2
    assert "Stay close to home." in page.locator('[data-test="recipe-diff"]').inner_text()
    # Keep mine changes nothing
    page.click('[data-test="recipe-compare-keep"]')
    page.wait_for_selector('[data-test="recipe-compare-kept"]')
    assert stored(page) is None
    # paste it again, this time use it
    paste(page, IMPROVED.format(code=code))
    page.click('[data-test="recipe-compare-use"]')
    page.wait_for_selector('[data-test="recipe-compare-used"]')
    rec = stored(page)
    assert rec["text"] == "Choose the events that help most.\n{profile}\nUp to {n} picks. Stay close to home.\n{items}"
    assert rec["why"].startswith("Added a rule about distance")
    notes = desk_eval(page, "Desk.store.all('recipe-note')")
    assert [n["used"] for n in notes] == [True]
    # Undo takes the edit and the used mark back
    page.click('[data-test="recipe-compare-undo"]')
    page.wait_for_function("() => !Desk.store.get('re_fixtureq') || Desk.store.get('re_fixtureq').text === ''")
    assert [n["used"] for n in desk_eval(page, "Desk.store.all('recipe-note')")] == [False]
    # use it again; the next question for the task has the new words
    paste(page, IMPROVED.format(code=code))
    page.click('[data-test="recipe-compare-use"]')
    page.wait_for_selector('[data-test="recipe-compare-used"]')
    page.goto(app.url + "#ai/fixtureq")
    page.wait_for_selector('[data-test="ai-copy-open"]')
    text2, _ = copy_question(page)
    assert "Stay close to home." in text2
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_improved_answer_that_drops_a_placeholder_shows_the_warning(page, app):
    open_ai(page, app)
    open_editor(page)
    _, code = start_improve(page)
    paste(page, "```\nDESK-%s\nChoose the best events.\n{profile}\nUp to {n} picks.\n```\nWhat changed: Shorter." % code)
    page.wait_for_selector('[data-test="recipe-compare-warnings"] [data-test="re-warn"]')
    warn = page.locator('[data-test="recipe-compare-warnings"]').inner_text()
    assert "{items} is gone" in warn
    # it is a warning, not a block: the buttons are still there
    assert page.locator('[data-test="recipe-compare-use"]').is_enabled()
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_improve_without_a_task_says_to_pick_one(page, app):
    open_ai(page, app)
    page.goto(app.url + "#ai/improve")
    page.wait_for_selector('[data-test="ai-needs"]')
    assert "Pick a task first" in page.locator('[data-test="ai-needs"]').inner_text()
    assert page.locator('[data-test="ai-copy"]').is_disabled()
    assert page.locator('[data-test="ai-task-improve"]').count() == 0, "the improve task is not in the task list"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_coach_copy_only_the_instructions_uses_the_edit(page, app):
    page.add_init_script(INIT)
    page.add_init_script("window.DESK_WORKSHOP = { banner: 'Practice computer.' }")
    page.goto(app.url + "#ai/coach")
    page.wait_for_function("() => window.Desk && Desk.started === true")
    page.wait_for_selector('[data-test="ai-copy-instructions"]')
    page.click('[data-test="ai-copy-instructions"]')
    page.wait_for_selector('[data-test="ai-part-copied"]')
    original = page.evaluate("() => window.__copied[window.__copied.length - 1]")
    assert original.startswith("Run a mock interview") and "Ask 3 main questions" in original and "---" not in original
    page.click('[data-test="recipe-edit"] summary')
    page.fill('[data-test="recipe-edit-text"]', "Be my kind interviewer.{language}\n\nAsk {questions} questions.\n\n{context}")
    page.click('[data-test="recipe-edit-save"]')
    page.wait_for_selector('[data-test="recipe-edit-saved"]')
    page.click('[data-test="ai-copy-instructions"]')
    page.wait_for_function("() => window.__copied.length >= 2")
    edited = page.evaluate("() => window.__copied[window.__copied.length - 1]")
    assert edited == "Be my kind interviewer.\n\nAsk 3 questions.\n"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_over_1500_characters_warns_but_does_not_block(page, app):
    open_ai(page, app)
    open_editor(page)
    sel = '[data-test="recipe-edit-warnings"] [data-test="instructions-long"]'
    box = '[data-test="recipe-edit-text"]'
    page.fill(box, "{profile} {n} {items} " + "x" * (1500 - 22))
    assert page.locator(sel).count() == 0, "exactly 1,500 characters is fine"
    page.fill(box, "{profile} {n} {items} " + "x" * (1501 - 22))
    page.wait_for_selector(sel)
    text = page.locator(sel).inner_text()
    assert "1501 characters" in text and "1500" in text
    assert page.locator('[data-test="recipe-edit-warnings"][role="status"]').count() == 1
    page.click('[data-test="recipe-edit-save"]')  # a warning does not stop a save
    page.wait_for_selector('[data-test="recipe-edit-saved"]')
    assert len(stored(page)["text"]) == 1501
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_coach_edit_counts_the_filled_instructions_without_the_context(page, app):
    page.add_init_script(INIT)
    page.goto(app.url + "#ai/coach")
    page.wait_for_function("() => window.Desk && Desk.started === true")
    page.click('[data-test="recipe-edit"] summary')
    sel = '[data-test="recipe-edit-warnings"] [data-test="instructions-long"]'
    box = '[data-test="recipe-edit-text"]'
    assert page.locator(sel).count() == 0, "the original is within 1,500"
    # {language} and {context} fill to nothing here, so the count is the typed words
    page.fill(box, "a" * 1500 + "{language}\n\n{context}")
    assert page.locator(sel).count() == 0
    page.fill(box, "a" * 1501 + "{language}\n\n{context}")
    page.wait_for_selector(sel)
    assert_no_errors(page, allow=ALLOW_MISSING)
