#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Read part of the desk, not all of it.  Run: python3 tools/read-desk.py [options]

The desk's records are kept in a file (searchdesk-live.json while tools/serve.py --mirror runs, or an export from the
Data screen), and the whole of it is long: every note, every posting. This reads the part you need.

    python3 tools/read-desk.py                      # what the file is, how old it is, how many of each kind
    python3 tools/read-desk.py --type job           # one line per job: id, title, org, stage, closes
    python3 tools/read-desk.py --type job --stage interview
    python3 tools/read-desk.py --id job_amira_kingsway           # one whole record
    python3 tools/read-desk.py --id job_amira_kingsway --fields title,org,stage,nextStep
    python3 tools/read-desk.py --find dental        # records with that word anywhere, one line each
    python3 tools/read-desk.py --file ~/Downloads/searchdesk-2026-10-19.json ...

Which file: --file if given, else the newest of searchdesk-live.json and searchdesk-<date>.json in this folder, else the
newest searchdesk-*.json in ~/Downloads (where the browser puts an export). It says which it used and how old it is,
because a copy only knows the desk as of the moment it was written.

Long text (a posting, a note) is cut to 80 characters in the one-line views; --id with no --fields shows it whole.
Standard library only. Read only: it never writes anything.
"""
import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# What a one-line view shows for each kind. Anything not listed shows its first few short fields.
LINE_FIELDS = {
    "job": ("title", "org", "stage", "closes", "nextStep"),
    "event": ("title", "start", "venue"),
    "profile": ("roles", "field", "area", "availability"),
}


def candidates():
    here = sorted(ROOT.glob("searchdesk-*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if here:
        return here
    return sorted((Path.home() / "Downloads").glob("searchdesk-*.json"), key=lambda p: p.stat().st_mtime, reverse=True)


def age(path):
    secs = max(0, time.time() - path.stat().st_mtime)
    for size, name in ((86400, "day"), (3600, "hour"), (60, "minute")):
        if secs >= size:
            n = int(secs // size)
            return "%d %s%s old" % (n, name, "" if n == 1 else "s")
    return "just written"


def cut(value, limit=80):
    text = " ".join(str(value).split())
    return text if len(text) <= limit else text[:limit - 1] + "…"


def line(rec, fields=None):
    kind = rec.get("type", "?")
    names = fields or LINE_FIELDS.get(kind) or [k for k, v in rec.items() if isinstance(v, str) and len(v) < 60][:4]
    bits = ["%s=%s" % (n, cut(rec[n])) for n in names if rec.get(n) not in (None, "")]
    mark = " (made-up)" if rec.get("source") == "example" else ""
    return "%s  %s%s  %s" % (rec.get("id", "?"), kind, mark, "; ".join(bits))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Read part of the desk.")
    ap.add_argument("--file")
    ap.add_argument("--type")
    ap.add_argument("--stage")
    ap.add_argument("--id")
    ap.add_argument("--find")
    ap.add_argument("--fields", help="comma-separated field names to show")
    args = ap.parse_args(argv)

    if args.file:
        path = Path(args.file).expanduser()
    else:
        found = candidates()
        if not found:
            sys.exit("No searchdesk-live.json or searchdesk-<date>.json in this folder or in ~/Downloads. "
                     "Ask the person to press Export on the Data screen, or start the server with --mirror.")
        path = found[0]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        sys.exit("Could not read %s: %s" % (path, e))
    records = data.get("records") or {}
    if isinstance(records, list):
        records = {r.get("id", str(i)): r for i, r in enumerate(records) if isinstance(r, dict)}
    recs = [dict(r, id=r.get("id", i)) for i, r in records.items() if isinstance(r, dict) and not r.get("deleted")]
    fields = [f.strip() for f in args.fields.split(",")] if args.fields else None

    print("%s  (%s, %d records)" % (path, age(path), len(recs)))
    if args.id:
        rec = next((r for r in recs if r["id"] == args.id), None)
        if not rec:
            sys.exit("No record with id %s. Try --find." % args.id)
        print(json.dumps({k: v for k, v in rec.items() if not fields or k in fields or k == "id"},
                         indent=2, ensure_ascii=False))
        return
    chosen = recs
    if args.type:
        chosen = [r for r in chosen if r.get("type") == args.type]
    if args.stage:
        chosen = [r for r in chosen if r.get("stage") == args.stage]
    if args.find:
        needle = args.find.lower()
        chosen = [r for r in chosen if needle in json.dumps(r, ensure_ascii=False).lower()]
    if not (args.type or args.stage or args.find):
        counts = {}
        for r in recs:
            counts[r.get("type", "?")] = counts.get(r.get("type", "?"), 0) + 1
        print("  " + ", ".join("%d %s" % (n, k) for k, n in sorted(counts.items())))
        print("  Next: --type job, --id <id>, or --find <word>. Anything marked (made-up) is the practice person.")
        return
    for r in sorted(chosen, key=lambda r: (r.get("type", ""), str(r.get("title", r["id"])))):
        print(line(r, fields))
    if not chosen:
        print("  nothing matches")


if __name__ == "__main__":
    main()
