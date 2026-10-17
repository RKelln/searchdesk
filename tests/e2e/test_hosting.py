"""Hosting (T4.2): the service worker and offline, the install hint on phones, and the storage request.
The service worker and the page-offline test need the built file over http (--app dist/searchdesk.html)."""

from helpers import Skip, assert_no_errors, wait_for_desk

HINT = '[data-test="install-hint"]'
DISMISS = '[data-test="install-dismiss"]'
PHONE = {"width": 390, "height": 760}
DESKTOP = {"width": 1280, "height": 800}
# WebKit may have no navigator.storage at all, so the stub makes one when it is missing.
STUB = """() => { window.__persistCalls = 0;
  var persist = () => { window.__persistCalls++; return Promise.resolve(true); };
  try {
    if (navigator.storage) Object.defineProperty(navigator.storage, 'persist', { configurable: true, value: persist });
    else Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist: persist } });
  } catch (e) {} }"""


def open_app(page, app, size=DESKTOP):
    page.set_viewport_size(size)
    page.goto(app.url)
    wait_for_desk(page, started=True)


def test_install_hint_shows_once_on_a_phone_then_stays_hidden(page, app):
    if app.origin != "http":
        raise Skip("the hint is for the hosted copy")
    open_app(page, app, PHONE)
    page.wait_for_selector(HINT, state="visible")
    assert "home screen" in page.inner_text(HINT)
    page.click(DISMISS)
    assert not page.is_visible(HINT)
    page.reload()
    wait_for_desk(page, started=True)
    assert not page.is_visible(HINT)
    assert_no_errors(page, allow=["/features/", "Failed to load resource"])


def test_install_hint_hidden_on_desktop(page, app):
    if app.origin != "http":
        raise Skip("the hint is for the hosted copy")
    open_app(page, app, DESKTOP)
    assert not page.is_visible(HINT)


def test_install_hint_hidden_on_file(page, app):
    if app.origin != "file":
        raise Skip("this case is file:// only")
    open_app(page, app, PHONE)
    assert not page.is_visible(HINT)


def test_install_hint_hidden_when_installed(page, app):
    if app.origin != "http":
        raise Skip("the hint is for the hosted copy")
    page.emulate_media(media=None)
    page.add_init_script("Object.defineProperty(navigator, 'standalone', { value: true });")
    open_app(page, app, PHONE)
    assert not page.is_visible(HINT)


def test_persist_is_asked_once_after_the_first_save(page, app):
    if app.origin != "http":
        raise Skip("the request is for the hosted copy")
    page.add_init_script("(" + STUB + ")()")
    open_app(page, app)
    assert page.evaluate("() => window.__persistCalls") == 0
    page.evaluate("() => { Desk.store.put({type: 'job', title: 'Line cook', stage: 'saved'}); Desk.persist.flush(); }")
    page.evaluate("() => { Desk.store.put({type: 'job', title: 'Cook two', stage: 'saved'}); Desk.persist.flush(); }")
    assert page.evaluate("() => window.__persistCalls") == 1


def test_persist_not_asked_on_file(page, app):
    if app.origin != "file":
        raise Skip("this case is file:// only")
    page.add_init_script("(" + STUB + ")()")
    open_app(page, app)
    page.evaluate("() => { Desk.store.put({type: 'job', title: 'Line cook', stage: 'saved'}); Desk.persist.flush(); }")
    assert page.evaluate("() => window.__persistCalls") == 0


def test_service_worker_caches_the_page_for_offline(page, app):
    if not app.built:
        raise Skip("the service worker only runs from a built copy; use --app dist/searchdesk.html")
    if app.origin != "http":
        raise Skip("no service worker on file://")
    open_app(page, app)
    ready = page.evaluate("""async () => {
      if (!('serviceWorker' in navigator)) return 'none';
      await navigator.serviceWorker.ready; return 'ready'; }""")
    if ready == "none":
        raise Skip("this browser has no service worker here")
    page.wait_for_function("async () => (await caches.keys()).length > 0")
    keys = page.evaluate("async () => await caches.keys()")
    version = page.evaluate("() => Desk.version")
    assert keys == ["searchdesk-" + version], keys
    page.reload()  # now controlled by the worker
    wait_for_desk(page, started=True)
    if page.context.browser and page.context.browser.browser_type.name == "webkit":
        raise Skip("Playwright's WebKit cannot reload offline under a service worker; Chromium covers it")
    page.context.set_offline(True)
    try:
        page.reload()
        wait_for_desk(page, started=True)
        assert page.title() == "Search Desk"
    finally:
        page.context.set_offline(False)


def test_service_worker_is_not_registered_on_file(page, app):
    if app.origin != "file":
        raise Skip("this case is file:// only")
    open_app(page, app)
    # On file:// Chromium throws on getRegistrations, which also means nothing can be registered.
    n = page.evaluate("""async () => {
      try { return 'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0; }
      catch (e) { return 0; } }""")
    assert n == 0
