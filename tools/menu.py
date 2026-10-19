#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Write docs/menu.html: the features that are already written up, as a page a person can look through.  Run:

    python3 tools/menu.py             # write docs/menu.html
    python3 tools/menu.py --check     # say whether it is up to date, change nothing (exit 1 if not)

The page is for someone who has no idea what to build. Each brief in docs/features/ gives it one card: the name, a size
(Small is about one sitting, Medium a little more), what it does in plain words, and why someone wants it. The cards
are made from the briefs, so the page cannot drift from them, and a test fails when it has. Standard library only;
opens from a file, with no script and nothing loaded from the network.
"""
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEATURES = ROOT / "docs" / "features"
OUT = ROOT / "docs" / "menu.html"
SIZES = {"S": ("Small", "about one sitting"), "M": ("Medium", "a little longer"), "L": ("Large", "more than one sitting")}
HEAD = re.compile(r"^#\s+(?P<title>.+?)\s+\(id:\s*(?P<id>[a-z][a-z0-9-]*),\s*size:\s*(?P<size>[A-Z])\)\s*$")


def read_brief(path):
    """-> {id, title, size, plain, why} from the top of a brief, or None when it has no heading of that shape."""
    lines = path.read_text(encoding="utf-8").splitlines()
    m = HEAD.match(lines[0]) if lines else None
    if not m:
        return None
    plain, why = "", []
    taking = False
    for line in lines[1:]:
        if line.startswith("In plain words:"):
            plain = line[len("In plain words:"):].strip()
        elif line.startswith("Why someone wants it:"):
            why = [line[len("Why someone wants it:"):].strip()]
            taking = True
        elif taking and line.strip():
            why.append(line.strip())
        elif taking:
            break
    return {"id": m["id"], "title": m["title"], "size": m["size"], "plain": plain, "why": " ".join(why)}


def briefs():
    out = [read_brief(p) for p in sorted(FEATURES.glob("*.md"))]
    return [b for b in out if b]


def text(value):
    """Escaped text, with `backticks` shown as code, the way the briefs write names."""
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", html.escape(value))


def card(b):
    name, how = SIZES.get(b["size"], (b["size"], ""))
    why = '<p class="why">%s</p>' % text(b["why"]) if b["why"] else ""
    return ('    <article>\n      <h3>%s <span class="size" title="%s">%s</span></h3>\n      <p class="plain">%s</p>\n      %s\n'
            '      <p class="id">Ask for it by name: <code>%s</code></p>\n    </article>\n'
            % (html.escape(b["title"]), html.escape(how), html.escape(name), text(b["plain"]), why, html.escape(b["id"])))


def page(items):
    order = {"S": 0, "M": 1, "L": 2}
    items = sorted(items, key=lambda b: (order.get(b["size"], 9), b["title"].lower()))
    groups = []
    for size in ("S", "M", "L"):
        group = [b for b in items if b["size"] == size]
        if group:
            name, how = SIZES[size]
            groups.append('  <section>\n    <h2>%s <small>%s</small></h2>\n    <div class="grid">\n%s    </div>\n  </section>\n'
                          % (name, html.escape(how), "".join(card(b) for b in group)))
    return """<!doctype html>
<!-- Made by tools/menu.py from docs/features/*.md. Do not edit by hand: run the tool. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ideas to build for Search Desk</title>
<style>
  :root { --ink:#1c1f23; --muted:#5b6470; --rule:#dfe3e8; --ground:#eef1f4; --card:#fff; --accent:#1f4e79; --chip:#e3edf6; }
  @media (prefers-color-scheme: dark) { :root { --ink:#e8ebef; --muted:#a3adb8; --rule:#2f3640; --ground:#14181d; --card:#1c2128; --accent:#8bb8e8; --chip:#26344a; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ground); color:var(--ink); font:1.0625rem/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; }
  main { max-width:56rem; margin:0 auto; padding:2rem 1rem 4rem; }
  h1 { margin:0 0 .4rem; font-size:2rem; line-height:1.2; }
  .lead { color:var(--muted); max-width:42rem; margin:0 0 2rem; }
  h2 { margin:2rem 0 .8rem; font-size:1.3rem; } h2 small { color:var(--muted); font-weight:400; font-size:.95rem; margin-left:.4rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(17rem,1fr)); gap:1rem; }
  article { background:var(--card); border:1px solid var(--rule); border-radius:.5rem; padding:1.1rem 1.2rem; }
  h3 { margin:0 0 .4rem; font-size:1.1rem; display:flex; justify-content:space-between; gap:.5rem; align-items:baseline; }
  .size { font-size:.78rem; font-weight:600; background:var(--chip); color:var(--accent); padding:.1rem .5rem; border-radius:1rem; white-space:nowrap; }
  p { margin:0 0 .6rem; } .plain { font-weight:500; } .why { color:var(--muted); font-size:.95rem; } .id { color:var(--muted); font-size:.85rem; margin:0; }
  code { background:var(--chip); padding:.05rem .35rem; border-radius:.25rem; }
  .none { background:var(--card); border:1px dashed var(--rule); border-radius:.5rem; padding:1rem 1.2rem; color:var(--muted); }
</style>
</head>
<body>
<main>
  <h1>Ideas to build for Search Desk</h1>
  <p class="lead">Each of these is already written up, so an agent can build it from its brief. Pick the one that would help
  Amira most, then ask for it by name. Small ones fit in one sitting. If none of them is right, describe your own.</p>
%s
  <p class="none">None of these fits? Tell the agent what Amira struggles with, in your own words, and it will turn that into a plan.</p>
</main>
</body>
</html>
""" % "\n".join(groups)


def main(argv):
    items = briefs()
    if not items:
        sys.exit("menu: no briefs found in %s" % FEATURES)
    text = page(items)
    if "--check" in argv:
        have = OUT.read_text(encoding="utf-8") if OUT.is_file() else ""
        if have != text:
            print("docs/menu.html is out of date: run python3 tools/menu.py")
            return 1
        print("docs/menu.html is up to date (%d features)" % len(items))
        return 0
    OUT.write_text(text, encoding="utf-8")
    print("wrote %s (%d features)" % (OUT.relative_to(ROOT), len(items)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
