#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Unit tests for the pure parts of tools/serve.py.  Run: uv run tests/unit/test_serve.py  (or python3 -m unittest).

The serving itself is covered by the browser tests (tests/e2e) and by using it. What is here is the three
decisions that can quietly do harm: which files the server is allowed to hand out (a person's exported backup
can sit in this folder), what it adds to the page it sends (it must never touch the file), and when it decides
something changed (a hash of the files, so restarting it is not a change).
"""

import importlib.util
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
spec = importlib.util.spec_from_file_location("serve", ROOT / "tools" / "serve.py")
serve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve)

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Search Desk</title>
<link rel="stylesheet" href="core/desk.css">
</head><body><div id="root"></div>
<script src="core/desk.js"></script>
</body></html>
"""


def make_tree(root):
    """A folder shaped like the app's, with the things that must not be served next to the things that must."""
    files = {
        "index.html": PAGE,
        "core/desk.js": "window.Desk = {};\n",
        "core/desk.css": "body{margin:0}\n",
        "locale/toronto.js": "Desk.locale = {};\n",
        "data/example.js": "Desk.example = [];\n",
        "data/inbox.js": "window.DESK_INBOX = {};\n",
        "features/list.js": "Desk.features = ['home'];\n",
        "features/home.js": "// home\n",
        "checks/home.check.js": "Desk.check('home', function () {});\n",
        # Not the page's business, and some of it not anybody's business at all:
        ".git/config": "[core]\n",
        ".DS_Store": "junk",
        "docs/DESIGN.md": "# big\n",
        "tools/build.py": "print()\n",
        "tests/unit/store.test.js": "test()\n",
        "reference/thing.js": "//\n",
        "dist/searchdesk.html": "<html></html>\n",
        "screens/index.html": "<html></html>\n",
        "AGENTS.md": "# rules\n",
        "searchdesk-2026-10-18.json": '{"records":{"j_1":{"title":"a real job"}},"note":"real names"}',
        "data/events-snapshot.json": '{"note":"a cache"}',
    }
    for rel, text in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    return files


class TestIsPublic(unittest.TestCase):
    def test_the_pages_own_files_are_served(self):
        for rel in ("index.html", "core/desk.js", "core/desk.css", "locale/toronto.js", "data/example.js",
                    "data/inbox.js", "features/list.js", "features/home.js", "checks/home.check.js"):
            self.assertTrue(serve.is_public(rel), rel)

    def test_a_persons_exported_copy_is_not_served(self):
        # The app names an export searchdesk-<date>.json and a real one sits in this folder with real names in
        # it. --host 0.0.0.0 puts the server on the wifi, so this is the one that matters.
        self.assertFalse(serve.is_public("searchdesk-2026-10-18.json"))
        self.assertFalse(serve.is_public("data/events-snapshot.json"))
        self.assertFalse(serve.is_public("locale/anything.json"))

    def test_nothing_outside_the_pages_own_folders(self):
        for rel in (".git/config", "docs/DESIGN.md", "tools/build.py", "tests/unit/store.test.js",
                    "reference/thing.js", "dist/searchdesk.html", "screens/index.html", "AGENTS.md",
                    "README.md", ".DS_Store", "core/.DS_Store", "sw.js", "node_modules/x/y.js"):
            self.assertFalse(serve.is_public(rel), rel)

    def test_editor_leftovers_and_traversal(self):
        self.assertFalse(serve.is_public("features/home.js~"))
        self.assertFalse(serve.is_public("core/../.git/config"))
        self.assertFalse(serve.is_public(""))
        self.assertFalse(serve.is_public("/"))
        self.assertFalse(serve.is_public("./index.html.bak"))

    def test_windows_separators_are_treated_as_slashes(self):
        self.assertTrue(serve.is_public("core\\desk.js"))
        self.assertFalse(serve.is_public(".git\\config"))


class TestWatchedFiles(unittest.TestCase):
    def test_it_watches_the_page_and_nothing_else(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            got = serve.watched_files(root)
            self.assertEqual(got, ["checks/home.check.js", "core/desk.css", "core/desk.js", "data/example.js",
                                   "data/inbox.js", "features/home.js", "features/list.js", "index.html",
                                   "locale/toronto.js"])
            self.assertNotIn("searchdesk-2026-10-18.json", got)   # a new export must not reload anyone's page
            self.assertNotIn(".git/config", got)

    def test_a_missing_folder_is_not_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text(PAGE, encoding="utf-8")
            self.assertEqual(serve.watched_files(root), ["index.html"])


class TestToken(unittest.TestCase):
    def test_it_changes_when_a_watched_file_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            files = serve.watched_files(root)
            before = serve.token_for(root, files)
            (root / "features" / "home.js").write_text("// home, changed\n", encoding="utf-8")
            self.assertNotEqual(before, serve.token_for(root, serve.watched_files(root)))

    def test_it_changes_when_a_watched_file_is_added(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            before = serve.token_for(root, serve.watched_files(root))
            (root / "features" / "sites.js").write_text("// sites\n", encoding="utf-8")   # the agent's new feature
            self.assertNotEqual(before, serve.token_for(root, serve.watched_files(root)))

    def test_it_does_not_change_for_a_file_the_page_never_loads(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            before = serve.token_for(root, serve.watched_files(root))
            (root / "docs" / "DESIGN.md").write_text("# bigger\n", encoding="utf-8")
            (root / "searchdesk-2026-10-18.json").write_text('{"note":"a new export"}', encoding="utf-8")
            self.assertEqual(before, serve.token_for(root, serve.watched_files(root)))

    def test_it_is_a_function_of_the_files_not_the_clock(self):
        # Restarting the server has to look like no change at all, or everybody's page reloads on every restart.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            files = serve.watched_files(root)
            self.assertEqual(serve.token_for(root, files), serve.token_for(root, files))
            self.assertTrue(re.fullmatch(r"[0-9a-f]{12}", serve.token_for(root, files)))

    def test_it_can_be_worked_out_at_any_moment_without_asking_the_server(self):
        # A tab opened just after a save must not be handed a stale token and then reload itself for no reason:
        # the page is served from the disk as it is now, so the token is worked out when the page goes out.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            (root / "features" / "home.js").write_text("// home, saved a moment ago\n", encoding="utf-8")
            self.assertEqual(serve.token_for(root, serve.watched_files(root)),
                             serve.token_for(root, serve.watched_files(root)))


class TestGoNote(unittest.TestCase):
    """The note in .dev-go: the one way the open tab is told which screen to show."""

    def test_it_reads_a_screen_name(self):
        self.assertEqual(serve.go_route("jobs"), "jobs")
        self.assertEqual(serve.go_route("  sites\n"), "sites")
        self.assertEqual(serve.go_route("#help"), "help")             # a hash is what a person would paste
        self.assertEqual(serve.go_route("jobs\nsomething else\n"), "jobs")   # the first line is the note

    def test_anything_that_is_not_a_screen_name_is_ignored(self):
        # It is written in a hurry by an agent, and a typo must not become a route. No quotes, no spaces, no
        # angle brackets, nothing that could end the script this text goes into.
        for text in ("", "   ", "\n", "Jobs", "job s", "job's", "</script>", "';window.x=1;'", "a" * 61,
                     "../../etc/passwd", "jobs?x=1", "jobs;alert(1)"):
            self.assertEqual(serve.go_route(text), "", repr(text))

    def test_a_screen_behind_a_tap_is_allowed(self):
        self.assertEqual(serve.go_route("sites/new"), "sites/new")

    def test_the_note_is_taken_out_of_the_file_so_the_same_word_works_twice(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".dev-go").write_text("jobs\n", encoding="utf-8")
            self.assertEqual(serve.take_go(root), "jobs")
            self.assertFalse((root / ".dev-go").exists())
            self.assertEqual(serve.take_go(root), "")                    # and it is not there to be used again

    def test_no_note_is_not_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(serve.take_go(Path(tmp)), "")

    def test_a_note_the_app_cannot_use_is_left_where_it_is(self):
        # Nothing was handed over, so nothing should be taken: a person can see what the server refused and fix
        # it. Otherwise a typo would look like the feature is broken.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = root / ".dev-go"
            path.write_text("Jobs!\n", encoding="utf-8")
            self.assertEqual(serve.take_go(root), "")
            self.assertTrue(path.exists())

    def test_the_note_is_watched_so_writing_it_reaches_the_open_tab(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_tree(root)
            self.assertNotIn(".dev-go", serve.watched_files(root))
            (root / ".dev-go").write_text("jobs\n", encoding="utf-8")
            self.assertIn(".dev-go", serve.watched_files(root))

    def test_the_note_is_never_served(self):
        # It is a note to the dev server, and it is gone by the time anyone could ask for it, but a server that
        # hands out its own bookkeeping is a server that will hand out more later.
        self.assertFalse(serve.is_public(".dev-go"))


class TestDevScript(unittest.TestCase):
    def test_nothing_goes_in_when_both_are_off(self):
        self.assertEqual(serve.dev_script(reload=False, workshop=False), "")

    def test_the_reload_helper_carries_the_token_the_page_was_sent(self):
        script = serve.dev_script(token="abc123def456")
        self.assertIn('var token = "abc123def456";', script)
        self.assertIn("searchdesk-dev-reload", script)      # once, however many tabs are open
        self.assertIn("__dev", script)

    def test_it_carries_the_screen_to_go_to_and_uses_the_apps_own_way(self):
        script = serve.dev_script(go="sites")
        self.assertIn('var go = "sites";', script)
        self.assertIn("Desk.ui.go(go)", script)              # not a hash written behind the app's back
        self.assertIn('var go = "";', serve.dev_script())   # no note, no screen

    def test_the_workshop_line_is_the_one_the_build_inlines(self):
        self.assertEqual(serve.workshop_script(),
                         "window.DESK_WORKSHOP = { autoExample: true, liveEvents: false };\n")
        self.assertIn('autoExample: true, liveEvents: false, banner: "Practice computer"', serve.workshop_script("Practice computer"))

    def test_a_banner_with_a_quote_or_a_tag_in_it_cannot_escape_the_script(self):
        # It goes into a <script> element as text. A banner is the host's own words, and "</script>" in it
        # would end the line early and leave the rest of it to be read as markup.
        self.assertIn('banner: "a \\" b"', serve.workshop_script('a " b'))
        line = serve.workshop_script("</script><script>window.DESK_X=1</script>")
        self.assertNotIn("</script", line)
        self.assertIn("<\\/script>", line)

    def test_the_helper_is_es5_and_has_no_arrow_functions(self):
        # It runs in whatever browser is on the table, which may be older than this repo.
        body = serve.dev_script()
        self.assertNotIn("=>", body)
        self.assertNotIn("`", body)

    def test_the_poll_keeps_going_when_the_tab_is_hidden(self):
        # A poll that stopped would only start again by luck: the tab has to reload itself in a window that
        # opened in the background, and coming back to the tab must not be what makes it work.
        body = serve.dev_script()
        self.assertIn("document.hidden ? 2000 : 1000", body)
        self.assertNotIn("if (document.hidden) return;", body)


class TestAddScripts(unittest.TestCase):
    def test_the_scripts_go_in_the_head_before_the_apps_own(self):
        page = serve.add_scripts(PAGE, "<script>DEV</script>")
        self.assertLess(page.index("DEV"), page.index("core/desk.js"))
        self.assertEqual(page.replace("<script>DEV</script>", ""), PAGE)   # and nothing else is touched

    def test_two_scripts_keep_their_order(self):
        page = serve.add_scripts(PAGE, "<script>ONE</script><script>TWO</script>")
        self.assertLess(page.index("ONE"), page.index("TWO"))
        self.assertEqual(page.replace("<script>ONE</script>", "").replace("<script>TWO</script>", ""), PAGE)

    def test_a_page_with_no_head_is_left_alone_and_says_so(self):
        # None, not a page with nothing added: the caller answers 500 rather than serving a page whose reload
        # helper is missing, which would look like "nothing reloads any more".
        self.assertIsNone(serve.add_scripts("<p>not the app</p>", "<script>DEV</script>"))

    def test_no_scripts_means_the_page_untouched(self):
        self.assertEqual(serve.add_scripts(PAGE, ""), PAGE)


class TestWorkshopMode(unittest.TestCase):
    def test_the_line_says_the_two_things_a_workshop_needs(self):
        line = serve.workshop_script()
        self.assertIn("autoExample: true", line)     # opens straight into Amira
        self.assertIn("liveEvents: false", line)     # asks the network for nothing

    def test_it_matches_what_the_build_writes_for_a_workshop(self):
        # One source of truth matters: a page served in workshop mode and a built workshop copy have to behave
        # the same way, or what a person practises on is not what they take home.
        build_spec = importlib.util.spec_from_file_location("build", ROOT / "tools" / "build.py")
        build = importlib.util.module_from_spec(build_spec)
        build_spec.loader.exec_module(build)
        self.assertEqual(build.workshop_script(None), serve.workshop_script(None))
        self.assertEqual(build.workshop_script("Practice computer"), serve.workshop_script("Practice computer"))


class TestUrls(unittest.TestCase):
    def test_a_local_server_prints_the_local_address(self):
        self.assertEqual(serve.urls_for("127.0.0.1", 8000), ["http://127.0.0.1:8000/"])

    def test_a_bound_server_prints_the_address_a_phone_needs_too(self):
        urls = serve.urls_for("0.0.0.0", 8123)
        self.assertEqual(urls[0], "http://127.0.0.1:8123/")
        self.assertRegex(urls[1], r"^http://(?!127\.0\.0\.1)[\d.]+:8123/$")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        unittest.main()
    else:
        unittest.main(verbosity=2)
