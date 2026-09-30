# Globe widget

This repository owns the standalone globe assets used by Josh Simpson's Vercel portfolio. `demo.html` is a local and GitHub Pages preview. `embed-snippet.html` remains an optional standalone/Webflow example; it is not the portfolio integration.

## Files

- `globe-widget.css` and `globe-widget.js`: scoped widget styles and behavior.
- `countries-50m.json`: normal-detail country topology.
- `countries-50m-overview.json`: simplified topology for the zoomed-out globe.
- `countries-50m-close.json`: full-detail topology for close zoom.
- `demo.html`: standalone preview.
- `embed-snippet.html`: optional standalone embed markup.
- `FEATHER-LICENSE.txt`: MIT license for the embedded Feather control and external-link icons.
- `scripts/update-population.mjs`: refreshes the bundled population snapshot.

## Icons

Zoom and clear buttons use [Feather v4.29.2](https://github.com/feathericons/feather/tree/v4.29.2/icons) plus, minus, and x SVGs embedded as CSS data URLs. The existing button markup, accessible labels, click handlers, and hit areas stay intact, including in existing embeds. No icon font, extra asset request, or runtime library is required. The population link uses an inline SVG from the same icon set.

## Population

Search suggestions show country names only. Selecting a country by search or on the globe centers the country and displays its name above a quieter `Population 69.5M` line in the bottom label. There are no pins or side panels. UK aliases (including England, Scotland, Wales, and Northern Ireland) select the United Kingdom total.

The **More info** source link is temporarily hidden; its markup and World Bank destination remain in place for a later release. Clicking or tapping anywhere on the selected-country bar clears the selection, as does its × button. Screen readers receive the full population number. Values use compact English formatting with at most one decimal place (for example, `69.5M` or `9.5K`); the reporting year is stored internally but not shown. Areas without data show only the country name.

Population data comes from the [World Bank World Development Indicators, SP.POP.TOTL](https://data.worldbank.org/indicator/SP.POP.TOTL), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It uses the latest available non-empty annual observation for each mapped country; it is not a live population count. The widget bundles the snapshot inside its JavaScript, so selection makes no data request and needs no API key or extra embed asset.

Run `node scripts/update-population.mjs` with Node.js 20+ and network access during maintenance or release preparation. The script fetches all API pages, excludes aggregate regions, maps topology names to World Bank countries, and reports coverage gaps. It validates the responses before atomically replacing the generated snapshot; failed refreshes preserve the previous file. Review the generated diff and coverage report before releasing.

## Release to the Vercel portfolio

The portfolio at [`joshsimpson94/josh-simpson-portfolio-2026`](https://github.com/joshsimpson94/josh-simpson-portfolio-2026) loads these five assets from jsDelivr at one immutable Globe-App commit. Its pinned SHA is `globeCommit` in `src/components/site/global-search-sample.tsx`. A merge to this repository does **not** update the Vercel site by itself.

1. Finish and validate the globe changes here, then commit and merge them into `main`.
2. Record the merged Globe-App `main` SHA. Confirm jsDelivr serves the CSS, JavaScript, and all three topology JSON files at `https://cdn.jsdelivr.net/gh/joshsimpson94/globe-app@<sha>/`. Use the repository's current lowercase name; the old `Globe-App` path may fail for new commits.
3. In a separate portfolio branch, update only `globeCommit` and the matching exact-SHA assertion in `tests/e2e/responsive-pages.spec.ts` for a routine globe release. Keep its iframe `srcDoc`, sandbox, preloads, media-query mapping, cursor overrides, and sizing: those are tuned specifically for the portfolio.
4. Follow the portfolio's `AGENTS.md` for relevant checks and preview review. Merge the portfolio PR to deploy through its Vercel integration, then verify `/how-i-use-ai` on the live site.

Report the Globe-App release SHA and the portfolio merge/deployment SHA separately. Do not use `embed-snippet.html` to replace the portfolio component.

## Standalone embed

The optional `embed-snippet.html` contains markup and a pinned CDN reference for a standalone embed. If you use it outside the portfolio, update its asset pin for that destination and publish the host page separately. It loads D3 and TopoJSON from jsDelivr.

The widget is scoped under `.wf-globe-widget`, and the JavaScript initializes every `[data-globe-widget]` element. Set `--wf-globe-height` on the outer widget to control its height in a standalone host.
