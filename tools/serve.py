#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Serve Search Desk for a workshop, where a person watches an agent change it.  Run:

    uv run tools/serve.py                # the page, reloading itself when a file changes
    python3 tools/serve.py               # the same thing where uv is not installed: standard library only
    uv run tools/serve.py --workshop     # opens straight into Amira, banner on, asks the network for nothing
    uv run tools/serve.py --rebuild      # also rewrites dist/workshop/searchdesk.html whenever a file changes
    uv run tools/serve.py --mirror       # also keeps searchdesk-live.json up to date, so an agent can read the desk

Then open the URL it prints.  The full run-through for a host is in docs/WORKSHOP.md.  Needs Python 3.9 or newer
and nothing else: no packages, no install step, nothing to keep up to date.

Why this exists
  The page needs no server: opening index.html from a file works, and that is the documented way to build a
  feature (docs/BUILDING.md). But in a workshop somebody is watching a screen while an agent edits, and "save,
  then reload the page by hand" is a step people forget. This serves the source folder over http and reloads the
  page when a file changes. There is no build step: the page loads features/<id>.js as its own file, so the
  agent's next save is the next reload.

  It also cannot go stale, on two counts. Every response says no-store, and the source page never registers the
  service worker: core/hosting.js only registers it when Desk.version is set, and only tools/build.py sets that.
  So what is on the screen is what is on the disk.

  A reload is not allowed to cost anyone their typing. When a text box has focus and something in it, the page
  shows a small bar and waits for a click. Half a job note is worth more than a fresh screen, and the scroll
  place is kept either way.

Showing a screen, so nobody has to hunt for the new tab
  Write a screen's name into .dev-go in this folder -- one word, for example `sites` -- and the open tab goes
  there by itself. That is what the other half of a workshop needs: the agent finishes a feature, says "look at
  this", and the screen that is already open moves to it. No new tab, no keyboard shortcut, no AppleScript.

  It is a one-shot note. The server hands it to the page as it sends that page and takes it out of the file
  again, so writing the same word twice works twice, and the file is never a thing the app depends on.

  The tab moves with Desk.ui.go(), the app's own way of changing screen, so a name that is not a screen falls
  back to Home rather than breaking anything. A name is only ever a lowercase id and a slash (60 characters,
  no quotes or spaces); anything else in the file is ignored and said out loud.

Why a poll and not a server-sent events stream
  Events would arrive sooner and carry the same message, at the price of a held-open connection per tab, a
  reconnect story, and a second moving part to break in a room with no technician. A poll of one small file
  once a second is invisible to a person and is the same code in every browser. Coming back to a tab that was
  asleep re-checks at once, so the wait is never noticed.

Two things a served copy does not have to worry about
  The workshop *build* (tools/build.py --workshop) sets connect-src 'none', which would block any connection the
  page makes, including a reload signal. This server never serves that file: /dist is refused, along with
  everything else the page does not load. The source page has no Content-Security-Policy at all -- the build
  adds one, and only the build -- so there is nothing here to widen.

  file:// has browser-specific rules for storage and for events between tabs. Serving over http on
  127.0.0.1 gives one ordinary origin where localStorage behaves the same everywhere, which is also why the
  person's data survives a reload here but not always from a file.

What it serves, and what it does not
  Only what the page needs: index.html, core/, locale/, data/, features/ and checks/. Not .git, not docs/, not
  tools/, not tests/, not reference/, not dist/, not screens/, and never a .json -- a person's exported backup
  (searchdesk-<date>.json) can sit in this folder, and --host 0.0.0.0 puts this server on the room's wifi. It
  never changes index.html or any other file the app uses; with --mirror it writes one file of its own,
  searchdesk-live.json.

  The two things it adds are added to what it sends, not to the file: the reload helper, and (with --workshop)
  the same window.DESK_WORKSHOP line the built workshop copy carries. Saving the page from the browser
  therefore saves the plain source page, which is what someone opening it later wants.

Letting an agent see the desk
  The desk's records live in the browser, not in a file, so an agent in this folder cannot read them. With
  --mirror the page sends its records to this server about a second after any change, and the server keeps them in
  searchdesk-live.json: the same shape the Data screen's export makes ("schema", then "records" by id), so anything
  that reads an export reads this. One difference: it includes the made-up person, whose records say
  source: "example", where an export leaves her out. Nobody presses anything. It is one-way: the agent writes back through data/inbox.js, as
  before.

  It is off unless asked for, because the file holds whatever is in the desk, and with a real person's desk that
  is a real person's data landing in a folder they did not choose. It is also the one place this server accepts
  anything from a browser, so it takes three precautions. It binds only to this computer (--mirror with a --host
  that is not local stops with a message). It accepts a write only from this page's own address, which closes the
  door on any other website open in the same browser. And it wants a token that exists only in the page this
  server sent, made fresh each run: without both, a web page could put words of its choosing into the file the
  agent trusts. The file is git-ignored (searchdesk-*.json), is never served back (.json is refused), is replaced
  whole, never half written, and is capped at 8 MB.

Options
  --port N        port to listen on (default 8000; 0 picks a free one)
  --host H        address to bind (default 127.0.0.1; use 0.0.0.0 to open it on a phone or another laptop)
  --workshop      open into the made-up person, show the practice banner, never use the network
  --banner TEXT   with --workshop, the banner words
  --rebuild       also rebuild dist/workshop/ when a file changes, so the copy to take home stays fresh
  --mirror        keep searchdesk-live.json up to date with what is in the desk (see above)
  --no-reload     serve the files exactly as they are, with no reload helper
  --quiet         do not log each request
  --check         print the files it would watch and stop (for working out why nothing reloads)

Standard library only. Bash 3.2 / macOS note: this needs Python 3, so it is for the machine running the
workshop; the people in the room need a browser and nothing else.
"""

import argparse
import functools
import hashlib
import http.server
import importlib.util
import json
import hmac
import os
import posixpath
import re
import secrets
import socket
import sys
import threading
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# What the page loads. Everything else is refused: a dev server that also hands out .git and a person's exported
# backup is not worth the convenience, and --host 0.0.0.0 puts it on the wifi.
WATCH_DIRS = ("core", "locale", "data", "features", "checks")
WATCH_FILES = ("index.html", ".dev-go")
GO_FILE = ".dev-go"
NEVER = (".git", "docs", "tools", "tests", "reference", "dist", "screens", "node_modules", "__pycache__")
# A screen name: a lowercase id, and at most one / for a screen behind a tap (sites/new). Nothing else, because
# this text ends up in the page as a route and nowhere else.
MIRROR_FILE = "searchdesk-live.json"
MIRROR_ROUTE = "/__desk"
MIRROR_MAX = 8 * 1024 * 1024
LOCAL_NAMES = ("127.0.0.1", "localhost", "[::1]")
GO_RE = re.compile(r"^#?[a-z][a-z0-9-]*(?:/[a-z0-9-]+)?$")


# ---- pure parts (tested in tests/unit/test_serve.py) ----------------------------------------------------

def is_public(rel):
    """Is this repo-relative path one the page may have? Pure, so it is easy to test: 'core/desk.js' yes,
    'features/x.js' yes, 'data/inbox.js' yes, '.git/config' no, 'searchdesk-2026-10-18.json' no, 'docs/DESIGN.md'
    no, 'AGENTS.md' no."""
    parts = [p for p in str(rel).replace("\\", "/").split("/") if p and p != "."]
    if not parts:
        return False
    for p in parts:
        if p.startswith("."):                       # .git, .DS_Store, .env: anything hidden, at any level
            return False
        if p in NEVER:
            return False
    name = parts[-1]
    if name.endswith("~") or name.endswith(".json"):   # an editor's backup, or a person's exported copy
        return False
    if name in WATCH_FILES:
        return True
    return len(parts) >= 2 and parts[0] in WATCH_DIRS


def watched_files(root):
    """Every repo-relative path the reload watches, sorted. Deterministic, so a test can compare it."""
    out = [name for name in WATCH_FILES if (root / name).is_file()]
    for folder in WATCH_DIRS:
        base = root / folder
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if path.is_file() and is_public(path.relative_to(root).as_posix()):
                out.append(path.relative_to(root).as_posix())
    return sorted(set(out))


def token_for(root, files):
    """A short string that changes when any watched file changes. Stat only, never a read, so it is cheap
    enough to call on every request. It is a hash of the files, not of a clock, so restarting the server does
    not look like a change and reload nothing."""
    h = hashlib.sha256()
    for rel in files:
        try:
            st = (root / rel).stat()
            h.update(("%s|%d|%d\n" % (rel, st.st_mtime_ns, st.st_size)).encode("utf-8"))
        except OSError:
            h.update(("%s|gone\n" % rel).encode("utf-8"))
    return h.hexdigest()[:12]


def go_route(text):
    """The screen name in .dev-go, or '' when there is not one to act on. First line only, trimmed, no quotes
    and no spaces: this is a route, written by somebody in a hurry, and a typo must not become a route. Returns
    '' rather than raising, because an unreadable note must never take the page down."""
    if not text:
        return ""
    first = str(text).strip().split("\n")[0].strip()
    if not first or len(first) > 60 or not GO_RE.match(first):
        return ""
    return first[1:] if first.startswith("#") else first


def take_go(root):
    """Read .dev-go and take it out of the file: the note is for the next page load and only that one, so
    writing the same screen twice works twice, and nothing in the app ever depends on the file. Returns the
    screen name or ''. A file that cannot be removed is left alone rather than fought over."""
    path = root / GO_FILE
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return ""
    route = go_route(text)
    if not route:
        return ""
    try:
        path.unlink()
    except OSError as e:
        say("  could not take %s out of the file (%s); it will be used again" % (route, e.strerror or e))
    return route


def host_name(host):
    """The name part of a Host header: '127.0.0.1:8000' -> '127.0.0.1', '[::1]:8000' -> '[::1]'."""
    host = str(host or "").strip().lower()
    if host.startswith("["):
        end = host.find("]")
        return host[:end + 1] if end > 0 else host
    return host.rsplit(":", 1)[0] if ":" in host else host


def mirror_allowed(host, origin, sent, expected):
    """May this request write the mirror file? Pure, so the checks are tested without a server.
    The token must match (made fresh each run, only in the page this server sent), the Host header must name this
    computer (a page on another site reaching this server by a name it controls fails here), and when the browser
    says which page is asking, it must be this server's own address."""
    if not expected or not sent or not hmac.compare_digest(str(sent), str(expected)):
        return False
    if host_name(host) not in LOCAL_NAMES:
        return False
    if origin and origin != "http://" + str(host):
        return False
    return True


def mirror_text(body):
    """The text to keep for a posted body, or None when it is not what the Data screen's export makes: bytes of
    JSON that are an object with records, small enough. Anything else is refused, so the file is always
    something an export reader can read."""
    if not body or len(body) > MIRROR_MAX:
        return None
    try:
        data = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return None
    if not isinstance(data, dict) or not isinstance(data.get("records"), (list, dict)):
        return None
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def write_mirror(root, text):
    """Replace the mirror file whole: written beside it, then moved over it, so a reader never sees half."""
    target = Path(root) / MIRROR_FILE
    temp = Path(root) / (MIRROR_FILE + ".tmp")
    temp.write_text(text, encoding="utf-8")
    os.replace(str(temp), str(target))


def workshop_script(banner=None):
    """The window.DESK_WORKSHOP line, the same one tools/build.py --workshop inlines. A closing tag in the banner
    words is escaped, because this line goes straight into a <script> element: without the backslash a banner of
    "</script>" would end the script there and the rest of the line would be read as markup."""
    body = '{ autoExample: true, liveEvents: false'
    if banner:
        body += ', banner: ' + json.dumps(banner, ensure_ascii=True)
    line = re.sub(r"</(script)", r"<\\/\1", "window.DESK_WORKSHOP = " + body + " };\n", flags=re.I)
    return line.replace("<!--", "<\\!--")


RELOAD_JS = """(function () {
  var MARK = 'searchdesk-dev-reload';
  if (window[MARK]) return;                       // the server added this twice, or a second tab: once is enough
  window[MARK] = true;
  var token = %s;                                 // what was on disk when this page was sent
  var go = %s;                                    // a screen to go to, once, or ''
  var waiting = false;
  function typing() {
    var a = document.activeElement;
    if (!a) return false;
    var tag = (a.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA') return true;
    if (tag !== 'INPUT') return false;
    var type = (a.type || 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit') return false;
    return !!a.value;                              // an empty box costs nothing to lose
  }
  function bar() {
    var n = document.createElement('div');
    n.setAttribute('data-test', 'dev-reload-bar');
    n.textContent = 'New version ready.';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Reload now';
    b.style.cssText = 'margin-left:.75rem;font:inherit;font-weight:inherit;padding:.2rem .6rem;'
      + 'border-radius:.4rem;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer';
    b.addEventListener('click', function () { window.location.reload(); });
    n.appendChild(b);
    n.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;'
      + 'align-items:center;justify-content:center;padding:.5rem;font:700 .95rem/1.3 system-ui,sans-serif;'
      + 'color:#fff;background:#0b5cad';
    document.body.appendChild(n);
  }
  function go_() {
    if (waiting) return;
    waiting = true;
    if (typing()) { bar(); return; }               // someone's mid-sentence in a text box: their call, not ours
    try { sessionStorage.setItem('searchdesk-dev-y', String(window.scrollY || 0)); } catch (e) {}
    window.location.reload();
  }
  function restore() {
    var y = 0;
    try { y = Number(sessionStorage.getItem('searchdesk-dev-y') || 0); } catch (e) {}
    if (y > 0 && !typing()) window.scrollTo(0, y);
  }
  function show() {
    // Desk.ui.go() is the app's own way of changing screen, so a name that is not a screen lands on Home
    // instead of breaking anything, and going to the screen you are already on draws it again.
    if (!go) return;
    try {
      if (window.Desk && Desk.ui && Desk.ui.go) Desk.ui.go(go);
      else window.location.hash = '#' + go;
    } catch (e) { window.location.hash = '#' + go; }
  }
  function check() {
    // A tab nobody is looking at is still checked, just less often, and the chain always carries on: a poll
    // that stopped would only start again by luck, and this has to work in a tab that was hidden when it opened.
    fetch('__dev', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      if (t !== token && !document.hidden) go_();
      else setTimeout(check, document.hidden ? 2000 : 1000);
    })['catch'](function () { setTimeout(check, 3000); });   // the laptop asleep, or the server stopped
  }
  window.addEventListener('load', function () {
    if (go) show(); else restore();                // a screen to go to beats putting the old place back
    check();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
})();
"""


MIRROR_JS = """(function () {
  var token = %s;                                 // made fresh each run; only the page this server sent has it
  var timer = null, last = '';
  function ready() { return window.Desk && Desk.store && Desk.store.subscribe && Desk.store.state; }
  function send() {
    timer = null;
    var text;
    try {
      // The Data screen's export leaves the made-up person out, so that a saved copy never carries her. An agent
      // in a workshop has to see her, so this is the same shape with every record in it; each one still says
      // source: "example" when it is hers. Settings are device business and stay out.
      var all = Desk.store.state().records || {}, out = {};
      Object.keys(all).forEach(function (id) { if (all[id] && all[id].type !== 'settings') out[id] = all[id]; });
      text = JSON.stringify({ schema: 'searchdesk/1', mirror: true, records: out }, null, 2) + '\\n';
    } catch (e) { return; }
    if (text === last) return;
    last = text;
    fetch('__desk', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Desk-Token': token },
      body: text })['catch'](function () { last = ''; });   // the server stopped: try again at the next change
  }
  function soon() { if (timer) clearTimeout(timer); timer = setTimeout(send, 800); }
  function start() {
    if (!ready()) { setTimeout(start, 200); return; }
    Desk.store.subscribe(soon);
    soon();
  }
  window.addEventListener('load', start);
})();
"""


def dev_script(reload=True, workshop=False, banner=None, token=None, go=None, mirror_token=None):
    """The text this server adds to the page it sends. Never written to disk, so index.html on disk stays the
    plain source page. With reload=False this is only the workshop line, or nothing at all."""
    parts = []
    if workshop:
        # Inside a script element, not beside it: bare, the line is text on the page, window.DESK_WORKSHOP
        # stays undefined and the desk opens empty with the host's words on show.
        parts.append("<script>" + workshop_script(banner) + "</script>\n")
    if reload:
        parts.append("<script>\n/* Added by tools/serve.py as it sends this page. It is not in the file on disk. */\n"
                     + (RELOAD_JS % (json.dumps(token or ""), json.dumps(go or ""))) + "</script>\n")
    if mirror_token:
        parts.append("<script>\n/* Added by tools/serve.py (--mirror). It is not in the file on disk. */\n"
                     + (MIRROR_JS % json.dumps(mirror_token)) + "</script>\n")
    return "".join(parts)


def add_scripts(html, scripts):
    """The page with `scripts` in its head, so they run before any of the app's own scripts. None when the page
    has no </head>: better to serve it untouched than half-changed."""
    if not scripts:
        return html
    at = html.find("</head>")
    if at < 0:
        return None
    return html[:at] + scripts + html[at:]


def urls_for(host, port):
    """Every address worth printing: a bound 0.0.0.0 also answers on the LAN address, which is what a phone or a
    second laptop needs."""
    shown = "127.0.0.1" if host in ("0.0.0.0", "", "::") else host
    out = ["http://%s:%d/" % (shown, port)]
    if host in ("0.0.0.0", ""):
        lan = lan_address()
        if lan:
            out.append("http://%s:%d/" % (lan, port))
    return out


def lan_address():
    """This machine's address on the local network, or '' when it has none. Opens no connection to the internet:
    a UDP connect picks the route without sending anything."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("192.0.2.1", 9))             # TEST-NET-1: reserved, and never routed to
        return sock.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return ""
    finally:
        sock.close()


def build_workshop(out_dir):
    """Run tools/build.py --workshop in this process. Raises on a broken feature, which the caller prints rather
    than dying on: a syntax error in one feature must not take the page down mid-workshop."""
    spec = importlib.util.spec_from_file_location("desk_build", ROOT / "tools" / "build.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    result = mod.build(out_dir, workshop="")
    return result["version"], result["size"]


# ---- the parts that serve and watch -------------------------------------------------------------------

class Handler(http.server.SimpleHTTPRequestHandler):
    """The files, plus two routes: /__dev (the token) and the page with the workshop line and the reload helper
    added. Every response says no-store, so the screen and the disk agree."""

    server_version = "SearchDeskDev"
    root = ROOT
    reload = True
    workshop = False
    banner = None
    verbose = True
    rebuild = False
    lock = threading.Lock()
    token = ""
    mirror_token = ""                   # empty unless --mirror: then the route exists, and this is what it wants

    def log_message(self, fmt, *args):
        if self.verbose:
            say("  " + (fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    def translate_path(self, path):
        """SimpleHTTPRequestHandler's job, but refusing whatever is_public() says the page has no business
        having. A blocked path is sent to a file that does not exist, so the answer is an ordinary 404."""
        rel = urllib.parse.unquote(urllib.parse.urlparse(path).path)
        rel = posixpath.normpath(rel).lstrip("/")
        if rel in ("", "index.html"):
            return str(self.root / "index.html")
        blocked = str(self.root / ".not-served")
        if not is_public(rel):
            return blocked
        full = (self.root / rel).resolve()
        try:
            full.relative_to(self.root.resolve())   # no walking out of the folder with ..
        except ValueError:
            return blocked
        return str(full)

    def do_GET(self):
        route = self.path.split("?")[0]
        if route in ("/__dev", "/__dev/"):
            return self.serve_token()
        if route in ("/", "/index.html"):
            return self.serve_page()
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_HEAD(self):
        return self.do_GET()

    def do_POST(self):
        """The one write the page can ask for, and only with --mirror: its records, kept in searchdesk-live.json."""
        route = self.path.split("?")[0]
        if route != MIRROR_ROUTE or not self.mirror_token:
            return self.send_error(404)
        if not mirror_allowed(self.headers.get("Host"), self.headers.get("Origin"),
                              self.headers.get("X-Desk-Token"), self.mirror_token):
            return self.send_error(403, "not from this page")
        try:
            size = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            size = 0
        if size <= 0 or size > MIRROR_MAX:
            return self.send_error(413 if size else 400)
        text = mirror_text(self.rfile.read(size))
        if text is None:
            return self.send_error(400, "that is not a Search Desk copy")
        try:
            write_mirror(self.root, text)
        except OSError as e:
            return self.send_error(500, "could not write %s: %s" % (MIRROR_FILE, e.strerror or e))
        self.send_response(204)
        self.end_headers()

    def send_bytes(self, body, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def serve_token(self):
        """The token for right now. Reading it is also what notices a change, which is where --rebuild hangs."""
        self.check()
        with self.lock:
            body = self.token.encode("ascii")
        self.send_bytes(body, "text/plain; charset=utf-8")

    def serve_page(self):
        try:
            html = (self.root / "index.html").read_text(encoding="utf-8")
        except OSError:
            self.send_error(500, "no index.html in this folder")
            return
        # The screen note is for this page load and only this one, so it is taken out of the file here. The
        # token is worked out after that, from the disk as it is now: the page then holds the token of the
        # files it was built from, so its next poll finds nothing changed and there is no second reload. A
        # token remembered from earlier would do that to anyone who opened a tab just after a save.
        go = take_go(self.root) if self.reload else ""
        if go:
            say("  the tab is going to #%s" % go)
        token = token_for(self.root, watched_files(self.root))
        with self.lock:
            self.token = token
        page = add_scripts(html, dev_script(self.reload, self.workshop, self.banner, token, go, self.mirror_token))
        if page is None:
            self.send_error(500, "this page has no </head> for the dev scripts to go in")
            return
        self.send_bytes(page.encode("utf-8"), "text/html; charset=utf-8")

    def check(self):
        """Has anything changed since the token we last handed out? With --rebuild the copy to take home is
        rebuilt here first, so it is never behind the page somebody is looking at."""
        files = watched_files(self.root)
        token = token_for(self.root, files)
        with self.lock:
            changed = token != self.token
            self.token = token
        if not changed or not self.rebuild:
            return
        try:
            version, size = build_workshop(ROOT / "dist" / "workshop")
            say("  rebuilt dist/workshop/searchdesk.html  version %s  %d bytes" % (version, size))
        except Exception as e:                      # a syntax error in a feature, most likely
            say("  could not rebuild the copy to take home: %s" % (e or e.__class__.__name__))
            say("  the page you are looking at is fine: it reads the files, not the build")


def say(text):
    sys.stderr.write(text if text.endswith("\n") else text + "\n")
    sys.stderr.flush()


def intro(args, urls):
    lines = ["", "  Search Desk, for a workshop.", ""]
    for url in urls:
        lines.append("      %s" % url)
    lines += ["", "  Stop with Ctrl-C."]
    if args.workshop:
        lines.append("  Practice copy: Amira is already loaded, and the page asks the network for nothing.")
    else:
        lines.append("  Source copy: starts empty. Data tab, then \"Try with a made-up person\" for Amira.")
    if args.reload:
        lines.append("  The page reloads itself when a file changes. If someone is typing, it waits for a click.")
        lines.append("  To send the tab to a screen, write its name in .dev-go:  echo jobs > .dev-go")
        lines.append("  (used once, then taken out again, so writing it twice works twice)")
    else:
        lines.append("  Auto-reload is off. Reload the page by hand to see a change.")
    if args.host not in ("127.0.0.1", "localhost", "::1", ""):
        lines.append("  Anyone on this wifi can open it too; this server hands out only the page's own files.")
    else:
        lines.append("  To open it on a phone or another laptop, stop and start it again with --host 0.0.0.0")
    if getattr(args, "mirror", False):
        lines.append("  The desk's records are kept in searchdesk-live.json as you work, for an agent to read. Local only.")
    if args.rebuild:
        lines.append("  dist/workshop/searchdesk.html is rebuilt on every change, ready to copy onto a USB stick.")
    lines += ["", "  To take a copy home: uv run tools/build.py --workshop", ""]
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Serve Search Desk for a workshop.")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--workshop", action="store_true")
    ap.add_argument("--banner")
    ap.add_argument("--rebuild", action="store_true")
    ap.add_argument("--mirror", action="store_true",
                    help="keep %s up to date with what is in the desk, for an agent to read" % MIRROR_FILE)
    ap.add_argument("--no-reload", dest="reload", action="store_false", default=True)
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--check", action="store_true", help="print the files it would watch, then stop")
    args = ap.parse_args(argv)

    if not (ROOT / "index.html").is_file():
        sys.exit("serve: no index.html here. Run this from inside the Search Desk folder.")

    if args.mirror and host_name(args.host) not in LOCAL_NAMES:
        sys.exit("serve: --mirror writes the desk's records to a file, so it only runs on this computer. "
                 "Drop --host, or drop --mirror.")

    files = watched_files(ROOT)
    if args.check:
        say("index.html and %d more files, under %s" % (len(files) - 1, " ".join(WATCH_DIRS)))
        say("token now: %s" % token_for(ROOT, files))
        for rel in files:
            say("  %s" % rel)
        return

    Handler.root = ROOT
    Handler.reload = args.reload
    Handler.workshop = args.workshop
    Handler.banner = args.banner
    Handler.verbose = not args.quiet
    Handler.rebuild = args.rebuild
    Handler.mirror_token = secrets.token_urlsafe(24) if args.mirror else ""
    Handler.token = token_for(ROOT, files)

    handler = functools.partial(Handler, directory=str(ROOT))
    try:
        httpd = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as e:
        sys.exit("serve: cannot listen on %s:%d (%s). Try another --port." % (args.host, args.port, e.strerror or e))
    sys.stderr.write(intro(args, urls_for(args.host, httpd.server_address[1])) + "\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        say("\n  stopped.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
