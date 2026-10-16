# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright==1.60.0"]
# ///
"""Search Desk browser tests.  Run: uv run tests/e2e/run.py [-k NAME] [--engine E] [--origin O] [--headed] [--app PATH]

Finds tests/e2e/test_*.py, runs every `def test_*(page, app)` on {chromium, webkit} x {file, http},
each in a fresh browser context. One line per case, then a summary. Exit 1 on any failure.
A browser that cannot start is reported SKIPPED with the reason (not a failure).
"""

import argparse
import functools
import http.server
import importlib.util
import sys
import threading
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

import helpers  # noqa: E402

ENGINES = ["chromium", "webkit"]
ORIGINS = ["file", "http"]


class App:
    def __init__(self, origin, url):
        self.origin, self.url = origin, url


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def start_server():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def discover():
    tests = []
    for path in sorted(HERE.glob("test_*.py")):
        spec = importlib.util.spec_from_file_location(path.stem, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for name in dir(mod):
            if name.startswith("test_") and callable(getattr(mod, name)):
                tests.append((f"{path.stem}.{name}", getattr(mod, name)))
    return tests


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-k", dest="keyword", help="only tests whose name contains this")
    ap.add_argument("--engine", choices=ENGINES)
    ap.add_argument("--origin", choices=ORIGINS)
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--app", default="index.html", help="page to open, relative to the repo root")
    args = ap.parse_args()

    app_file = (ROOT / args.app).resolve()
    if not app_file.is_file():
        sys.exit(f"e2e: app file not found: {app_file}")
    rel = app_file.relative_to(ROOT).as_posix()

    tests = [t for t in discover() if not args.keyword or args.keyword in t[0]]
    if not tests:
        sys.exit("e2e: no tests match")

    from playwright.sync_api import sync_playwright

    srv = start_server()
    urls = {"file": app_file.as_uri(), "http": f"http://127.0.0.1:{srv.server_port}/{rel}"}
    passed = failed = skipped = 0

    with sync_playwright() as pw:
        for engine in [args.engine] if args.engine else ENGINES:
            try:
                browser = getattr(pw, engine).launch(headless=not args.headed)
            except Exception as e:
                msg = str(e)
                if "missing dependencies" in msg:
                    pkgs = []
                    for l in msg.splitlines():
                        l = l.strip("║ \\").replace("sudo apt-get install", "").strip()
                        if l.startswith("lib"):
                            pkgs.append(l)
                    reason = "missing system libraries; sudo apt-get install " + " ".join(pkgs)
                else:
                    lines = [l.strip() for l in msg.splitlines() if l.strip()]
                    hit = [l for l in lines if "error while loading" in l]
                    reason = (hit or lines or [type(e).__name__])[0][-300:]
                print(f"SKIPPED {engine}: {reason}")
                skipped += 1
                continue
            for origin in [args.origin] if args.origin else ORIGINS:
                for name, fn in tests:
                    label = f"{engine:8} {origin:4} {name}"
                    ctx = browser.new_context()
                    page = ctx.new_page()
                    page.set_default_timeout(10000)
                    helpers.attach_monitor(page)
                    try:
                        fn(page, App(origin, urls[origin]))
                        print(f"PASS {label}")
                        passed += 1
                    except Exception:
                        print(f"FAIL {label}\n" + "".join("    " + l for l in traceback.format_exc().splitlines(True)))
                        failed += 1
                    finally:
                        ctx.close()
            browser.close()
    srv.shutdown()
    print(f"e2e: {passed} passed, {failed} failed" + (f", {skipped} engine(s) skipped" if skipped else ""))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
