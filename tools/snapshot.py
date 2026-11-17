#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Write data/events-snapshot.js from Togather (DESIGN 11).  Run: uv run tools/snapshot.py  (or python3 tools/snapshot.py)

Options: --days N (default 21, today to N days ahead), --out FILE (default data/events-snapshot.js),
         --api URL (the events endpoint), --no-detail (skip the one-request-per-event link lookup),
         --all (keep every city event; by default only those matching CITY_MATCH, as the app shows them),
         --today YYYY-MM-DD (for tests).
Standard library only. Needs the network.

OUTPUT SHAPE
  window.DESK_EVENTS_SNAPSHOT = {
    generated: '2026-10-16T18:30:00Z',        // when this was made (UTC)
    source:    'https://staging.toronto.togather.foundation/api/v1/events',
    events: [ {id, title, start, end, venue, address, url, tier, tags, description}, ... ]
  }
  id       the Togather event id (a ULID, the last part of the event's @id)
  title    text, whitespace tidied, at most 200 characters
  start    local wall-clock time in Toronto: 'YYYY-MM-DDTHH:MM', or 'YYYY-MM-DD' for an all-day event
  end      the same form, or '' when the listing has none
  venue    the place name ('' if none)    address  'street, city' ('' if none)
  url      https link to the listing (see below), or '' if there is none
  tier     'library' or 'city' (ids from locale/toronto.js events.tiers)
  tags     the listing's keywords, lower case, at most 6
  description  the first 200 characters of the listing's description, cut at a word, tags removed ('' if none). Only an
               excerpt is kept (DESIGN 11): the full text is the listing's, and the link goes to it.

WHAT WE LEARNED ABOUT THE API (checked 2026-10-16, staging)
  GET /api/v1/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&keywords=a,b&limit=200&after=<next_cursor>&context=document
  The list answers JSON-LD: {items:[...], next_cursor, timeZone}. Items have @id, name, startDate, endDate, location
  {name, address{streetAddress, addressLocality}}, keywords, description. The list has NO source link. The detail
  (GET /api/v1/events/<id>) has `url`, the source listing (for library events, a tpl.bibliocommons.com page).
  The @id is the Togather page (HTML in a browser). So: url = the detail's `url` if it is https, else the @id.
  Live fetching in the browser cannot afford one request per event, so it uses the @id. The same rules are in
  core/net.js (normalise); keep the two in step.

RULES
  The two tiers are fetched separately: 'library' (keywords=career & job search) and 'city' (everything).
  The city feed contains the library events too. An event in both tiers is kept ONCE, as 'library' (the more
  specific tier wins). Events are sorted by start, then title, then id, so a re-run changes only what changed.
  Every url must be https with no spaces; anything else is dropped (then the @id is used).
"""
import argparse
import concurrent.futures
import datetime
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://staging.toronto.togather.foundation/api/v1/events"
# Keep in step with locale/toronto.js events.tiers (tests/unit/net.test.js checks this).
TIERS = [
    {"id": "library", "keywords": "career & job search"},
    {"id": "city", "keywords": ""},
]
# Keep in step with the `match` list of the city tier in locale/toronto.js (tests/unit/net.test.js checks this).
# The city feed is thousands of events, so the snapshot keeps only the ones the app would show by default.
# The app filters by itself too, so a snapshot made with --all works the same, only larger.
CITY_MATCH = ["job", "career", "resume", "r\u00e9sum\u00e9", "interview", "hiring", "employ", "networking", "linkedin",
              "newcomer", "settlement", "english conversation", "esl", "digital skills", "computer basics", "mentor",
              "entrepreneur", "small business", "cover letter", "workplace", "volunteer"]
# Same rule as logic.matchesWords in features/events.js: a word matches at the start of a word, in any case,
# in the title or the tags. (Not preceded by a letter or digit; [^\W_] is a Unicode letter or digit.)
MATCH_RE = re.compile(r"(?<![^\W_])(?:" + "|".join(re.escape(w) for w in CITY_MATCH) + ")", re.I)


def matches(ev):
    return bool(MATCH_RE.search(ev["title"] + " " + " ".join(ev["tags"])))
ROOT = Path(__file__).resolve().parent.parent
MAX_PAGES = 16
UA = "SearchDeskSnapshot/1 (+job search helper; reads public events)"


def get_json(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            if i == tries - 1:
                raise
            time.sleep(1.5 * (i + 1))


def tidy(s, limit):
    """Whitespace tidied and HTML entities decoded ("Toronto&#39;s" -> "Toronto's"); same rule as core/net.js."""
    s = re.sub(r"\s+", " ", html.unescape(s) if isinstance(s, str) else "").strip()
    return s[:limit].rstrip()


DESC_MAX = 200  # characters of each listing's description that are kept (an excerpt, cut at a word); same in core/net.js


def excerpt(s, limit=DESC_MAX):
    """The first `limit` characters of a description, tags removed, cut at a word and ended with an ellipsis."""
    s = tidy(re.sub(r"<[^>]*>", " ", s) if isinstance(s, str) else "", 100000)
    if len(s) <= limit:
        return s
    cut = s[:limit - 1]
    sp = cut.rfind(" ")
    if sp > limit * 0.6:
        cut = cut[:sp]
    return cut.rstrip(" ,;:-\u2013\u2014.") + "\u2026"


def tidy_place(s, limit):
    """A place name without the "Event location:" label some listings glue on ("MalvernEvent location: Malvern")."""
    s = tidy(s, 1000)
    m = re.match(r"^(.*?)\s*Event location:\s*(.+)$", s)
    return tidy(m.group(2) if m else s, limit)


def https_url(u):
    """The url if it is a usable https link, else ''."""
    if not isinstance(u, str):
        return ""
    u = u.strip()
    if len(u) > 500 or not re.match(r"^https://[^\s<>\"']+$", u) or len(u) < 12:
        return ""
    host = urllib.parse.urlsplit(u).netloc
    return u if host and "@" not in host else ""


def local_time(v):
    """'2026-10-22T18:30:00-04:00' -> '2026-10-22T18:30' (the offset says Toronto time already). Date-only stays."""
    if not isinstance(v, str):
        return ""
    m = re.match(r"^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?", v.strip())
    if not m:
        return ""
    return m.group(1) + ("T" + m.group(2) if m.group(2) else "")


def normalise(item, tier, detail_url=""):
    """One API item -> the normalised event, or None when it has no id, title or start."""
    if not isinstance(item, dict):
        return None
    page = https_url(item.get("@id"))
    eid = page.rstrip("/").rsplit("/", 1)[-1] if page else ""
    title = tidy(item.get("name"), 200)
    start = local_time(item.get("startDate"))
    if not (re.match(r"^[0-9A-Za-z]{6,40}$", eid) and title and start):
        return None
    end = local_time(item.get("endDate"))
    place = item.get("location") if isinstance(item.get("location"), dict) else {}
    addr = place.get("address") if isinstance(place.get("address"), dict) else {}
    address = ", ".join(x for x in (tidy(addr.get("streetAddress"), 100), tidy(addr.get("addressLocality"), 60)) if x)
    tags = []
    for k in item.get("keywords") or []:
        k = tidy(k, 40).lower()
        if k and k not in tags:
            tags.append(k)
    return {
        "id": eid, "title": title, "start": start, "end": end if end >= start else "",
        "venue": tidy_place(place.get("name"), 120), "address": address,
        "url": https_url(detail_url) or page, "tier": tier, "tags": tags[:6],
        "description": excerpt(item.get("description")),
    }


def fetch_tier(api, tier, start, end):
    out, cursor = [], ""
    for _ in range(MAX_PAGES):
        q = {"startDate": start, "endDate": end, "limit": "200", "context": "document"}
        if tier["keywords"]:
            q["keywords"] = tier["keywords"]
        if cursor:
            q["after"] = cursor
        d = get_json(api + "?" + urllib.parse.urlencode(q))
        out += d.get("items") or []
        cursor = d.get("next_cursor") or ""
        if not cursor:
            return out
    sys.exit("snapshot: more than %d pages for tier %s; stopping" % (MAX_PAGES, tier["id"]))


def source_link(api, eid):
    try:
        return https_url(get_json(api + "/" + urllib.parse.quote(eid), tries=2).get("url"))
    except Exception:
        return None  # unknown: the caller keeps the Togather page


def build(api, today, days, detail=True, keep_all=False):
    start = today.isoformat()
    end = (today + datetime.timedelta(days=days)).isoformat()
    events = {}
    for tier in TIERS:  # library first, so it wins when an event is in both
        items = fetch_tier(api, tier, start, end)
        print("snapshot: %s tier: %d items" % (tier["id"], len(items)), file=sys.stderr)
        for it in items:
            ev = normalise(it, tier["id"])
            if ev and ev["id"] not in events and (keep_all or tier["id"] != "city" or matches(ev)):
                events[ev["id"]] = ev
    failed = 0
    if detail:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            links = dict(zip(events, pool.map(lambda i: source_link(api, i), list(events))))
        for eid, link in links.items():
            if link is None:
                failed += 1
            elif link:
                events[eid]["url"] = link
    out = sorted(events.values(), key=lambda e: (e["start"], e["title"].lower(), e["id"]))
    return out, failed


def render(events, api, generated):
    head = {"generated": generated, "source": api}
    lines = ["// Frozen events snapshot, written by tools/snapshot.py (shape: see the top of that file). Do not edit.",
             "window.DESK_EVENTS_SNAPSHOT = {",
             "generated: " + json.dumps(head["generated"]) + ",",
             "source: " + json.dumps(head["source"]) + ",",
             "events: ["]
    for i, e in enumerate(events):
        s = json.dumps(e, ensure_ascii=False, separators=(",", ":")).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
        lines.append(s + ("," if i < len(events) - 1 else ""))
    lines += ["]", "};", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--days", type=int, default=21)
    ap.add_argument("--out", default=str(ROOT / "data" / "events-snapshot.js"))
    ap.add_argument("--api", default=API)
    ap.add_argument("--no-detail", action="store_true")
    ap.add_argument("--all", action="store_true", help="keep every city event, not only those about finding work")
    ap.add_argument("--today")
    a = ap.parse_args()
    if a.today:
        today = datetime.date.fromisoformat(a.today)
    else:
        try:
            from zoneinfo import ZoneInfo
            today = datetime.datetime.now(ZoneInfo("America/Toronto")).date()
        except Exception:
            today = datetime.date.today()
    events, failed = build(a.api, today, a.days, not a.no_detail, a.all)
    generated = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    text = render(events, a.api, generated)
    Path(a.out).write_text(text, encoding="utf-8")
    by = {}
    for e in events:
        by[e["tier"]] = by.get(e["tier"], 0) + 1
    own = sum(1 for e in events if not e["url"].startswith(a.api.split("/api/")[0]))
    print("snapshot: wrote %s: %d events %s, %d bytes, %d with a source link, %d link lookups failed"
          % (a.out, len(events), by, len(text.encode("utf-8")), own, failed), file=sys.stderr)


if __name__ == "__main__":
    main()
