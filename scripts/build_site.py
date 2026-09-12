"""Render the homepages offline; optionally refresh their shared Atom snapshot."""

import argparse
import json
from datetime import datetime
from html import escape
from pathlib import Path
from string import Template
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://wei-lee.me"
FEEDS = {
    "tech": "https://blog.wei-lee.me/feeds/all.atom.xml",
    "life": "https://travlog.wei-lee.me/feeds/all.atom.xml",
}
ATOM = {"a": "http://www.w3.org/2005/Atom"}


def parse_feed(content, feed_url):
    posts = []
    for entry in ElementTree.fromstring(content).findall("a:entry", ATOM)[:3]:
        title = entry.find("a:title", ATOM)
        published = entry.findtext("a:published", namespaces=ATOM)
        published = published or entry.findtext("a:updated", namespaces=ATOM)
        href = next(
            (link.get("href") for link in entry.findall("a:link", ATOM)
             if link.get("rel", "alternate") == "alternate"), None,
        )
        if title is None or not published or not href:
            raise ValueError(f"Incomplete Atom entry in {feed_url}")
        url = urljoin(feed_url, href)
        if urlsplit(url).scheme not in {"http", "https"}:
            raise ValueError(f"Invalid post URL in {feed_url}: {url}")
        posts.append({
            "title": "".join(title.itertext()),
            "url": url,
            "date": datetime.fromisoformat(published.replace("Z", "+00:00")).date().isoformat(),
        })
    if not posts:
        raise ValueError(f"No posts found in {feed_url}")
    return posts


def render_posts(posts):
    rows = []
    for post in posts:
        if urlsplit(post["url"]).scheme not in {"http", "https"}:
            raise ValueError(f"Invalid post URL: {post['url']}")
        datetime.strptime(post["date"], "%Y-%m-%d")
        values = {key: escape(value, quote=True) for key, value in post.items()}
        rows.append(
            '<li><a href="{url}"><span lang="zh-Hant">{title}</span>'
            '<time datetime="{date}">{date}</time></a></li>'.format(**values)
        )
    return "\n          ".join(rows)


def render_pages(root, posts):
    locales = json.loads((root / "data/locales.json").read_text(encoding="utf-8"))
    template = Template((root / "template/index.html.tpl").read_text(encoding="utf-8"))
    pages = {}
    for lang, locale in locales.items():
        values = {key: escape(value, quote=True) for key, value in locale.items()}
        values.update(lang=lang, canonical=ORIGIN + locale["path"])
        values["alternates"] = "\n  ".join(
            f'<link rel="alternate" hreflang="{escape(item["html_lang"])}" '
            f'href="{ORIGIN}{escape(item["path"])}">'
            for item in locales.values()
        ) + f'\n  <link rel="alternate" hreflang="x-default" href="{ORIGIN}/">'
        values["og_alternates"] = "\n  ".join(
            f'<meta property="og:locale:alternate" content="{escape(item["og_locale"])}">'
            for code, item in locales.items() if code != lang
        )
        options = []
        for code in ("en", "ja", "zh"):
            item = locales[code]
            active = ' active' if code == lang else ''
            current = ' aria-current="page"' if code == lang else ''
            options.append(
                f'<a class="lang-option{active}" href="{escape(item["path"])}" '
                f'lang="{escape(item["html_lang"])}" hreflang="{escape(item["html_lang"])}" '
                f'data-value="{code}"{current}>{escape(item["label"])}</a>'
            )
        values["language_options"] = "\n        ".join(options)
        for key in ("job_title", "nationality"):
            # Script contents need JSON escaping, not HTML entity escaping.
            values[key + "_json"] = json.dumps(locale[key], ensure_ascii=False).replace("<", "\\u003c")
        values.update({key + "_posts": render_posts(entries) for key, entries in posts.items()})
        pages[locale["path"].lstrip("/") + "index.html"] = template.substitute(values)
    return pages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--refresh", action="store_true", help="Fetch latest posts before rendering")
    mode.add_argument("--check", action="store_true", help="Fail if checked-in pages need rebuilding")
    args = parser.parse_args()
    snapshot = ROOT / "data/posts.json"
    posts = json.loads(snapshot.read_text(encoding="utf-8"))
    if args.refresh:
        # Fetch and render everything before changing any tracked output.
        posts = {}
        for key, url in FEEDS.items():
            # The feed hosts reject urllib's default Python-urllib User-Agent.
            request = Request(url, headers={
                "User-Agent": "WeiLeeHomepage/1.0 (+https://github.com/Lee-W/Lee-W)",
                "Accept": "application/atom+xml, application/xml;q=0.9",
            })
            with urlopen(request, timeout=30) as response:
                posts[key] = parse_feed(response.read(), url)
    pages = render_pages(ROOT, posts)
    if args.check:
        stale = [name for name, html in pages.items()
                 if not (ROOT / name).exists() or (ROOT / name).read_text(encoding="utf-8") != html]
        if stale:
            parser.exit(1, "Run python3 scripts/build_site.py to update: " + ", ".join(stale) + "\n")
        print("Generated homepages are up to date.")
        return
    if args.refresh:
        snapshot.write_text(json.dumps(posts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for name, html in pages.items():
        target = ROOT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")
    print("Rendered " + ", ".join(pages))


if __name__ == "__main__":
    main()
