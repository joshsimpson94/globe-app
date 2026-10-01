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

## Maintenance map

The root JavaScript and CSS files are both the editable source and the published assets. There is no build step. Search for the section headings below to find related code; keep supporting functions and handlers together within those sections.

| Change | Where to work |
| --- | --- |
| Colours and controls | CSS **Tokens and widget defaults**, then the relevant component section. Canvas colours and border settings are in JavaScript **Configuration**; sphere and sky drawing are in **Geometry and rendering**. |
| UI transitions | JavaScript **UI motion** owns cancellable visibility transitions, with timings in **Configuration**. CSS component rules own hover/focus easing and icon press feedback; **Reduced UI motion** disables CSS motion. |
| Rotation, zoom, and country focus | JavaScript **Configuration** and **Camera movement and selection**. `render` advances motion; `drawFrame` draws the resulting view. |
| Drag, pinch, taps, and wheel input | JavaScript **Gestures** sections. Frame capture handlers and canvas handlers cooperate; preserve their registration order and capture/passive options. |
| Country search and names | JavaScript **Country data**, **Shared helpers**, and **Search**. Selection and camera movement remain in **Camera movement and selection**. |
| Population data and labels | Refresh the marked generated block with `scripts/update-population.mjs`; keep its markers intact. `updateCountryLabel` formats the display, styled by CSS **Selection information and clear control**. |
| Geometry detail and canvas sizing | JavaScript **Geometry and rendering**, including `getRenderGeometrySource` and `resizeCanvas`. CSS **Responsive rules** keeps viewport and container rules in their existing cascade order. |
| Initialization and host integration | JavaScript **Widget startup** and **Page startup and public API**. See the release and standalone embed sections below for host-specific integration. |

Per-widget elements and state stay together at the start of `createGlobeWidget`. Its startup sequence is `initializeDependencies` → `registerEventListeners` → `initializeView`; the view is sized and drawn before animation starts when visible. Page startup loads topology before initializing widgets. The public `window.WebflowGlobeWidget.init()` entry point remains available to hosts with data already loaded.

Treat asset filenames, `WORLD_TOPOLOGY*` globals, `data-*` hooks, CSS classes/custom properties, and the public initializer as the embed contract. Keep existing paste-in markup and the portfolio iframe compatible. Routine cleanup does not require changing CDN pins or the Vercel integration.

Run `node --test tests/*.test.mjs` for deterministic interaction and topology-loading checks, and `node --check globe-widget.js` after structural JavaScript edits. Tests instrument the runtime in memory; do not add a shipped test API. Follow `AGENTS.md` for when focused browser checks are appropriate.

## Icons

Zoom and clear buttons use [Feather v4.29.2](https://github.com/feathericons/feather/tree/v4.29.2/icons) plus, minus, and x SVGs embedded as CSS data URLs. The existing button markup, accessible labels, click handlers, and hit areas stay intact, including in existing embeds. No icon font, extra asset request, or runtime library is required. The population link uses an inline SVG from the same icon set.

## Population

Search suggestions show country names only. Clicking or tapping a country centres and fits it and displays its name above a quieter `Population 69.5M` line. Choosing a search result also selects it. Deselecting restores the zoom level from before the first selection, including after switching countries. There are no pins or side panels. UK aliases (including England, Scotland, Wales, and Northern Ireland) select the United Kingdom total.

The **More info** source link is temporarily hidden; its markup and World Bank destination remain in place for a later release. Clicking or tapping anywhere on the selected-country bar clears the selection, as does its × button. Screen readers receive the full population number. Values use compact English formatting with at most one decimal place (for example, `69.5M` or `9.5K`); the reporting year is stored internally but not shown. Areas without data show only the country name.

Population data comes from the [World Bank World Development Indicators, SP.POP.TOTL](https://data.worldbank.org/indicator/SP.POP.TOTL), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It uses the latest available non-empty annual observation for each mapped country; it is not a live population count. The widget bundles the snapshot inside its JavaScript, so selection makes no data request and needs no API key or extra embed asset.

Run `node scripts/update-population.mjs` with Node.js 20+ and network access during maintenance or release preparation. The script fetches all API pages, excludes aggregate regions, maps topology names to World Bank countries, and reports coverage gaps. It validates the responses before atomically replacing the generated snapshot; failed refreshes preserve the previous file. Review the generated diff and coverage report before releasing.

## Interaction behaviour

- The first click, tap, drag, pinch, search, and zoom-control interaction work immediately on every device. Mouse hover highlights countries where a fine pointer is available. Wheel input zooms the globe while the pointer is over its canvas; leaving the widget, pressing Escape, or leaving the window disables wheel zoom until the pointer returns to the canvas.
- Dragging starts after 2 CSS pixels with a mouse or 4 with touch and then follows the pointer directly. A flick slows down continuously with a soft speed limit; touching again stops it immediately. Automatic rotation blends back in without an idle pause.
- Pinching follows finger separation directly and can continue into a drag with the remaining finger. Zoom buttons change the scale by a factor of 1.25; double taps use 1.5. Double-tap drag and wheel zoom ease toward their input targets; wheel zoom reverses immediately and limits outstanding movement to prevent runaway bursts.
- Country focus and the return zoom both take 500 ms with a gentle start and finish, and can be interrupted by a new gesture. Reduced-motion interactions apply the destination immediately. Deselecting starts the return zoom and resumes automatic rotation immediately.

Run the deterministic interaction checks with `node --test tests/interactions.test.mjs`. Browser verification should include native wheel scrolling through a scrollable host's `sandbox="allow-scripts"` iframe, plus phone and tablet touch gestures. Final interaction feel should be reviewed on physical devices.

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

### Host-controlled animation

An iframe host can opt a widget into paused startup with `data-globe-activity="host"`.
The widget draws its initial frame, then posts `{ type: "portfolio-sample-ready" }` to its parent.
The parent sends `{ type: "portfolio-sample-activity", active: boolean }` to pause or resume.
Only messages from the parent with a boolean activity value are accepted. Hosts must validate
ready messages against their iframe's `contentWindow`. Pausing preserves selection, search and
zoom, and resuming excludes paused time from camera transitions. Hidden documents pause too.
Without the opt-in attribute, the standalone animation behaviour is unchanged.
