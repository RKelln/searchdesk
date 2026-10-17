#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Build the single-file Search Desk (DESIGN 12, 14).  Run: uv run tools/build.py  (or python3 tools/build.py)

Writes, into dist/ (or --out DIR):
  searchdesk.html, index.html (the same file), manifest.webmanifest, icon-192.png, icon-512.png, sw.js (the service
  worker, with the version stamped in as its cache name), and CNAME when --cname is given

How it works
  index.html is the template AND the boot order. Every <script src> and stylesheet in it is read in order and put
  inline. The one tag for features/list.js becomes list.js followed by each feature listed in it, in list order, so
  there is no second list to keep in step. data/workshop.js and data/inbox.js are never inlined (the build also
  ignores them if someone uncomments their tags in index.html).
  Each inline script gets a sha256 hash in a Content-Security-Policy <meta>. There is no 'unsafe-inline' for scripts.
  style-src is 'unsafe-inline', as DESIGN 12 says: feature CSS is injected at run time as <style> elements, and a
  feature a participant adds cannot be hashed ahead of time. CSS cannot run code, the page has no inline style
  attributes (h() refuses them), and default-src/img-src/connect-src stop CSS from loading anything.

Options
  --out DIR          where to write (default dist, or dist/workshop with --workshop)
  --features a,b     only inline these features (ids must be in list.js)
  --without a,b      leave these out. Both options leave the id in the app as a "not built yet" stub.
  --workshop         a practice copy: inlines DESK_WORKSHOP = {autoExample: true, liveEvents: false}
                     (opens on the made-up person, never asks the network; connect-src becomes 'none')
  --banner TEXT      with --workshop, the banner words (default: the string table's)
  --version TEXT     use this version instead of the tag or date
  --cname HOST       also write dist/CNAME with this host name (GitHub Pages custom domain)
Standard library only. Bash 3.2 / macOS note: this needs Python 3 (use `uv run`), so it is for the maintainer, not
for the Macs in a workshop; they get the built file.
"""

import argparse
import base64
import datetime
import hashlib
import json
import os
import re
import struct
import subprocess
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Files that must never be inlined: they are optional and add themselves by being present.
NEVER_INLINE = ("data/workshop.js", "data/inbox.js")
LIST_JS = "features/list.js"
ID_RE = re.compile(r"^[a-z][a-z0-9-]*$")


# ---- pure parts (tested in tests/unit/test_build.py) ----------------------------------------------------------

def strip_comments(html):
    return re.sub(r"<!--.*?-->", "", html, flags=re.S)


SCRIPT_TAG = re.compile(r'<script\s+src="([^"]+)"\s*>\s*</script>')
STYLE_TAG = re.compile(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>')


def parse_boot_order(html):
    """The files index.html loads, in order: {'styles': [...], 'scripts': [...]}. Comments are ignored."""
    html = strip_comments(html)
    return {"styles": STYLE_TAG.findall(html), "scripts": SCRIPT_TAG.findall(html)}


def parse_feature_ids(list_js):
    """The ids in `Desk.features = [ ... ]`, in order."""
    m = re.search(r"Desk\.features\s*=\s*\[(.*?)\]", re.sub(r"//[^\n]*", "", list_js), re.S)
    if not m:
        raise ValueError("features/list.js has no Desk.features list")
    return re.findall(r"""['"]([^'"]+)['"]""", m.group(1))


def apply_feature_filter(ids, only=None, without=None):
    """(kept, dropped) in list order. Unknown ids in `only`/`without` are an error, not silence."""
    ids = list(ids)
    for name, group in (("--features", only), ("--without", without)):
        bad = [i for i in (group or []) if i not in ids]
        if bad:
            raise ValueError("%s names %s, which %s not in features/list.js (it has: %s)" % (
                name, ", ".join(bad), "is" if len(bad) == 1 else "are", ", ".join(ids)))
    kept = [i for i in ids if (not only or i in only) and i not in (without or [])]
    return kept, [i for i in ids if i not in kept]


def split_csv(text):
    return [p.strip() for p in (text or "").split(",") if p.strip()]


def normalise(text):
    """LF newlines, as the HTML parser gives the script. Hash exactly what we emit."""
    return text.replace("\r\n", "\n").replace("\r", "\n")


def safe_inline_script(code):
    """Make code safe between <script> tags without changing what it means."""
    code = re.sub(r"</(script)", lambda m: "<\\/" + m.group(1), code, flags=re.I)
    return code.replace("<!--", "<\\!--")


def sha256_token(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode("ascii") + "'"


def api_origin(locale_js):
    """https://host from the locale pack's `api: '...'`, or None when it is null or missing."""
    m = re.search(r"""\bapi\s*:\s*(['"])(https://[^'"/\s]+)""", locale_js)
    return m.group(2) if m else None


def make_csp(hashes, connect_origin):
    """The policy text. connect_origin None gives connect-src 'none'."""
    parts = [
        "default-src 'none'",
        "script-src " + " ".join(hashes),
        "style-src 'unsafe-inline'",
        "img-src data:",
        "connect-src " + (connect_origin or "'none'"),
        "manifest-src 'self'",
        "worker-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
    ]
    return "; ".join(parts)


def attr_escape(text):
    return text.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def js_string(text):
    return json.dumps(text, ensure_ascii=True)


def workshop_script(banner=None):
    cfg = "{ autoExample: true, liveEvents: false" + (", banner: " + js_string(banner) if banner else "") + " }"
    return "window.DESK_WORKSHOP = " + cfg + ";\n"


def filter_script(dropped):
    """Runs after list.js: dropped features leave the list (so nothing tries to fetch their files, which the policy
    would block) and show as "not built yet" stubs."""
    if not dropped:
        return ""
    ids = js_string_list(dropped)
    return ("Desk.features = Desk.features.filter(function (id) { return " + ids + ".indexOf(id) < 0; });\n"
            + ids + ".forEach(function (id) { Desk.missing(id); });\n")


def js_string_list(items):
    return "[" + ", ".join(js_string(i) for i in items) + "]"


def version_script(version):
    return "window.Desk = window.Desk || {};\nDesk.version = " + js_string(version) + ";\n"


def manifest_script():
    """Adds the manifest link only on http(s). WebKit logs a CORS error for a manifest fetched from file://, and a
    folder-less file has nothing to install anyway."""
    return ("if (/^https?:$/.test(location.protocol)) {\n  var l = document.createElement('link');\n"
            "  l.rel = 'manifest'; l.href = 'manifest.webmanifest'; document.head.appendChild(l);\n}\n")


def assemble(template, read, features, dropped, version, workshop=None, connect_origin=None, head_extra="", manifest=False):
    """Build the page text from index.html (template), a reader for repo files, and the options.
    `read(path)` gives a file's text. `features` are the ids to inline. `workshop` is None or the banner ('' ok).
    Returns (html, scripts) where scripts are the exact inline script texts that were hashed."""
    clean = strip_comments(template)
    scripts = []

    def inline(code):
        code = safe_inline_script(normalise(code))
        if not code.endswith("\n"):
            code += "\n"
        scripts.append(code)
        return "<script>" + code + "</script>"

    def style_tag(m):
        css = normalise(read(m.group(1)))
        if re.search(r"</style", css, re.I):
            raise ValueError(m.group(1) + " contains </style")
        return "<style>\n" + css + ("" if css.endswith("\n") else "\n") + "</style>"

    def script_tag(m):
        src = m.group(1)
        if src in NEVER_INLINE:
            return ""
        out = [inline(read(src))]
        if src == "core/desk.js":
            out.append(inline(version_script(version)))
        if src == LIST_JS:
            if workshop is not None:
                out.insert(0, inline(workshop_script(workshop or None)))
            out.append(inline(filter_script(dropped))) if dropped else None
            for fid in features:
                out.append(inline(read("features/" + fid + ".js")))
        return "\n".join(out)

    clean = re.sub(r"\n[ \t]*\n+", "\n", clean)  # tidy the template only: never touch a script after it is hashed
    body = STYLE_TAG.sub(style_tag, clean)
    body = SCRIPT_TAG.sub(script_tag, body)
    head_script = inline(manifest_script()) if manifest else ""
    csp = make_csp([sha256_token(s) for s in scripts], connect_origin)
    meta = '<meta http-equiv="Content-Security-Policy" content="' + attr_escape(csp) + '">\n'
    meta += '<meta name="generator" content="' + attr_escape("Search Desk " + version) + '">\n' + head_extra + head_script + ("\n" if head_script else "")
    if "<meta charset" not in body:
        raise ValueError("index.html needs a <meta charset> in its head")
    body = re.sub(r"(<meta charset[^>]*>\s*)", lambda m: m.group(1) + meta, body, count=1)
    return body, scripts


def manifest_json(title, version):
    return json.dumps({
        "name": title, "short_name": title, "description": "Keep your job search in one place.",
        "id": "./", "start_url": "./", "scope": "./", "display": "standalone",
        "background_color": "#f6f6f2", "theme_color": "#0b5cad",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }, indent=2) + "\n"


def stamp_sw(sw_js, version):
    """The service worker source with its VERSION line set. The cache name is built from it, so a new build means a
    new worker file (the browser sees changed bytes) and a new cache."""
    out, n = re.subn(r"^var VERSION = '[^'\n]*';", lambda m: "var VERSION = " + js_string(version).replace('"', "'") + ";", sw_js, count=1, flags=re.M)
    if n != 1:
        raise ValueError("sw.js has no `var VERSION = '...';` line")
    return out


HOST_RE = re.compile(r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")


def cname_text(host):
    """The CNAME file text: one lower-case host name and a newline. Anything that is not a plain host name is an error."""
    host = (host or "").strip().lower()
    if not HOST_RE.match(host):
        raise ValueError("--cname needs a plain host name such as searchdesk.example.com, not " + repr(host))
    return host + "\n"


ICON_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0b5cad"/>'
            '<circle cx="28" cy="28" r="13" fill="none" stroke="#fff" stroke-width="6"/>'
            '<path d="M38 38l14 14" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>')


def svg_data_uri():
    return "data:image/svg+xml;base64," + base64.b64encode(ICON_SVG.encode("ascii")).decode("ascii")


def png_data_uri(size):
    return "data:image/png;base64," + base64.b64encode(icon_png(size)).decode("ascii")


def icon_png(size):
    """A blue square with a white magnifying glass, as PNG bytes (stdlib zlib only). Drawn with a little
    anti-aliasing; the glass stays inside the centre 80% so a maskable crop keeps it."""
    s = size / 64.0
    cx, cy, r, w = 28 * s, 28 * s, 13 * s, 3 * s          # ring: centre, mid-radius, half stroke
    x0, y0, x1, y1, hw = 38 * s, 38 * s, 52 * s, 52 * s, 3.5 * s  # handle segment and half width
    dx, dy = x1 - x0, y1 - y0
    ln2 = dx * dx + dy * dy
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            d_ring = abs(((px - cx) ** 2 + (py - cy) ** 2) ** 0.5 - r)
            t = max(0.0, min(1.0, ((px - x0) * dx + (py - y0) * dy) / ln2))
            d_handle = ((px - (x0 + t * dx)) ** 2 + (py - (y0 + t * dy)) ** 2) ** 0.5
            cover = max(0.0, min(1.0, w - d_ring + 0.5), min(1.0, max(0.0, hw - d_handle + 0.5)))
            row += bytes((int(11 + (255 - 11) * cover), int(92 + (255 - 92) * cover), int(173 + (255 - 173) * cover)))
        rows.append(bytes(row))

    def chunk(kind, data):
        c = struct.pack(">I", len(data)) + kind + data
        return c + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))


# ---- the parts that touch the disk ---------------------------------------------------------------------------

def git_tag():
    try:
        out = subprocess.run(["git", "describe", "--tags", "--abbrev=0"], cwd=str(ROOT), capture_output=True,
                             text=True, timeout=10)
        return out.stdout.strip() if out.returncode == 0 else ""
    except Exception:
        return ""


def default_version(content_hash, today=None):
    """The latest git tag, else today's date, then '+' and the first 8 characters of a hash of the sources."""
    base = git_tag()
    if not base:
        epoch = os.environ.get("SOURCE_DATE_EPOCH")
        day = today or (datetime.datetime.fromtimestamp(int(epoch), datetime.timezone.utc).date() if epoch else datetime.date.today())
        base = day.strftime("%Y.%m.%d")
    return base + "+" + content_hash[:8]


def build(out_dir, only=None, without=None, workshop=None, version=None, cname=None):
    def read(path):
        return (ROOT / path).read_text(encoding="utf-8")

    template = read("index.html")
    order = parse_boot_order(template)
    if LIST_JS not in order["scripts"]:
        raise ValueError("index.html does not load " + LIST_JS)
    ids = parse_feature_ids(read(LIST_JS))
    kept, dropped = apply_feature_filter(ids, only, without)
    for fid in kept:
        if not ID_RE.match(fid) or not (ROOT / "features" / (fid + ".js")).is_file():
            print("note: " + fid + " is in the list but features/" + fid + ".js is missing; it will show as a stub")
            kept = [k for k in kept if k != fid]
            dropped.append(fid)
    locale_path = next((s for s in order["scripts"] if s.startswith("locale/")), None)
    origin = None if workshop is not None else (api_origin(read(locale_path)) if locale_path else None)

    # The version's hash covers the sources, so it must be computed before the version is stamped in.
    h = hashlib.sha256()
    for path in order["styles"] + order["scripts"] + ["features/" + f + ".js" for f in kept]:
        if path not in NEVER_INLINE:
            h.update(path.encode() + b"\0" + normalise(read(path)).encode("utf-8") + b"\0")
    h.update(json.dumps([kept, dropped, workshop is not None, workshop]).encode())
    version = version or default_version(h.hexdigest())

    head = ('<meta name="theme-color" content="#0b5cad">\n<link rel="icon" href="' + svg_data_uri() + '">\n'
            '<link rel="apple-touch-icon" href="' + png_data_uri(192) + '">\n')
    html, scripts = assemble(template, read, kept, dropped, version, workshop, origin, head, manifest=True)

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "searchdesk.html").write_text(html, encoding="utf-8", newline="\n")
    (out_dir / "index.html").write_text(html, encoding="utf-8", newline="\n")
    title_m = re.search(r"<title>(.*?)</title>", html)
    (out_dir / "manifest.webmanifest").write_text(manifest_json(title_m.group(1) if title_m else "Search Desk", version),
                                                  encoding="utf-8", newline="\n")
    (out_dir / "sw.js").write_text(stamp_sw(read("sw.js"), version), encoding="utf-8", newline="\n")
    if cname:
        (out_dir / "CNAME").write_text(cname_text(cname), encoding="utf-8", newline="\n")
    for size in (192, 512):
        (out_dir / ("icon-%d.png" % size)).write_bytes(icon_png(size))
    return {"version": version, "size": len(html.encode("utf-8")), "scripts": len(scripts), "kept": kept,
            "dropped": dropped, "connect": origin, "out": out_dir}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build the single-file Search Desk.")
    ap.add_argument("--out")
    ap.add_argument("--features")
    ap.add_argument("--without")
    ap.add_argument("--workshop", action="store_true")
    ap.add_argument("--banner")
    ap.add_argument("--version")
    ap.add_argument("--cname")
    args = ap.parse_args(argv)
    out = Path(args.out) if args.out else ROOT / ("dist/workshop" if args.workshop else "dist")
    try:
        r = build(out, split_csv(args.features) or None, split_csv(args.without) or None,
                  (args.banner or "") if args.workshop else None, args.version, args.cname)
    except ValueError as e:
        sys.exit("build: " + str(e))
    print("built %s  version %s  %d bytes  %d inline scripts  connect-src %s" % (
        r["out"] / "searchdesk.html", r["version"], r["size"], r["scripts"], r["connect"] or "'none'"))
    print("features: " + (", ".join(r["kept"]) or "(none)") + ("   stubs: " + ", ".join(r["dropped"]) if r["dropped"] else ""))


if __name__ == "__main__":
    main()
