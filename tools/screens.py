# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright==1.60.0"]
# ///
"""Screenshot every screen of Search Desk, for design work.  Run: uv run tools/screens.py [options]

Takes a full-page picture of each screen at each size, in light and dark, with the made-up person loaded, plus a few
states that only show up after a tap (empty app, a form problem, a waiting AI question, a toast).
Writes the pictures and an index.html contact sheet that shows them side by side, and prints one line per picture
with any problem it found: sideways scroll, a page error, or text that leaked out of an element ("null", "undefined",
"[object Object]").

Options:
  --out DIR          where to write (default screens/, which git ignores)
  --sizes LIST       any of phone,small,tablet,desk (default phone,desk). small is 320 wide, the narrowest we support
  --schemes LIST     light,dark (default light,dark)
  --only LIST        only these shots, by name (see SHOTS below), e.g. --only home,jobs-detail
  --app PATH         the page to open (default index.html; try dist/searchdesk.html)
  --viewport         also save what fits on the first screen, without scrolling (named *-top.png)
  --route NAME=HASH  add a shot of any route, e.g. --route sites-new=sites/new (may be given more than once)

New features need nothing: every tab in the menu (built or a "not built yet" stub) gets a shot, named after its id,
unless SHOTS below already covers it. For a screen behind a tap (a form, a detail view), use --route, or add a line
to SHOTS when the shot is worth keeping for everyone.

On a phone the menu is fixed to the bottom of the screen. A full-page picture would draw it halfway down, so for
full-page pictures the menu is moved to the end of the page. --viewport pictures show it where a person sees it.
"""

import argparse
import html
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SIZES = {"phone": (375, 812), "small": (320, 640), "tablet": (768, 1024), "desk": (1280, 900)}
EXAMPLE = "window.DESK_WORKSHOP = { autoExample: true, liveEvents: false };"
NO_NET = "window.DESK_WORKSHOP = { liveEvents: false };"
# For full-page pictures only: put the fixed phone menu at the end of the page instead of in the middle.
FULLPAGE_CSS = "@media (max-width: 767px) { body { position: relative; } .tabs { position: absolute !important; } }"
LEAKS = ["null", "undefined", "[object Object]", "NaN"]

FIRST_JOB = "Desk.store.all('job').sort((a, b) => a.title < b.title ? -1 : 1)[0].id"

# name: (start empty?, hash or None, JS to run after the hash, or None).
SHOTS = {
    "home": (False, "home", None),
    "jobs": (False, "jobs", None),
    "jobs-detail": (False, None, "location.hash = '#jobs/' + " + FIRST_JOB),
    "jobs-new": (False, "jobs/new", None),
    "jobs-problem": (False, "jobs/new", "document.querySelector('[data-test=job-save]').click()"),
    "jobs-edit": (False, None, "location.hash = '#jobs/' + " + FIRST_JOB + " + '/edit'"),
    "profile": (False, "profile", None),
    "events": (False, "events", None),
    "help": (False, "help", None),
    "ai": (False, "ai", None),
    "ai-pending": (False, "ai", "document.querySelector('[data-test=ai-copy]').click()"),
    "data": (False, "data", None),
    "toast": (False, "jobs", "document.querySelector('[data-test^=job-stage-]:not([aria-pressed=true])').click()"),
    "empty-home": (True, "home", None),
    "empty-jobs": (True, "jobs", None),
    "empty-ai": (True, "ai", None),
    "empty-data": (True, "data", None),
    "selftest": (False, "selftest", None),
}


def check_page(page, width):
    found = []
    sw = page.evaluate("document.documentElement.scrollWidth")
    if sw > width:
        found.append("sideways scroll (%d > %d)" % (sw, width))
    text = page.evaluate("document.getElementById('root').innerText")
    for word in LEAKS:
        if any(line.strip() == word or (" " + word + " ") in (" " + line + " ") for line in text.split("\n")):
            found.append("text says %r" % word)
    return found


def shoot(page, out, name, width, viewport):
    page.add_style_tag(content=FULLPAGE_CSS)
    page.screenshot(path=str(out / (name + ".png")), full_page=True)
    if viewport:
        page.evaluate("document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('position: absolute !important')) s.remove(); })")
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=str(out / (name + "-top.png")))


def menu_tabs(browser, app):
    """The tab ids in the app's menu, in menu order (features, stubs and core tabs)."""
    ctx = browser.new_context()
    ctx.add_init_script(EXAMPLE)
    page = ctx.new_page()
    page.goto(app + "#home")
    page.wait_for_function("window.Desk && Desk.started === true")
    ids = page.evaluate("[...document.querySelectorAll('.tabs a.tab')].map((a) => a.getAttribute('href').slice(1))")
    ctx.close()
    return ids


def run(args):
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    app = (ROOT / args.app).resolve().as_uri()
    rows, problems = [], 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        shots = dict(SHOTS)
        covered = {v[1] for v in SHOTS.values()}
        for tab in menu_tabs(browser, app):
            if tab not in covered and tab not in shots:
                shots[tab] = (False, tab, None)
        for name, hash_ in args.route:
            shots[name] = (False, hash_.lstrip("#"), None)
        bad = [n for n in args.only if n not in shots]
        if bad:
            sys.exit("Unknown shot: %s. Shots: %s" % (", ".join(bad), ", ".join(shots)))
        names = [n for n in shots if not args.only or n in args.only]
        for scheme in args.schemes:
            for size in args.sizes:
                w, hgt = SIZES[size]
                for empty in (False, True):
                    todo = [n for n in names if shots[n][0] == empty]
                    if not todo:
                        continue
                    ctx = browser.new_context(viewport={"width": w, "height": hgt}, color_scheme=scheme)
                    ctx.add_init_script(NO_NET if empty else EXAMPLE)
                    for name in todo:
                        _, hash_, js = shots[name]
                        page = ctx.new_page()
                        errors = []
                        page.on("pageerror", lambda e: errors.append(str(e)))
                        page.goto(app + "#" + (hash_ or "home"))
                        page.wait_for_function("window.Desk && Desk.started === true")
                        if js:
                            page.evaluate("() => { " + js + " }")
                        page.wait_for_timeout(350)
                        file = "%s-%s-%s" % (scheme, size, name)
                        shoot(page, out, file, w, args.viewport)
                        found = check_page(page, w) + ["page error: " + e for e in errors]
                        problems += len(found)
                        rows.append((scheme, size, name, file, found))
                        print("%-40s %s" % (file, "; ".join(found) or "ok"))
                        page.close()
                    ctx.close()
        browser.close()
    write_index(out, rows, args)
    print("\n%d pictures, %d problems. Open %s" % (len(rows), problems, (out / "index.html").resolve()))
    return 1 if problems else 0


def write_index(out, rows, args):
    by_name = {}
    for scheme, size, name, file, found in rows:
        by_name.setdefault(name, []).append((scheme, size, file, found))
    parts = ["<!doctype html><meta charset=utf-8><title>Search Desk screens</title><style>",
             "body{font:14px system-ui;margin:1rem;background:#eee}h2{margin:2rem 0 .5rem}",
             ".row{display:flex;gap:1rem;align-items:flex-start;overflow-x:auto;padding-bottom:1rem}",
             "figure{margin:0;flex:none}figcaption{font-weight:600}.bad{color:#a4262c}",
             "img{display:block;border:1px solid #999;background:#fff}",
             ".phone img,.small img{width:300px}.tablet img{width:420px}.desk img{width:640px}</style>",
             "<h1>Search Desk screens</h1>"]
    for name, shots in by_name.items():
        parts.append("<h2>%s</h2><div class=row>" % html.escape(name))
        for scheme, size, file, found in shots:
            note = "".join("<div class=bad>%s</div>" % html.escape(f) for f in found)
            parts.append("<figure class=%s><figcaption>%s %s</figcaption>%s<a href='%s.png'><img src='%s.png' loading=lazy></a></figure>"
                         % (size, scheme, size, note, file, file))
        parts.append("</div>")
    (out / "index.html").write_text("".join(parts), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT / "screens"))
    ap.add_argument("--sizes", default="phone,desk")
    ap.add_argument("--schemes", default="light,dark")
    ap.add_argument("--only", default="")
    ap.add_argument("--app", default="index.html")
    ap.add_argument("--viewport", action="store_true")
    ap.add_argument("--route", action="append", default=[])
    args = ap.parse_args()
    args.sizes = [s for s in args.sizes.split(",") if s]
    args.schemes = [s for s in args.schemes.split(",") if s]
    args.only = [s for s in args.only.split(",") if s]
    bad = [s for s in args.sizes if s not in SIZES]
    if bad:
        sys.exit("Unknown size: %s. Sizes: %s" % (", ".join(bad), ", ".join(SIZES)))
    routes = [r.split("=", 1) for r in args.route]
    if any(len(r) != 2 or not r[0] or not r[1] for r in routes):
        sys.exit("--route needs NAME=HASH, e.g. --route sites-new=sites/new")
    args.route = routes
    sys.exit(run(args))


if __name__ == "__main__":
    main()
