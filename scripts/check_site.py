"""Check local HTML references and the generated language navigation offline."""

import json
import os
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

from build_site import ORIGIN, ROOT


class Document(HTMLParser):
    def __init__(self, content):
        super().__init__()
        self.elements = []
        self.ids = set()
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if "id" in attrs:
            self.ids.add(attrs["id"])


def check_site(root):
    documents = {}
    for folder, dirs, files in os.walk(root):
        dirs[:] = [name for name in dirs if not name.startswith(".") and name not in {
            "node_modules", "test-results", "playwright-report", "template", "tests",
        }]
        for name in files:
            if name.endswith(".html"):
                path = Path(folder, name)
                documents[path] = Document(path.read_text(encoding="utf-8"))
    errors = []
    for path, document in documents.items():
        source = path.relative_to(root).as_posix()
        for _, attrs in document.elements:
            for attribute in ("href", "src"):
                value = attrs.get(attribute)
                if not value:
                    continue
                url = urlsplit(urljoin(ORIGIN + "/" + source, value))
                if url.scheme not in {"http", "https"} or url.netloc != urlsplit(ORIGIN).netloc:
                    continue
                target = (root / unquote(url.path).lstrip("/")).resolve()
                if root not in target.parents and target != root:
                    errors.append(f"{source}: reference outside the site: {value}")
                    continue
                if target.is_dir():
                    target /= "index.html"
                if not target.is_file():
                    errors.append(f"{source}: missing local target: {value}")
                elif url.fragment and not url.fragment.startswith(":~:text=") and target in documents:
                    if unquote(url.fragment) not in documents[target].ids:
                        errors.append(f"{source}: missing fragment: {value}")

    locales = json.loads((root / "data/locales.json").read_text(encoding="utf-8"))
    alternates = {item["html_lang"]: ORIGIN + item["path"] for item in locales.values()}
    alternates["x-default"] = ORIGIN + "/"
    for lang, locale in locales.items():
        name = locale["path"].lstrip("/") + "index.html"
        document = documents.get(root / name)
        if document is None:
            errors.append(f"Missing homepage: {name}")
            continue
        elements = document.elements

        def require(condition, message):
            if not condition:
                errors.append(f"{name}: {message}")

        html = next((attrs for tag, attrs in elements if tag == "html"), {})
        require(html.get("lang") == locale["html_lang"], "incorrect document language")
        require(html.get("class") == "lang-" + lang, "incorrect language class")
        canonical = [attrs.get("href") for tag, attrs in elements
                     if tag == "link" and attrs.get("rel") == "canonical"]
        require(canonical == [ORIGIN + locale["path"]], "incorrect canonical URL")
        actual = [(attrs.get("hreflang"), attrs.get("href")) for tag, attrs in elements
                  if tag == "link" and attrs.get("rel") == "alternate"]
        require(len(actual) == len(alternates) and dict(actual) == alternates, "incorrect hreflang links")
        current = [attrs for tag, attrs in elements
                   if tag == "a" and attrs.get("aria-current") == "page"]
        require(len(current) == 1 and current[0].get("href") == locale["path"], "incorrect active language")
        for element_id, suffix in (("aboutLink", "about-me"), ("nowLink", "now")):
            link = next((attrs for _, attrs in elements if attrs.get("id") == element_id), {})
            expected = "https://blog.wei-lee.me" + locale["blog_language_path"] + "/pages/" + suffix
            require(link.get("href") == expected, f"incorrect localized {element_id}")
    return errors, len(documents)


if __name__ == "__main__":
    errors, count = check_site(ROOT)
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Checked local links in {count} HTML pages and all homepage language links.")
