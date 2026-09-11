import json
import io
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_site import ROOT, parse_feed, render_pages, render_posts
import build_site
from check_site import check_site


class FeedTests(unittest.TestCase):
    def test_atom_links_dates_and_escaping(self):
        feed = b'''<feed xmlns="http://www.w3.org/2005/Atom"><entry>
          <title>A &amp; B &lt;script&gt;</title>
          <link rel="self" href="entry.atom"/>
          <link href="/posts/example?a=1&amp;b=2"/>
          <updated>2026-09-12T00:30:00+08:00</updated>
        </entry></feed>'''
        posts = parse_feed(feed, "https://blog.wei-lee.me/feeds/all.atom.xml")
        self.assertEqual(posts[0]["url"], "https://blog.wei-lee.me/posts/example?a=1&b=2")
        self.assertEqual(posts[0]["date"], "2026-09-12")
        rendered = render_posts(posts)
        self.assertIn("A &amp; B &lt;script&gt;", rendered)
        self.assertIn("?a=1&amp;b=2", rendered)
        self.assertNotIn("<script>", rendered)

    def test_empty_feed_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "No posts"):
            parse_feed(b'<feed xmlns="http://www.w3.org/2005/Atom"/>', "https://example.com/feed")

    def test_unsafe_post_url_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Invalid post URL"):
            render_posts([{"url": "javascript:alert(1)", "title": "Example", "date": "2026-09-12"}])

    def test_snapshot_is_shared_by_all_languages(self):
        posts = json.loads((ROOT / "data/posts.json").read_text(encoding="utf-8"))
        pages = render_pages(ROOT, posts)
        for name, html in pages.items():
            with self.subTest(page=name):
                for entries in posts.values():
                    self.assertIn(render_posts(entries), html)

    def test_failed_refresh_preserves_existing_files(self):
        feed = b'''<feed xmlns="http://www.w3.org/2005/Atom"><entry>
          <title>New post</title><link href="https://example.com/post"/>
          <published>2026-09-12T00:30:00+08:00</published>
        </entry></feed>'''
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            (root / "data").mkdir()
            snapshot = root / "data/posts.json"
            snapshot.write_text('{"tech": [], "life": []}', encoding="utf-8")
            homepage = root / "index.html"
            homepage.write_text("Existing homepage", encoding="utf-8")
            with patch.object(build_site, "ROOT", root), patch.object(sys, "argv", ["build_site.py", "--refresh"]):
                with patch.object(build_site, "urlopen", side_effect=[io.BytesIO(feed), OSError("Feed unavailable")]):
                    with self.assertRaisesRegex(OSError, "Feed unavailable"):
                        build_site.main()
            self.assertEqual(snapshot.read_text(), '{"tech": [], "life": []}')
            self.assertEqual(homepage.read_text(), "Existing homepage")


class LinkCheckTests(unittest.TestCase):
    def test_missing_assets_fragments_and_wrong_language_links_are_reported(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            (root / "data").mkdir()
            shutil.copy(ROOT / "data/locales.json", root / "data/locales.json")
            for name in ("index.html", "en/index.html", "ja/index.html"):
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text((ROOT / name).read_text(encoding="utf-8"), encoding="utf-8")
            english = root / "en/index.html"
            html = english.read_text(encoding="utf-8").replace(
                "https://blog.wei-lee.me/en/pages/about-me", "https://blog.wei-lee.me/pages/about-me"
            ).replace('<main class="page">', '<main class="page"><a href="/#missing">Broken</a>')
            english.write_text(html, encoding="utf-8")
            errors, _ = check_site(root)
            self.assertTrue(any("missing local target: /css/home.css" in error for error in errors))
            self.assertTrue(any("missing fragment: /#missing" in error for error in errors))
            self.assertIn("en/index.html: incorrect localized aboutLink", errors)


if __name__ == "__main__":
    unittest.main()
