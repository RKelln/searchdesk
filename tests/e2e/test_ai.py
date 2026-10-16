"""AI helper tests (T3.3): copy a question, paste an answer, idempotency, the fix-it message, reload, notes.

No real recipe feature exists yet, so a test-only feature ("fixture-ai") registers one recipe. It is added by an init
script that runs on DOMContentLoaded, before the shell boots, so this works on all four engine and origin combinations
(page.route cannot serve files to WebKit on file://). The same script records what is copied and opened, and keeps the
clipboard calls deterministic."""

import re

from helpers import PASTE_BOX, assert_no_errors, desk_eval, wait_for_desk

# Other features may not exist yet (their files 404 and the shell shows stubs).
ALLOW_MISSING = ["/features/", "Failed to load resource"]

INIT = """
(() => {
  window.__copied = [];
  window.__opened = [];
  window.__clip = '';
  window.__failCopy = false;
  window.open = (...a) => { window.__opened.push(a); return null; };
  const real = navigator.clipboard;
  const fake = {
    writeText(t) {
      window.__copied.push(t);
      if (window.__failCopy) return Promise.reject(new Error('blocked'));
      return real && real.writeText ? real.writeText(t).catch(() => {}) : Promise.resolve();
    },
    readText() { return Promise.resolve(window.__clip); },
  };
  Object.defineProperty(navigator, 'clipboard', { value: fake, configurable: true });
  const realExec = document.execCommand.bind(document);
  document.execCommand = (c, ...r) => (window.__failCopy ? false : realExec(c, ...r));
  document.addEventListener('DOMContentLoaded', () => {
    Desk.register({
      id: 'fixture-ai', name: 'Fixture', purpose: 'A test-only recipe.', types: [],
      mount(ctx) {
        ctx.recipe({
          id: 'fixtureq', title: 'Fixture task', blurb: 'Pick the best ones.', where: window.__where || '',
          template: 'Pick the best events.\\n{profile}\\nUp to {n} picks.\\n{items}',
          answer: { L: ['why'], C: ['why'] }, example: 'L1 | why this one fits, in one sentence',
          quota: { L: 4, C: 4 },
          options: [{ id: 'n', label: 'How many picks', default: '3', choices: [{ value: '3', label: 'Three' }, { value: '5', label: 'Five' }] }],
          needs(c) { return c.profile().roles ? [] : [{ text: 'Add the work you look for.', go: 'profile' }]; },
          data(c, opts) {
            return { n: opts.options.n, items: { header: 'alias | title', kinds: {
              L: [{ id: 'ev_a', cols: ['Resume Help'] }, { id: 'ev_b', cols: ['Mock Interviews'] }, { id: 'ev_c', cols: ['Networking Night'] }],
              C: [{ id: 'ev_d', cols: ['City Job Fair'] }, { id: 'ev_e', cols: ['Tax Clinic'] }] } } };
          },
          kind: 'event',
        });
      },
    });
  });
})();
"""

ANSWER = """Sure! Here you go:
```
DESK-{code}
L1 | Fits the work you look for.
C4 | Employers hire on the spot.
L2 | Good practice for interviews.
```
Hope this helps."""


def open_ai(page, app, with_profile=True):
    page.add_init_script(INIT)
    page.goto(app.url + "#ai/fixtureq")  # the task is named so a built file (real recipes registered first) opens it too
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-test="ai-task-fixtureq"]')
    if with_profile:
        page.evaluate("() => { Desk.store.put({type: 'profile', roles: 'Office administration'}); }")
        page.wait_for_function("() => !document.querySelector('[data-test=\"ai-needs\"]')")


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


def copy_question(page):
    """Click Copy and open; return (text copied, code)."""
    before = page.evaluate("() => window.__copied.length")
    page.click('[data-test="ai-copy-open"]')
    page.wait_for_selector('[data-test="ai-copied"]')
    copied = page.evaluate("() => window.__copied")
    assert len(copied) == before + 1
    text = copied[-1]
    return text, re.search(r"DESK-([0-9A-Z]{4})", text).group(1)


def result_text(page):
    page.wait_for_selector('[data-test="ai-result-text"]')
    return page.locator('[data-test="ai-result-text"]').inner_text()


def suggestions(page):
    return desk_eval(page, "Desk.store.all('suggestion').map(s => s.id).sort()")


def test_ai_needs_message_with_a_link_to_fix_it(page, app):
    open_ai(page, app, with_profile=False)
    page.wait_for_selector('[data-test="ai-needs"]')
    assert "work you look for" in page.locator('[data-test="ai-needs"]').inner_text()
    assert page.locator('[data-test="ai-copy-open"]').is_disabled()
    assert page.locator('[data-test="ai-copy"]').is_disabled()
    page.click('[data-test="ai-needs-fix"]')
    page.wait_for_function("() => location.hash === '#profile'")
    page.evaluate("() => { Desk.store.put({type: 'profile', roles: 'Clerk'}); location.hash = '#ai'; }")
    page.wait_for_selector('[data-test="ai-copy-open"]:not([disabled])')
    assert page.locator('[data-test="ai-needs"]').count() == 0
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_round_trip_copy_paste_undo_and_already_added(page, app):
    open_ai(page, app)
    # the first copy shows the privacy line, the preview is the exact text that is copied
    assert "no name or contact details" in page.locator('[data-test="ai-privacy"]').inner_text()
    page.click('[data-test="ai-preview"] summary')
    preview = page.locator('[data-test="ai-preview-text"]').inner_text()
    assert "Office administration" in preview and "L1 | Resume Help" in preview and "C4 | City Job Fair" in preview
    assert "Up to 3 picks." in preview
    text, code = copy_question(page)
    assert text.strip() == preview.strip()
    assert page.evaluate("() => window.__opened.length") == 1
    url, target = page.evaluate("() => window.__opened[0].slice(0, 2)")
    assert url == "https://chatgpt.com/" and target == "_blank"
    assert "noopener" in page.evaluate("() => window.__opened[0][2]")
    assert desk_eval(page, "Desk.store.get('settings').seenPrivacyNote") is True
    # the question waits across a reload, and the privacy line is quiet after the first time
    page.wait_for_selector('[data-test="ai-pending"]')
    page.reload()
    wait_for_desk(page, started=True)
    pending = page.locator('[data-test="ai-pending"]')
    pending.wait_for()
    assert code in pending.inner_text()
    assert page.locator('[data-test="ai-privacy"]').count() == 0
    # paste the answer: it is read at once
    answer = ANSWER.format(code=code)
    paste(page, answer)
    assert result_text(page).startswith("3 suggestions added.")
    assert suggestions(page) == sorted(["s_%s_l1" % code.lower(), "s_%s_l2" % code.lower(), "s_%s_c4" % code.lower()])
    assert page.locator('[data-test="ai-pending"]').count() == 0
    one = desk_eval(page, "Desk.store.get('s_%s_c4')" % code.lower())
    assert one["target"] == "ev_d" and one["why"] == "Employers hire on the spot." and one["status"] == "new"
    assert one["source"] == "ai" and one["recipe"] == "fixtureq" and one["code"] == code and one["kind"] == "event"
    assert page.locator(PASTE_BOX).input_value() == ""
    # Undo takes the suggestions and the answered mark back
    page.click('[data-test="ai-undo"]')
    page.wait_for_function("() => Desk.store.all('suggestion').length === 0")
    page.wait_for_selector('[data-test="ai-pending"]')
    # paste again: added again, then a third time: Already added, nothing changes, no new Undo
    paste(page, answer)
    page.wait_for_function("() => Desk.store.all('suggestion').length === 3")
    page.wait_for_selector('[data-test="ai-undo"]')
    stamp = desk_eval(page, "Desk.store.state().records")
    paste(page, answer)
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-result-text\"]').innerText.startsWith('Already added')")
    assert page.locator('[data-test="ai-undo"]').count() == 0
    assert desk_eval(page, "Desk.store.state().records") == stamp
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_broken_answer_fixit_message_and_fixed_answer(page, app):
    open_ai(page, app)
    _, code = copy_question(page)
    paste(page, "DESK-%s\nL1 | Fine.\nL9 | There is no L9.\nC4 | Also fine." % code)
    assert result_text(page).startswith("2 suggestions added.")
    assert page.locator('[data-test="ai-problem"]').inner_text() == "1 line could not be read."
    assert "L9" in page.locator('[data-test="ai-rejected"]').inner_text()
    page.click('[data-test="ai-fixit"]')
    page.wait_for_selector('[data-test="ai-fixit-status"]')
    msg = page.evaluate("() => window.__copied[window.__copied.length - 1]")
    assert "Code: DESK-%s" % code in msg
    assert "L9 | There is no L9." in msg and "is not one of the items" in msg
    assert "L1 | Fine." not in msg
    assert "First line: DESK-%s" % code in msg and "L1 | why this one fits" in msg
    assert "ONLY" in msg
    # the fixed answer adds only what was missing
    paste(page, "DESK-%s\nL1 | Fine.\nL2 | Now fixed.\nC4 | Also fine." % code)
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-result-text\"]').innerText.startsWith('1 added. 2 were already here.')")
    assert len(suggestions(page)) == 3
    assert page.locator('[data-test="ai-fixit"]').count() == 0
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_could_be_better_saves_a_note(page, app):
    open_ai(page, app)
    _, code = copy_question(page)
    paste(page, "DESK-%s\nL1 | Fine." % code)
    result_text(page)
    page.click('[data-test="ai-better"]')
    page.fill('[data-test="ai-better-text"]', "It picked events too far from Scarborough.")
    page.click('[data-test="ai-better-save"]')
    page.wait_for_selector('[data-test="ai-better-done"]')
    notes = desk_eval(page, "Desk.store.all('recipe-note')")
    assert len(notes) == 1
    assert notes[0]["recipe"] == "fixtureq" and notes[0]["code"] == code
    assert notes[0]["text"] == "It picked events too far from Scarborough." and notes[0]["used"] is False
    # one tap with no sentence is fine too
    paste(page, "DESK-%s\nL2 | Fine." % code)
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-better\"]')")
    page.click('[data-test="ai-better"]')
    page.click('[data-test="ai-better-save"]')
    page.wait_for_function("() => Desk.store.all('recipe-note').length === 2")
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_odd_pastes_say_what_happened(page, app):
    open_ai(page, app)
    paste(page, "DESK-ZZZZ\nL1 | Fine.")
    assert "no question yet" in result_text(page)
    text, code = copy_question(page)
    paste(page, "DESK-ZZZZ\nL1 | Fine.")
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-result-text\"]').innerText.includes('another device')")
    paste(page, text)  # the question pasted back
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-result-text\"]').innerText.startsWith('That is the question')")
    paste(page, "L1 | No code in this one.")
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-result-text\"]').innerText.startsWith('1 suggestion added.')")
    assert "No code found; used your last question." in page.locator('[data-test="ai-note"]').inner_text()
    assert suggestions(page) == ["s_%s_l1" % code.lower()]
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_answer_pasted_on_the_data_screen_goes_to_the_ai_helper(page, app):
    open_ai(page, app)
    _, code = copy_question(page)
    page.goto(app.url + "#data")
    page.wait_for_selector('[data-screen="data"] ' + PASTE_BOX)
    paste(page, "DESK-%s\nL1 | Fine.\nL2 | Fine too." % code)
    page.wait_for_function("() => location.hash.startsWith('#ai')")
    assert result_text(page).startswith("2 suggestions added.")
    assert len(suggestions(page)) == 2
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_paste_button_and_service_picker(page, app):
    open_ai(page, app)
    page.click('[data-test="ai-service"] [data-service="claude"]')
    page.wait_for_function("() => Desk.store.get('settings').service === 'claude'")
    assert page.locator('[data-test="ai-copy-open"]').inner_text() == "Copy and open Claude"
    _, code = copy_question(page)
    assert page.evaluate("() => window.__opened[0][0]") == "https://claude.ai/new"
    page.evaluate("(t) => { window.__clip = t; }", "DESK-%s\nC5 | Fine." % code)
    page.click('[data-test="paste-button"]')
    assert result_text(page).startswith("1 suggestion added.")
    # "Just copy" does not open anything; the service is remembered across a reload
    page.reload()
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-test="ai-copy"]')
    before = page.evaluate("() => window.__opened.length")
    page.click('[data-test="ai-copy"]')
    page.wait_for_selector('[data-test="ai-copied"]')
    assert page.evaluate("() => window.__opened.length") == before
    assert page.locator('[data-test="ai-copy-open"]').inner_text() == "Copy and open Claude"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_option_changes_the_question(page, app):
    open_ai(page, app)
    page.select_option('[data-test="ai-opt-n"]', "5")
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-opt-n\"]').value === '5'")
    page.click('[data-test="ai-preview"] summary')
    assert "Up to 5 picks." in page.locator('[data-test="ai-preview-text"]').inner_text()
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_copy_that_fails_shows_the_text_to_press_and_hold(page, app):
    open_ai(page, app)
    page.evaluate("() => { window.__failCopy = true; }")
    page.click('[data-test="ai-copy-open"]')
    box = page.locator('[data-test="ai-copy-fallback"]')
    box.wait_for()
    assert "HOW TO ANSWER" in box.input_value()
    assert page.evaluate("() => window.__opened.length") == 0, "the chat is not opened until the person has the text"
    assert page.locator('[data-test="ai-open-link"]').count() == 1
    page.wait_for_selector('[data-test="ai-pending"]')
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ai_result_line_names_where(page, app):
    page.add_init_script("window.__where = 'Events';")
    open_ai(page, app)
    _, code = copy_question(page)
    paste(page, "DESK-%s\nL1 | Fine.\nL2 | Fine." % code)
    assert result_text(page).startswith("2 suggestions added to Events.")
    assert_no_errors(page, allow=ALLOW_MISSING)
