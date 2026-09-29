# Globe widget

This repository owns the standalone globe assets used by Josh Simpson's Vercel portfolio. `demo.html` is a local and GitHub Pages preview. `embed-snippet.html` remains an optional standalone/Webflow example; it is not the portfolio integration.

## Files

- `globe-widget.css` and `globe-widget.js`: scoped widget styles and behavior.
- `countries-50m.json`: normal-detail country topology.
- `countries-50m-overview.json`: simplified topology for the zoomed-out globe.
- `countries-50m-close.json`: full-detail topology for close zoom.
- `demo.html`: standalone preview.
- `embed-snippet.html`: optional standalone embed markup.

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
