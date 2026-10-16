"""Reference e2e for the print feature (one-page summary). Covers the brief's "Done when" list.

The clock is fixed to Fri Oct 16 2026, noon, so "this week" is Oct 16 to Oct 22."""

from helpers import assert_no_errors, wait_for_desk

SCREEN = '[data-screen="print"]'
SEED = """() => {
  Desk.setNow(new Date(2026, 9, 16, 12, 0));
  Desk.store.batch('seed', () => {
    Desk.store.put({type: 'job', title: 'Late Clerk', stage: 'applied', followUp: '2026-10-14'});
    Desk.store.put({type: 'job', title: 'Cook', stage: 'applied', followUp: '2026-10-19'});
    Desk.store.put({type: 'job', title: 'Office Admin', stage: 'interview', interviewAt: '2026-10-21T10:00'});
    Desk.store.put({type: 'job', title: 'Library Page', stage: 'saved', closes: '2026-10-22'});
    Desk.store.put({type: 'job', title: 'Closed One', stage: 'closed', followUp: '2026-10-18'});
    Desk.store.put({type: 'job', title: 'Next Month', stage: 'saved', closes: '2026-11-30'});
    Desk.store.put({type: 'event-mark', eventId: 'e1', status: 'starred',
      copy: {title: 'Hiring Fair', start: '2026-10-18T13:00', end: '2026-10-18T16:00', venue: 'Hall A', url: '', tier: 'city'}});
    Desk.store.put({type: 'event-mark', eventId: 'e2', status: 'starred',
      copy: {title: 'Far Away', start: '2026-11-02T10:00', end: '', venue: 'Hall B', url: '', tier: 'city'}});
  });
  location.hash = '#print'; location.hash = '#home'; location.hash = '#print';
}"""


def open_print(page, app):
    page.goto(app.url + "#print")
    wait_for_desk(page, started=True)
    page.wait_for_selector(SCREEN)


def seed(page, app):
    open_print(page, app)
    page.evaluate(SEED)
    page.wait_for_selector(SCREEN)


def section_titles(page, heading):
    return page.evaluate("""(h) => {
      const sec = [...document.querySelectorAll('[data-screen="print"] section')]
        .find((s) => s.querySelector('h3') && s.querySelector('h3').textContent === h);
      return sec ? [...sec.querySelectorAll('li strong')].map((x) => x.textContent) : null;
    }""", heading)


def test_print_menu_date_and_button(page, app):
    page.goto(app.url + "#home")
    wait_for_desk(page, started=True)
    page.evaluate("() => Desk.setNow(new Date(2026, 9, 16, 12, 0))")
    page.click('[data-test="nav-print"]')
    page.wait_for_selector(SCREEN)
    text = page.locator(SCREEN).inner_text()
    assert "Today is" in text and "Oct" in text, text
    assert page.locator(SCREEN + ' button:has-text("Print or save as PDF")').count() == 1
    assert_no_errors(page)


def test_print_button_opens_print_window(page, app):
    open_print(page, app)
    page.evaluate("() => { window.__printed = 0; window.print = () => { window.__printed++; }; }")
    page.click(SCREEN + ' button:has-text("Print or save as PDF")')
    assert page.evaluate("() => window.__printed") == 1
    assert_no_errors(page)


def test_print_dates_late_and_starred(page, app):
    seed(page, app)
    late = section_titles(page, "Late")
    week = section_titles(page, "Dates this week")
    starred = section_titles(page, "Events I starred")
    assert late == ["Late Clerk"], late
    # earliest first: Cook (Oct 19), Office Admin (Oct 21), Library Page (Oct 22); Closed One and Next Month are out
    assert week == ["Cook", "Office Admin", "Library Page"], week
    assert starred == ["Hiring Fair"], starred
    order = page.evaluate("""() => [...document.querySelectorAll('[data-screen="print"] h3')].map((h) => h.textContent)""")
    assert order.index("Late") < order.index("Dates this week") < order.index("Events I starred"), order
    text = page.locator(SCREEN).inner_text()
    assert "Follow up was due" in text and "Hall A" in text, text
    assert_no_errors(page)


def test_print_nothing_this_week(page, app):
    open_print(page, app)
    page.evaluate("() => { Desk.setNow(new Date(2026, 9, 16, 12, 0)); }")
    page.wait_for_selector(SCREEN)
    assert "Nothing this week." in page.locator(SCREEN).inner_text()
    assert_no_errors(page)


def test_print_other_features_add_sections(page, app):
    seed(page, app)
    page.evaluate("""() => Desk.register({id: 'print-extra', name: 'Extra', purpose: 'x', types: [],
      mount(ctx) {
        ctx.slot('print', {id: 'p', title: 'Extra section', render(el) { el.append(ctx.h('p', {'data-test': 'extra-line'}, 'from another feature')); }});
      }})""")
    page.evaluate("() => { location.hash = '#home'; location.hash = '#print'; }")
    page.wait_for_selector(SCREEN)
    assert page.locator('[data-test="extra-line"]').inner_text() == "from another feature"
    titles = page.evaluate("""() => [...document.querySelectorAll('[data-screen="print"] h3')].map((h) => h.textContent)""")
    assert titles[-1] == "Extra section", titles
    assert_no_errors(page)


def test_print_css_hides_menu(page, app):
    seed(page, app)
    page.emulate_media(media="print")
    assert page.locator("nav.tabs").is_visible() is False
    assert page.locator(SCREEN + ' button:has-text("Print or save as PDF")').is_visible() is False
    page.emulate_media(media="screen")
    assert page.locator("nav.tabs").is_visible() is True
    assert_no_errors(page)
