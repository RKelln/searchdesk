"""Made-up person tests (T2.6): data/example.js and the workshop flags."""

from helpers import assert_no_errors, wait_for_desk

ALLOW_MISSING = ["/features/", "Failed to load resource"]
WORKSHOP = "window.DESK_WORKSHOP = { autoExample: true, liveEvents: false };"
BANNER = '[data-test="banner"]'


def open_app(page, app, hash="#home", workshop=False):
    if workshop:
        page.add_init_script(WORKSHOP)
    page.goto(app.url + hash)
    wait_for_desk(page, started=True)


def counts(page):
    return page.evaluate("""() => {
      const r = Desk.store.all().filter((x) => x.type !== 'settings');
      const n = (t) => r.filter((x) => x.type === t).length;
      return {jobs: n('job'), profiles: n('profile'), marks: n('event-mark'), example: r.filter((x) => x.source === 'example').length,
              total: r.length};
    }""")


def test_example_normal_copy_opens_empty(page, app):
    open_app(page, app, "#data")
    assert counts(page)["total"] == 0
    assert page.locator(BANNER).is_hidden()
    assert page.locator('[data-test="example-try"]').inner_text() == "Try with a made-up person"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_example_workshop_copy_opens_into_amira(page, app):
    open_app(page, app, "#home", workshop=True)
    c = counts(page)
    assert c["jobs"] == 6 and c["profiles"] == 1 and c["marks"] == 2, c
    assert c["example"] == c["total"]
    assert page.locator(BANNER).inner_text() == "Practice computer: use the made-up person only."
    # no personal fields on the profile, and she is named as made up
    p = page.evaluate("() => Desk.store.get('profile')")
    assert not ({"name", "email", "phone"} & set(p))
    assert "made up" in p["background"]
    # loading again (a reload) does not add a second copy
    page.reload()
    wait_for_desk(page, started=True)
    assert counts(page)["jobs"] == 6
    # even with the person's switch on, a workshop copy never fetches
    assert page.evaluate("() => { Desk.store.put({type: 'settings', id: 'settings', liveEvents: true}); return Desk.net.liveEnabled(); }") is False
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_example_dates_are_relative_and_events_are_picked(page, app):
    open_app(page, app, "#data", workshop=True)
    out = page.evaluate("""() => {
      const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n);
        const p = (x) => (x < 10 ? '0' : '') + x; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
      const jobs = Desk.store.all('job');
      const by = (t) => jobs.find((j) => j.title === t);
      const marks = Desk.store.all('event-mark');
      const snapIds = new Set(window.DESK_EVENTS_SNAPSHOT.events.map((e) => e.id));
      return {
        today: by('Accounts Payable Clerk').followUp === iso(0),
        interview: by('Office Administrator').interviewAt === iso(2) + 'T10:00',
        closes: by('Bookkeeper (part-time)').closes === iso(4),
        overdue: by('Administrative Assistant').followUp === iso(-2),
        marks: marks.map((m) => ({ id: m.id, ok: m.id === 'em_' + m.eventId && m.status === 'starred' && snapIds.has(m.eventId) &&
          m.copy.start.slice(0, 10) >= iso(0), title: m.copy.title.toLowerCase() })),
      };
    }""")
    assert out["today"] and out["interview"] and out["closes"] and out["overdue"], out
    assert all(m["ok"] for m in out["marks"]), out
    words = sorted("resume" if "resume" in m["title"] else "interview" for m in out["marks"])
    assert words == ["interview", "resume"], out
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_example_shows_banner_when_added_by_hand(page, app):
    open_app(page, app, "#data")
    page.click('[data-test="example-try"]')
    page.wait_for_function("document.querySelector('[data-test=banner]') && !document.querySelector('[data-test=banner]').hidden")
    assert "Amira (made up)" in page.locator(BANNER).inner_text()
    page.click('[data-test="example-remove"]')
    page.wait_for_function("document.querySelector('[data-test=banner]').hidden")
    assert counts(page)["total"] == 0 or counts(page)["example"] == 0
    assert_no_errors(page, allow=ALLOW_MISSING)
