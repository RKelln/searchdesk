"""Reference test for the `sites` brief: the 'Done when' list, in a copy where sites is listed."""

from helpers import assert_no_errors, wait_for_desk, read_toasts

ALLOW_MISSING = ["/features/", "Failed to load resource"]
ROW = '[data-test="site-row"]'


def open_sites(page, app):
    page.goto(app.url + "#sites")
    wait_for_desk(page, started=True)
    page.wait_for_selector('[data-screen="sites"]')


def sites(page):
    return page.evaluate("() => Desk.store.all('site').map(s => ({name: s.name, url: s.url, note: s.note, id: s.id}))")


def fill_add(page, name, url="", note=""):
    page.click('[data-test="sites-add"]')
    page.fill('[data-test="sites-name"]', name)
    page.fill('[data-test="sites-url"]', url)
    page.fill('[data-test="sites-note"]', note)
    page.click('[data-test="sites-save"]')


def seed_leads(page):
    page.evaluate("""() => { Desk.store.batch('seed', () => {
      Desk.store.put({type: 'suggestion', id: 'l1', recipe: 'events', kind: 'lead', status: 'new', why: 'Good for cooks.',
        target: {title: 'Cook Jobs', url: 'https://www.cookjobs.example/search'}, source: 'ai'});
      Desk.store.put({type: 'suggestion', id: 'l2', recipe: 'events', kind: 'lead', status: 'new', why: 'No link here.',
        target: {title: 'Word of mouth', url: ''}, source: 'ai'});
      Desk.store.put({type: 'suggestion', id: 'l3', recipe: 'events', kind: 'lead', status: 'new', why: 'Same as one I have.',
        target: {title: 'Job Bank again', url: 'https://jobbank.gc.ca'}, source: 'ai'});
      Desk.store.put({type: 'suggestion', id: 'l4', recipe: 'events', kind: 'lead', status: 'new', why: 'Odd link.',
        target: {title: 'Odd', url: 'javascript:alert(1)'}, source: 'ai'});
      Desk.store.put({type: 'suggestion', id: 'e1', recipe: 'events', kind: 'event', status: 'new', target: 'x', source: 'ai'});
    }); }""")


def test_ref_sites_menu_empty_and_start_list(page, app):
    open_sites(page, app)
    assert page.locator('[data-test="nav-sites"]').count() == 1
    assert "Job sites" in page.locator('[data-test="nav-sites"]').inner_text()
    assert page.locator('[data-test="sites-empty"]').count() == 1
    start = page.locator('[data-test="sites-start"] [data-test="start-row"]')
    assert start.count() == 1 and "Job Bank" in start.first.inner_text()
    start.first.locator('[data-test="start-add"]').click()
    page.wait_for_selector(ROW)
    assert [s["name"] for s in sites(page)] == ["Job Bank"]
    assert page.locator('[data-test="sites-start"]').count() == 0  # already added: not shown
    assert page.locator('[data-test="sites-empty"]').count() == 0
    assert page.locator(ROW + ' a').get_attribute("href") == "https://www.jobbank.gc.ca/"
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ref_sites_add_edit_delete_undo(page, app):
    open_sites(page, app)
    # a name is needed
    page.click('[data-test="sites-add"]')
    page.click('[data-test="sites-save"]')
    assert "name" in page.locator('[data-test="sites-problem"]').inner_text().lower()
    # a bad link is refused
    page.fill('[data-test="sites-name"]', "Zeta Jobs")
    page.fill('[data-test="sites-url"]', "ftp://zeta.example")
    page.click('[data-test="sites-save"]')
    assert "https://" in page.locator('[data-test="sites-problem"]').inner_text()
    assert sites(page) == []
    page.click('[data-test="sites-cancel"]')
    # add two; they sort by name
    fill_add(page, "Zeta Jobs", "https://zeta.example/", "Check on Mondays.")
    page.wait_for_selector(ROW)
    fill_add(page, "alpha board", "", "No link on this one.")
    page.wait_for_function("document.querySelectorAll('[data-test=site-row]').length === 2")
    names = page.eval_on_selector_all(ROW + " h4", "els => els.map(e => e.textContent)")
    assert names == ["alpha board", "Zeta Jobs"], names
    rows = page.locator(ROW)
    assert rows.nth(0).locator("a").count() == 0
    link = rows.nth(1).locator('[data-test="site-link"]')
    assert link.get_attribute("href") == "https://zeta.example/" and link.get_attribute("target") == "_blank"
    assert "Check on Mondays." in rows.nth(1).inner_text()
    # the same link twice is refused (ignoring capitals, www and a last slash)
    page.click('[data-test="sites-add"]')
    page.fill('[data-test="sites-name"]', "Zeta again")
    page.fill('[data-test="sites-url"]', "HTTPS://www.ZETA.example")
    page.click('[data-test="sites-save"]')
    assert page.locator('[data-test="sites-problem"]').inner_text().strip() != ""
    assert len(sites(page)) == 2
    page.click('[data-test="sites-cancel"]')
    # edit
    page.locator(ROW).nth(1).locator('[data-test="site-edit"]').click()
    assert page.input_value('[data-test="sites-name"]') == "Zeta Jobs"
    page.fill('[data-test="sites-name"]', "Zeta Careers")
    page.click('[data-test="sites-save"]')
    page.wait_for_function("document.querySelector('[data-test=site-row]') && document.body.innerText.includes('Zeta Careers')")
    assert sorted(s["name"] for s in sites(page)) == ["Zeta Careers", "alpha board"]
    # delete and undo
    page.locator(ROW).nth(1).locator('[data-test="site-delete"]').click()
    page.wait_for_function("document.querySelectorAll('[data-test=site-row]').length === 1")
    assert any("deleted" in t for t in read_toasts(page))
    page.click('[data-test="toast-undo"]')
    page.wait_for_function("document.querySelectorAll('[data-test=site-row]').length === 2")
    assert len(sites(page)) == 2
    assert_no_errors(page, allow=ALLOW_MISSING)


def test_ref_sites_leads_lane(page, app):
    open_sites(page, app)
    fill_add(page, "Job Bank", "https://www.jobbank.gc.ca/")
    page.wait_for_selector(ROW)
    seed_leads(page)
    page.wait_for_selector('[data-test="sites-leads"]')
    leads = page.locator('[data-test="lead-row"]')
    assert leads.count() == 4, leads.count()  # the event suggestion is not here
    first = leads.filter(has_text="Cook Jobs")
    assert first.locator('[data-test="lead-domain"]').inner_text().endswith("cookjobs.example")
    assert first.locator("a").count() == 0  # the domain is plain text, not a link
    assert "Good for cooks." in first.inner_text()
    assert first.locator('[data-test="lead-ai-mark"]').inner_text() == "From AI, not checked"
    # a lead with no link or a script link: shown, no link, no domain
    for title in ("Word of mouth", "Odd"):
        row = leads.filter(has_text=title)
        assert row.locator("a").count() == 0 and row.locator('[data-test="lead-domain"]').count() == 0
    # a lead for a site I have
    have = leads.filter(has_text="Job Bank again")
    assert have.locator('[data-test="lead-have"]').inner_text() == "You have this one"
    have.locator('[data-test="lead-take"]').click()
    page.wait_for_function("document.querySelectorAll('[data-test=lead-row]').length === 3")
    assert len(sites(page)) == 1
    assert page.evaluate("() => Desk.store.get('l3').status") == "taken"
    # take one: it becomes a site, the status changes in one undo step
    page.locator('[data-test="lead-row"]', has_text="Cook Jobs").locator('[data-test="lead-take"]').click()
    page.wait_for_function("document.querySelectorAll('[data-test=lead-row]').length === 2")
    s = [x for x in sites(page) if x["name"] == "Cook Jobs"][0]
    assert s["url"] == "https://www.cookjobs.example/search" and s["note"] == "Good for cooks.", s
    assert page.evaluate("() => Desk.store.get('l1').status") == "taken"
    page.click('[data-test="toast-undo"]')
    page.wait_for_function("document.querySelectorAll('[data-test=lead-row]').length === 3")
    assert [x["name"] for x in sites(page)] == ["Job Bank"]
    assert page.evaluate("() => Desk.store.get('l1').status") == "new"
    # take with no link
    page.locator('[data-test="lead-row"]', has_text="Word of mouth").locator('[data-test="lead-take"]').click()
    page.wait_for_function("document.querySelectorAll('[data-test=lead-row]').length === 2")
    assert any(x["name"] == "Word of mouth" and x["url"] == "" for x in sites(page))
    # not for me
    page.locator('[data-test="lead-row"]', has_text="Odd").locator('[data-test="lead-dismiss"]').click()
    page.wait_for_function("document.querySelectorAll('[data-test=lead-row]').length === 1")
    assert page.evaluate("() => Desk.store.get('l4').status") == "dismissed"
    assert_no_errors(page, allow=ALLOW_MISSING)
