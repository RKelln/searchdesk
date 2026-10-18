#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Write docs/kits/<id>.txt for every brief in docs/features/<id>.md (PLAN T6.2).

Run:  uv run tools/kit.py          (or python3 tools/kit.py)   writes the kits
      uv run tools/kit.py --check  exits 1 and names any kit that is missing or stale, else 0

A kit is one text file a person pastes into a free AI chat. In order: a short instruction, docs/CONTRACT.md,
docs/example-feature.js, then the brief. The output has no dates and uses LF newlines, so a re-run changes nothing
unless a source changed. Standard library only.
"""
import argparse
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
BRIEFS = DOCS / "features"
KITS = DOCS / "kits"
WARN_AT = 60000

INSTRUCTION = """You are building one feature file for Search Desk, a job-search helper that runs in a web browser.

Reply with exactly one JavaScript file, in one code block, and nothing else.
No words before the code block. No words after it.

THE BRIEF IN PART 2 IS WHAT YOU BUILD. Its id is the id you must use. Read it first.
The contract in part 3 and the example in part 4 show the shape of such a file: the rules to follow and the shape to
copy. The example is not what you are building -- it is a different feature, made up, kept as a model. Do not build
it, and do not build anything the example shows instead of your brief.
Follow the contract. Do not use any of the banned words in it."""


def sep(title):
    # Just a heading. A kit is pasted into a chat that may cut it short, so every byte here is a byte not spent on
    # the contract or the brief, and a row of dashes under four headings is 248 bytes of nothing.
    return "\n\n# " + title + "\n\n"


def read(path):
    return path.read_bytes().decode("utf-8").replace("\r\n", "\n").strip("\n") + "\n"


def esc(text):
    """HTML-escape for page text and attribute values. A brief is plain text, but a stray < must not become markup."""
    return (str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def build(brief):
    return "".join(segments(brief))


# The four parts of a kit, built exactly as build() used to build them, kept apart so docs/kits/index.html can embed
# parts 1-3 once and each brief's part 4 once, then join them in the browser. One copy of the separators, so the page
# and the .txt files cannot drift apart.
#
# The brief is part 2, not part 4, and that is the whole point of the order. A free chat can cut a long paste short:
# the T6.3 trial had Gemini stop at 32k bytes of a 40k kit, which is exactly where the tail used to start, so the
# model never saw the brief at all and built a different feature. The brief is short and the contract is long, so the
# brief goes first: if the paste is cut again the person still gets what to build, which is the one thing that decides
# what comes back. Everything after it is how to build it well.
def segments(brief):
    return (
        sep("PART 1 OF 4: WHAT TO DO").lstrip("\n") + INSTRUCTION + "\n",
        sep("PART 2 OF 4: THE BRIEF: WHAT TO BUILD (docs/features/" + brief.name + ")") + read(brief),
        sep("PART 3 OF 4: THE CONTRACT (docs/CONTRACT.md)") + read(DOCS / "CONTRACT.md"),
        sep("PART 4 OF 4: THE EXAMPLE FEATURE (docs/example-feature.js)") + read(DOCS / "example-feature.js"),
    )


def b64(text):
    """Base64 of the text's UTF-8 bytes, for a page to carry without HTML escaping or newline rules."""
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


# (title, size, plain words) from a brief's first lines. Every field falls back rather than raising, so a brief that
# does not follow the shape still gets a row.
def brief_facts(brief):
    lines = read(brief).split("\n")
    head = lines[0] if lines else ""
    title = head.lstrip("# ").split("(")[0].strip()
    mid = re.search(r"id:?\s*`?([A-Za-z][A-Za-z0-9-]*)`?", head)
    size = re.search(r"size:?\s*([A-Za-z])", head)
    plain = ""
    for line in lines[1:6]:
        if line.startswith("In plain words:"):
            plain = line.split(":", 1)[1].strip()
            break
    return title or brief.stem, (size.group(1).upper() if size else ""), plain


PAGE_CSS = """    :root { color-scheme: light dark; --bg:#fff; --fg:#141414; --muted:#5a5a5a; --line:#d9d9d9; --surface:#f6f6f7; }
    @media (prefers-color-scheme: dark) { :root { --bg:#141414; --fg:#f2f2f2; --muted:#a8a8a8; --line:#3a3a3a; --surface:#1e1e20; } }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 1rem; background: var(--bg); color: var(--fg);
           font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    main { max-width: 44rem; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
    h2 { font-size: 1.1rem; }
    .lede { color: var(--muted); margin: 0 0 1.25rem; }
    ol { padding-left: 1.25rem; margin: 0 0 1.5rem; }
    li { margin: .3rem 0; }
    .card { border: 1px solid var(--line); border-radius: 8px; padding: .9rem 1rem; margin: 0 0 .7rem;
            background: var(--surface); }
    .card h2 { margin: 0 0 .3rem; display: flex; gap: .5rem; align-items: baseline; flex-wrap: wrap; }
    .size { font-weight: 400; font-size: .78rem; color: var(--muted);
            border: 1px solid var(--line); border-radius: 999px; padding: 0 .5rem; }
    .card p { margin: 0 0 .7rem; }
    .row { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; font-size: .9rem; }
    button { font: inherit; padding: .35rem .8rem; border: 1px solid var(--line); border-radius: 6px;
             background: var(--bg); color: var(--fg); cursor: pointer; }
    button:hover { border-color: var(--muted); }
    button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid var(--muted); outline-offset: 2px; }
    a { color: inherit; }
    textarea { width: 100%; height: 9rem; margin-top: .5rem; font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace;
               background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: .5rem; }
    .status { color: var(--muted); font-size: .9rem; min-height: 1.4em; }
    code { font-size: .95em; }
    [hidden] { display: none !important; }"""

PAGE_JS = """    // Each part is base64 so no HTML escaping or newline rule can change the text. Reading .textContent gives back
    // exactly the bytes tools/kit.py put there, which are the same bytes as docs/kits/<id>.txt.
    function part(id) {
      var raw = atob(document.getElementById(id).textContent);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }
    var PARTS = __PARTS__;
    var status = document.getElementById('status');
    var box = document.getElementById('box');
    function show(kit) {
      box.value = kit;
      box.hidden = false;
      box.focus();
      box.select();
      status.textContent = 'The kit is in the box below. Click in it and press Ctrl+C (Cmd+C on a Mac).';
    }
    var buttons = document.querySelectorAll('button[data-kit]');
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].addEventListener('click', function () {
        var id = this.getAttribute('data-kit');
        var kit = '';
        for (var i = 0; i < PARTS.length; i++) kit += part(PARTS[i].replace('@', id));
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(kit).then(function () { status.textContent = 'Copied.'; },
                                                            function () { show(kit); });
            return;
          }
        } catch (e) { /* no clipboard here: use the box */ }
        show(kit);
      });
    }"""


def page(briefs):
    """docs/kits/index.html: the same kits as a list with a Copy button each. No network, no build step, opens from
    a file:// path. Generated here so `kit.py --check` says when it is stale."""
    # Which parts are the same in every kit, and which one holds this brief? Work it out by comparing rather than
    # by counting: a fixed index would quietly hand every kit the first brief when the parts are reordered, which is
    # exactly what happened when the brief moved from part 4 to part 2.
    base = segments(briefs[0])
    allsegs = [segments(b) for b in briefs]
    shared_i = [i for i in range(len(base)) if all(segs[i] == base[i] for segs in allsegs)]
    own_i = [i for i in range(len(base)) if i not in shared_i]
    shared = [base[i] for i in shared_i]
    cards = []
    for brief in briefs:
        title, size, plain = brief_facts(brief)
        cards.append(
            '    <div class="card">\n'
            '      <h2>%s%s</h2>\n'
            '      <p>%s</p>\n'
            '      <div class="row">\n'
            '        <button type="button" data-kit="%s">Copy this kit</button>\n'
            '        <a href="%s.txt">the kit as a file</a>\n'
            '        <a href="../features/%s.md">the brief</a>\n'
            '      </div>\n'
            '    </div>'
            % (esc(title), ' <span class="size">%s</span>' % esc(size) if size else '',
               esc(plain), brief.stem, brief.stem, brief.stem)
        )
    shn = ['k%d' % (i + 1) for i in range(len(shared))]
    onn = ['k%d' % (i + len(shared) + 1) for i in range(len(own_i))]
    hidden = ['    <pre hidden id="%s">%s</pre>' % (n, b64(t)) for n, t in zip(shn, shared)]
    for brief, segs in zip(briefs, allsegs):
        for n, i in zip(onn, own_i):
            hidden.append('    <pre hidden id="%s-%s">%s</pre>' % (n, brief.stem, b64(segs[i])))
    # The ids in the order the parts must come out, with '@' where the kit's own id goes. An ordered list, not two
    # groups: joining "the shared parts" then "the parts for this brief" moves the brief to the end, and the brief
    # being second is the whole point of the kit.
    order = []
    for i in range(len(base)):
        if i in own_i:
            order.append(onn[own_i.index(i)] + '-@')
        else:
            order.append(shn[shared_i.index(i)])
    page_parts = str(order)
    return (
        "<!DOCTYPE html>\n"
        '<html lang="en">\n'
        "<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        "<title>Build a Search Desk feature</title>\n"
        "<style>\n" + PAGE_CSS + "\n</style>\n"
        "</head>\n"
        "<body>\n"
        "<main>\n"
        "  <h1>Build a Search Desk feature</h1>\n"
        '  <p class="lede">Everything you need is below. There is nothing to install.</p>\n'
        "  <ol>\n"
        "    <li>Press <strong>Copy this kit</strong> under the one you want.</li>\n"
        "    <li>Paste it into a free AI chat, in a new chat.</li>\n"
        "    <li>Save the file it gives you as <code>features/&lt;id&gt;.js</code>. Plain text, not a word-processor"
        " file.</li>\n"
        "    <li>Open <code>features/list.js</code> and add the id to <code>Desk.features</code>.</li>\n"
        "    <li>Reload Search Desk and put <code>#selftest</code> at the end of the address.</li>\n"
        "  </ol>\n"
        + "\n".join(cards) + "\n"
        "  <h2>If the copy did not work</h2>\n"
        '  <p class="lede">The kit you chose is in the box below.</p>\n'
        '  <textarea id="box" readonly hidden aria-label="The kit you chose"></textarea>\n'
        '  <p class="status" role="status" id="status"></p>\n'
        + "\n".join(hidden) + "\n"
        "<script>\n"
        + PAGE_JS.replace("__PARTS__", page_parts)
        + "\n</script>\n"
        "</main>\n"
        "</body>\n"
        "</html>\n"
    )


README = """# Kits

Each `.txt` file here is one feature brief packed with everything a free AI chat needs to build it: the instructions, the contract, the example and the brief. Copy a whole file into a chat, then save the reply as `features/<id>.js`. Do not edit these by hand: `uv run tools/kit.py` writes them again from `docs/features/`, and `uv run tools/kit.py --check` says if any is out of date.

A brief you write yourself works exactly the same way. Save it as `docs/features/<id>.md` and run the tool again. See "A feature of your own" in [`../KITS.md`](../KITS.md).

There is also `index.html` here: open it in a browser for the same list with a Copy button on each one.
"""


def expected():
    out = {}
    briefs = sorted(BRIEFS.glob("*.md"))
    for brief in briefs:
        out[KITS / (brief.stem + ".txt")] = build(brief)
    out[KITS / "README.md"] = README
    if briefs:
        out[KITS / "index.html"] = page(briefs)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="exit 1 if any kit is missing or stale")
    args = ap.parse_args()
    want = expected()
    if args.check:
        bad = []
        for path, text in want.items():
            if not path.exists() or path.read_bytes() != text.encode("utf-8"):
                bad.append(path)
        known = set(want)
        for path in sorted(KITS.glob("*.txt")) if KITS.exists() else []:
            if path not in known:
                bad.append(path)
        for path in bad:
            state = "missing" if not path.exists() else "stale"
            print("kit %s: %s" % (state, path.relative_to(ROOT)))
        if bad:
            print("Run: uv run tools/kit.py")
            return 1
        print("kits up to date (%d)" % len([p for p in want if p.suffix == ".txt"]))
        return 0
    KITS.mkdir(parents=True, exist_ok=True)
    # A kit whose brief is gone has to go too, or --check calls it stale forever and the fix it suggests
    # (run this tool) does not touch it. Every .txt here is written by this tool and nothing else, so
    # removing one is safe; README.md and index.html are in `want` and never match this.
    removed = []
    for path in sorted(KITS.glob("*.txt")) if KITS.exists() else []:
        if path not in want:
            path.unlink()
            removed.append(path)
    for path, text in want.items():
        path.write_bytes(text.encode("utf-8"))
        if path.suffix == ".txt":
            n = len(text)
            flag = "  <-- over %d, a free chat may choke" % WARN_AT if n > WARN_AT else ""
            print("%-28s %6d characters%s" % (path.relative_to(ROOT), n, flag))
    for path in removed:
        print("%-28s removed: its brief is gone" % path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
