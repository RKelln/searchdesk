"""Interview coach tests (T3.6): copy from a job's detail view, the options, and "Copy only the instructions"."""

from pathlib import Path

from helpers import assert_no_errors, desk_eval, wait_for_desk

# Other base features may not exist yet (their files 404 and the shell shows stubs).
ALLOW_MISSING = ["/features/", "Failed to load resource"]
GOLDEN = (Path(__file__).resolve().parents[2] / "tests/unit/golden/coach-v4.txt").read_text()

INIT = """
(() => {
  window.__copied = [];
  window.__opened = [];
  window.__failCopy = false;
  window.open = (...a) => { window.__opened.push(a); return null; };
  const real = navigator.clipboard;
  const fake = {
    writeText(t) {
      window.__copied.push(t);
      if (window.__failCopy) return Promise.reject(new Error('blocked'));
      return real && real.writeText ? real.writeText(t).catch(() => {}) : Promise.resolve();
    },
    readText() { return Promise.resolve(''); },
  };
  Object.defineProperty(navigator, 'clipboard', { value: fake, configurable: true });
  const realExec = document.execCommand.bind(document);
  document.execCommand = (c, ...r) => (window.__failCopy ? false : realExec(c, ...r));
})();
"""

POSTING = "We need a person who can post invoices and answer the phone. " * 100  # 6,000 characters


def seed(page):
    """A profile with a private-looking note and a job with notes, a next step and a long posting."""
    page.evaluate(
        """(posting) => {
            Desk.store.put({type: 'profile', roles: 'Office administration', field: 'Finance and office work',
                            background: 'SECRET-BACKGROUND', replyLanguage: 'English'});
            Desk.store.put({type: 'job', id: 'j_coach', title: 'Office Administrator', org: 'Kingsway Dental Group',
                            where: 'Scarborough', stage: 'interview', asks: 'QuickBooks; scheduling',
                            posting: posting, notes: 'SECRET-NOTE', nextStep: 'SECRET-STEP', link: 'https://example.com/secret'});
        }""",
        POSTING,
    )


def open_app(page, app, hash="#home", workshop=True):
    page.add_init_script(INIT)
    if workshop:
        page.add_init_script("window.DESK_WORKSHOP = { banner: 'Practice computer.' }")
    page.goto(app.url + hash)
    wait_for_desk(page, started=True)


def copied(page):
    return page.evaluate("() => window.__copied")


def test_coach_copy_from_a_jobs_detail_view(page, app):
    open_app(page, app)
    seed(page)
    page.evaluate("() => { location.hash = '#jobs/j_coach'; }")
    page.wait_for_selector('[data-test="job-detail"]')
    assert page.locator('[data-test="action-coach"]').inner_text() == "Practise an interview for this job"
    page.click('[data-test="action-coach"]')
    page.wait_for_function("() => location.hash === '#ai/coach/j_coach'")
    page.wait_for_selector('[data-test="ai-copy-open"]:not([disabled])')
    assert page.locator('[data-test="ai-needs"]').count() == 0
    # the preview is what will be copied
    page.click('[data-test="ai-preview"] summary')
    preview = page.locator('[data-test="ai-preview-text"]').inner_text()
    page.click('[data-test="ai-copy-open"]')
    page.wait_for_selector('[data-test="ai-copied"]')
    text = copied(page)[-1]
    assert text.strip() == preview.strip()
    assert text.startswith("[A question from Search Desk, a job-search page. Code: DESK-")
    # the instructions are v4, then a line, then the labelled context
    head, _, rest = text.partition("\n\n")
    assert rest.startswith(GOLDEN.strip())
    instructions, _, context = rest.partition("\n\n---\n\n")
    assert instructions == GOLDEN.strip() and len(GOLDEN) <= 1500
    profile_part, _, job_part = context.partition("\n\nJob posting:\n")
    assert profile_part.startswith("Candidate profile:\nWhat work: Office administration\nField: Finance and office work")
    assert "Reply language: English" in profile_part
    assert "Job title: Office Administrator" in job_part and "Employer: Kingsway Dental Group" in job_part
    assert "Where: Scarborough" in job_part and "Stage: interview" in job_part
    assert "What they ask for: QuickBooks; scheduling" in job_part
    posting = job_part.split("Posting text:\n")[1].rstrip()
    assert 3990 < len(posting) <= 4000 and POSTING.startswith(posting), 'the posting is cut to 4,000 characters'
    # never notes or anything the person did not choose to share
    for secret in ["SECRET", "example.com"]:
        assert secret not in text
    # no answer is read back: no code to wait for, nothing pending, and the chat opened
    assert desk_eval(page, "Desk.store.all('prompt').length") == 0
    assert page.locator('[data-test="ai-pending"]').count() == 0
    assert page.evaluate("() => window.__opened.length") == 1
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_coach_options_and_copy_only_the_instructions(page, app):
    open_app(page, app, "#ai/coach")
    seed(page)
    page.wait_for_selector('[data-test="ai-copy"]:not([disabled])')
    # tips
    tips = page.locator('[data-test="ai-tips"]').inner_text()
    assert "voice mode" in tips and "Keep these instructions" in tips
    # the default "copy only" is exactly prompt v4
    page.click('[data-test="ai-copy-instructions"]')
    page.wait_for_selector('[data-test="ai-part-copied"]')
    assert copied(page)[-1] == GOLDEN
    assert page.locator('[data-test="ai-part-copied"]').inner_text().startswith("Copied.")
    # options change the question, inside the same sentences
    page.select_option('[data-test="ai-opt-research"]', "off")
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-opt-research\"]').value === 'off'")
    page.select_option('[data-test="ai-opt-questions"]', "5")
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-opt-questions\"]').value === '5'")
    page.select_option('[data-test="ai-opt-language"]', "French")
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-opt-language\"]').value === 'French'")
    page.click('[data-test="ai-copy-instructions"]')
    page.wait_for_function("() => window.__copied.length === 2")
    only = copied(page)[-1]
    assert "search" not in only and "Ask 5 main questions" in only and "After 5 questions" in only
    assert "Reply in French." in only and len(only) <= 1500
    assert "Candidate profile" not in only and "Job posting" not in only
    # the whole question with no job: the profile goes, the posting block does not
    page.click('[data-test="ai-copy"]')
    page.wait_for_function("() => window.__copied.length === 3")
    whole = copied(page)[-1]
    assert whole.count(only.strip()) == 1 and "Candidate profile:\nWhat work: Office administration" in whole
    assert "Job posting:" not in whole and "SECRET" not in whole
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_coach_for_a_job_that_is_gone(page, app):
    open_app(page, app, "#ai/coach/j_gone")
    page.wait_for_selector('[data-test="ai-needs"]')
    assert "not here" in page.locator('[data-test="ai-needs"]').inner_text()
    assert page.locator('[data-test="ai-copy-open"]').is_disabled()
    assert page.locator('[data-test="ai-copy-instructions"]').is_disabled()
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_coach_copy_that_fails_shows_the_instructions_to_press_and_hold(page, app):
    open_app(page, app, "#ai/coach")
    page.wait_for_selector('[data-test="ai-copy-instructions"]:not([disabled])')
    page.evaluate("() => { window.__failCopy = true; }")
    page.click('[data-test="ai-copy-instructions"]')
    box = page.locator('[data-test="ai-part-fallback"]')
    box.wait_for()
    assert box.input_value() == GOLDEN
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_coach_normal_copy_defaults_to_five_questions_without_the_workshop_line(page, app):
    open_app(page, app, "#ai/coach", workshop=False)
    page.wait_for_selector('[data-test="ai-copy-instructions"]:not([disabled])')
    assert page.locator('[data-test="ai-opt-questions"]').input_value() == "5"
    page.click('[data-test="ai-copy-instructions"]')
    page.wait_for_function("() => window.__copied.length === 1")
    normal = copied(page)[-1]
    assert "Ask 5 main questions" in normal and "After 5 questions" in normal
    assert "Workshops" not in normal and "fictional person" not in normal and len(normal) <= 1500
    # the person can still pick 3: then it is v4 without the workshop sentence
    page.select_option('[data-test="ai-opt-questions"]', "3")
    page.wait_for_function("() => document.querySelector('[data-test=\"ai-opt-questions\"]').value === '3'")
    page.click('[data-test="ai-copy-instructions"]')
    page.wait_for_function("() => window.__copied.length === 2")
    assert copied(page)[-1] == GOLDEN.replace(" Workshops: fictional person only, never my own details.", "")
    assert_no_errors(page, allow=ALLOW_MISSING)
