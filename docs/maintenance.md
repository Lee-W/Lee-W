# Website maintenance

The published site is static HTML. Python 3.9+ renders the homepages using only
the standard library; Node.js 22.22+ (22.x) or 24.8+ runs the validation and browser checks.

- `template/index.html.tpl`: shared homepage markup, using Python `string.Template` placeholders.
- `data/locales.json`: Chinese, English and Japanese text, metadata and destination paths.
- `data/posts.json`: the latest posts shared by every language, updated by the daily workflow.
- `index.html`, `en/index.html`, `ja/index.html`: generated files; commit these with their sources.
- `card/`, `css/`, `js/`, `404.html`: edited directly.
- `template/README.md.tpl`: GitHub profile source, rendered separately by readme-scribe.

The name markup stays in the shared template because Japanese ruby and the
secondary names have different markup. Japanese About/Now destinations use the
English blog pages; this fallback is explicit in `blog_language_path`.

## Build and preview

```sh
python3 scripts/build_site.py
python3 -m http.server 8000 --bind 127.0.0.1
```

The default build uses the checked-in post snapshot and needs no network access.
To update it from the two Atom feeds, run `python3 scripts/build_site.py --refresh`.
A failed fetch or invalid feed stops the refresh before writing the snapshot or
homepages. Requests identify this site's updater with a User-Agent because the
feed hosts return HTTP 403 for urllib's default agent. RSS fetching remains
separate from the GitHub profile workflow's existing README rendering.

## Checks

```sh
npm ci
npm run check
npx playwright install chromium
npm test
```

`npm run check` verifies that generated pages match their sources, validates HTML,
checks local `href`/`src` destinations and fragment IDs, checks homepage language
links, and runs feed rendering tests and JavaScript syntax checks. External links
are not fetched during PR checks.

The Chromium suite covers the three languages in light/dark mode at desktop and
mobile widths: keyboard order, text contrast via axe, minimum date/subtitle size,
horizontal overflow, language links without JavaScript, and navigation to/from the
digital card. External fonts, icons and analytics are blocked during these tests
for deterministic offline runs. Check the appearance with external fonts as well
when changing typography. Automated accessibility checks supplement manual review.

The card suite checks both card faces: modal keyboard focus, text contrast in all
three languages, QR generation failure and retry, PNG export failure and retry,
and delayed generation after closing the dialog or clearing the campaign name.

Pull requests and pushes to `main` run both check suites. The daily refresh fetches
the feeds and runs the static checks before the activity action can push its
template update. Daily and manual refreshes run one at a time and check out the
latest `main`, including on reruns, so an earlier attempt's activity commit does
not cause a rejected push. The final commit includes the generated README and
homepages.
