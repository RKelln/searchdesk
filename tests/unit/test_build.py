#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Unit tests for the pure parts of tools/build.py.  Run: uv run tests/unit/test_build.py  (or python3 -m unittest)."""

import base64
import hashlib
import importlib.util
import re
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
spec = importlib.util.spec_from_file_location("build", ROOT / "tools" / "build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

INDEX = """<!doctype html><html><head>
<meta charset="utf-8"><title>T</title>
<link rel="stylesheet" href="core/desk.css">
</head><body>
<script src="core/desk.js"></script>
<script src="core/io.js"></script>
<!-- <script src="data/commented.js"></script> -->
<script src="data/workshop.js"></script>
<script src="features/list.js"></script>
</body></html>"""

FILES = {
    "core/desk.css": "body{margin:0}\n",
    "core/desk.js": "window.Desk = {};\n",
    "core/io.js": "var a = '</script>';\r\n",
    "data/workshop.js": "window.NOPE = 1;",
    "features/list.js": "Desk.features = ['home', 'jobs', 'help'];\nDesk.planned = [];\n",
    "features/home.js": "// home\n\n\n  \n// more\n",
    "features/jobs.js": "// jobs\n",
    "features/help.js": "// help\n",
}


def read(path):
    return FILES[path]


class BootOrder(unittest.TestCase):
    def test_order_comes_from_index_and_comments_are_ignored(self):
        o = build.parse_boot_order(INDEX)
        self.assertEqual(o["styles"], ["core/desk.css"])
        self.assertEqual(o["scripts"], ["core/desk.js", "core/io.js", "data/workshop.js", "features/list.js"])

    def test_real_index_loads_core_then_locale_then_data_then_list(self):
        o = build.parse_boot_order((ROOT / "index.html").read_text(encoding="utf-8"))["scripts"]
        self.assertEqual(o[0], "core/desk.js")
        self.assertLess(o.index("core/contract.js"), o.index("locale/toronto.js"))
        self.assertLess(o.index("locale/toronto.js"), o.index("data/example.js"))
        self.assertEqual(o[-1], "features/list.js")
        for path in o:
            self.assertTrue((ROOT / path).is_file(), path)

    def test_feature_ids(self):
        self.assertEqual(build.parse_feature_ids("Desk.features = ['a', \"b-c\"];\nDesk.planned = [{id:'zz'}];"), ["a", "b-c"])
        self.assertEqual(build.parse_feature_ids("Desk.features = [\n 'a', // note 'x'\n 'b',\n];"), ["a", "b"])
        with self.assertRaises(ValueError):
            build.parse_feature_ids("nothing")


class Filter(unittest.TestCase):
    ids = ["home", "jobs", "help"]

    def test_all_by_default(self):
        self.assertEqual(build.apply_feature_filter(self.ids), (self.ids, []))

    def test_only_and_without_keep_list_order(self):
        self.assertEqual(build.apply_feature_filter(self.ids, only=["help", "home"]), (["home", "help"], ["jobs"]))
        self.assertEqual(build.apply_feature_filter(self.ids, without=["jobs"]), (["home", "help"], ["jobs"]))
        self.assertEqual(build.apply_feature_filter(self.ids, only=["home", "jobs"], without=["jobs"]), (["home"], ["jobs", "help"]))

    def test_unknown_id_is_an_error(self):
        with self.assertRaises(ValueError):
            build.apply_feature_filter(self.ids, only=["nope"])
        with self.assertRaises(ValueError):
            build.apply_feature_filter(self.ids, without=["nope"])

    def test_split_csv(self):
        self.assertEqual(build.split_csv(" a, b ,,c"), ["a", "b", "c"])
        self.assertEqual(build.split_csv(None), [])


class Hashing(unittest.TestCase):
    def test_sha256_token(self):
        want = "'sha256-" + base64.b64encode(hashlib.sha256(b"alert(1)").digest()).decode() + "'"
        self.assertEqual(build.sha256_token("alert(1)"), want)
        self.assertTrue(re.fullmatch(r"'sha256-[A-Za-z0-9+/]{43}='", build.sha256_token("x")))

    def test_script_end_and_comment_open_are_escaped(self):
        out = build.safe_inline_script("a = '</script>'; b = '</SCRIPT'; c = '<!--';")
        self.assertNotRegex(out, r"(?i)</script")
        self.assertNotIn("<!--", out)

    def test_csp_text(self):
        csp = build.make_csp(["'sha256-a'", "'sha256-b'"], "https://x.example")
        self.assertIn("script-src 'sha256-a' 'sha256-b';", csp)
        self.assertNotIn("unsafe-inline'; img", csp.replace("style-src 'unsafe-inline'", ""))
        self.assertIn("connect-src https://x.example;", csp)
        self.assertIn("connect-src 'none';", build.make_csp(["'sha256-a'"], None))

    def test_api_origin(self):
        self.assertEqual(build.api_origin("events: { api: 'https://h.example/api/v1/events', x: 1 }"), "https://h.example")
        self.assertIsNone(build.api_origin("events: { api: null }"))
        self.assertIsNone(build.api_origin("events: { api: 'http://insecure.example/x' }"))
        real = build.api_origin((ROOT / "locale" / "toronto.js").read_text(encoding="utf-8"))
        self.assertEqual(real, "https://staging.toronto.togather.foundation")


class Assemble(unittest.TestCase):
    def go(self, **kw):
        args = dict(features=["home", "jobs", "help"], dropped=[], version="1.2.3+abc", workshop=None, connect_origin=None)
        args.update(kw)
        return build.assemble(INDEX, read, **args)

    def hashes_in(self, html):
        csp = re.search(r'Content-Security-Policy" content="([^"]*)"', html).group(1)
        return re.findall(r"'sha256-[^']+'", csp.split("script-src")[1].split(";")[0])

    def test_every_inline_script_is_hashed_exactly_and_nothing_else_is_inline(self):
        html, scripts = self.go()
        bodies = re.findall(r"<script>(.*?)</script>", html, re.S)
        self.assertEqual(bodies, scripts)
        self.assertEqual(self.hashes_in(html), [build.sha256_token(b) for b in bodies])
        self.assertNotRegex(html, r"<script\s+src")
        self.assertNotIn("data/workshop.js", html)
        self.assertNotIn("NOPE", html)
        self.assertNotIn("\r", html)

    def test_order_is_core_version_list_then_features(self):
        html, scripts = self.go()
        flat = "".join(scripts)
        marks = ["window.Desk = {}", "Desk.version", "var a =", "Desk.features = ['home'", "// home", "// jobs", "// help"]
        pos = [flat.index(m) for m in marks]
        self.assertEqual(pos, sorted(pos))
        self.assertIn('Desk.version = "1.2.3+abc"', flat)
        self.assertIn("<style>\nbody{margin:0}\n</style>", html)
        self.assertLess(html.index("Content-Security-Policy"), html.index("<script>"))

    def test_filter_leaves_stubs_and_drops_the_files(self):
        html, scripts = self.go(features=["home"], dropped=["jobs", "help"])
        flat = "".join(scripts)
        self.assertNotIn("// jobs", flat)
        self.assertIn('["jobs", "help"].forEach', flat)
        self.assertIn("Desk.missing(id)", flat)

    def test_workshop_stanza(self):
        _, scripts = self.go(workshop="")
        self.assertIn("window.DESK_WORKSHOP = { autoExample: true, liveEvents: false };", "".join(scripts))
        _, scripts = self.go(workshop='Say "hi"')
        self.assertIn('banner: "Say \\"hi\\""', "".join(scripts))
        _, scripts = self.go()
        self.assertNotIn("DESK_WORKSHOP", "".join(scripts))

    def test_manifest_link_is_added_by_a_hashed_script_not_a_static_tag(self):
        html, scripts = build.assemble(INDEX, read, ["home", "jobs", "help"], [], "v", manifest=True)
        self.assertNotIn('<link rel="manifest"', html)
        self.assertTrue(any("manifest.webmanifest" in sc for sc in scripts))
        self.assertIn(build.sha256_token([sc for sc in scripts if "manifest.webmanifest" in sc][0]), html)

    def test_head_extra_and_charset_first(self):
        html, _ = self.go(head_extra='<link rel="manifest" href="manifest.webmanifest">\n')
        self.assertLess(html.index("<meta charset"), html.index("Content-Security-Policy"))
        self.assertIn('rel="manifest"', html)


class Icons(unittest.TestCase):
    def test_png_is_valid(self):
        data = build.icon_png(32)
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        w, h = struct.unpack(">II", data[16:24])
        self.assertEqual((w, h), (32, 32))
        idat = data[data.index(b"IDAT") + 4:data.index(b"IEND") - 8]
        self.assertEqual(len(zlib.decompress(idat)), 32 * (1 + 32 * 3))

    def test_manifest_is_json_with_icons(self):
        import json
        m = json.loads(build.manifest_json("Search Desk", "v"))
        self.assertEqual(m["display"], "standalone")
        self.assertTrue(all(i["src"].endswith(".png") for i in m["icons"]))


class Hosting(unittest.TestCase):
    SW = "// c\nvar VERSION = 'dev';\nvar CACHE = 'x' + VERSION;\n"

    def test_sw_version_is_stamped_once(self):
        out = build.stamp_sw(self.SW, "2026.10.19+ab12cd34")
        self.assertIn("var VERSION = '2026.10.19+ab12cd34';", out)
        self.assertNotIn("'dev'", out)
        self.assertIn("var CACHE = 'x' + VERSION;", out)

    def test_sw_without_version_line_is_an_error(self):
        with self.assertRaises(ValueError):
            build.stamp_sw("var x = 1;", "t")

    def test_cname_text(self):
        self.assertEqual(build.cname_text(" SearchDesk.RyanKelln.com "), "searchdesk.ryankelln.com\n")
        for bad in ("", "https://a.example.com", "a b.com", "nodots", "a.com/x"):
            with self.assertRaises(ValueError):
                build.cname_text(bad)

    def test_real_build_writes_sw_and_cname(self):
        with tempfile.TemporaryDirectory() as d:
            build.build(Path(d), version="v-test", cname="searchdesk.ryankelln.com")
            self.assertIn("var VERSION = 'v-test';", (Path(d) / "sw.js").read_text())
            self.assertEqual((Path(d) / "CNAME").read_text(), "searchdesk.ryankelln.com\n")
            build.build(Path(d) / "n", version="v-test")
            self.assertFalse((Path(d) / "n" / "CNAME").exists())

    def test_hosting_script_is_inlined_and_hashed(self):
        with tempfile.TemporaryDirectory() as d:
            build.build(Path(d), version="t")
            html = (Path(d) / "searchdesk.html").read_text()
            self.assertIn("Desk.hosting", html)
            self.assertIn("worker-src 'self'", html)


class Whole(unittest.TestCase):
    def test_real_build_is_deterministic_and_has_no_external_script(self):
        with tempfile.TemporaryDirectory() as d:
            a = build.build(Path(d) / "a", version="t")
            b = build.build(Path(d) / "b", version="t")
            ha = (Path(d) / "a" / "searchdesk.html").read_bytes()
            self.assertEqual(ha, (Path(d) / "b" / "searchdesk.html").read_bytes())
            self.assertEqual(ha, (Path(d) / "a" / "index.html").read_bytes())
            self.assertNotIn(b"<script", re.sub(rb"<script>.*?</script>", b"", ha, flags=re.S))  # no <script src> tag
            self.assertEqual(a["connect"], "https://staging.toronto.togather.foundation")
            w = build.build(Path(d) / "w", workshop="", version="t")
            self.assertIsNone(w["connect"])
            self.assertIn("connect-src 'none'", (Path(d) / "w" / "searchdesk.html").read_text())


if __name__ == "__main__":
    unittest.main()
