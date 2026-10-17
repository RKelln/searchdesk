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

Follow the contract below. Do not use any of the banned words in it.
Use the example feature as the shape of your file.
Build the feature described in the brief at the end."""


def sep(title):
    return "\n\n" + "=" * 70 + "\n" + title + "\n" + "=" * 70 + "\n\n"


def read(path):
    return path.read_bytes().decode("utf-8").replace("\r\n", "\n").strip("\n") + "\n"


def build(brief):
    contract = read(DOCS / "CONTRACT.md")
    example = read(DOCS / "example-feature.js")
    return (
        sep("PART 1 OF 4: WHAT TO DO").lstrip("\n") + INSTRUCTION + "\n"
        + sep("PART 2 OF 4: THE CONTRACT (docs/CONTRACT.md)") + contract
        + sep("PART 3 OF 4: THE EXAMPLE FEATURE (docs/example-feature.js)") + example
        + sep("PART 4 OF 4: THE BRIEF FOR YOUR FEATURE (docs/features/" + brief.name + ")") + read(brief)
    )


README = """# Kits

Each `.txt` file here is one feature brief packed with everything a free AI chat needs to build it: the instructions, the contract, the example and the brief. Copy a whole file into a chat, then save the reply as `features/<id>.js`. Do not edit these by hand: `uv run tools/kit.py` writes them again from `docs/features/`, and `uv run tools/kit.py --check` says if any is out of date.
"""


def expected():
    out = {}
    for brief in sorted(BRIEFS.glob("*.md")):
        out[KITS / (brief.stem + ".txt")] = build(brief)
    out[KITS / "README.md"] = README
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
        print("kits up to date (%d)" % (len(want) - 1))
        return 0
    KITS.mkdir(parents=True, exist_ok=True)
    for path, text in want.items():
        path.write_bytes(text.encode("utf-8"))
        if path.suffix == ".txt":
            n = len(text)
            flag = "  <-- over %d, a free chat may choke" % WARN_AT if n > WARN_AT else ""
            print("%-28s %6d characters%s" % (path.relative_to(ROOT), n, flag))
    return 0


if __name__ == "__main__":
    sys.exit(main())
