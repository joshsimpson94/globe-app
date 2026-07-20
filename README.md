# Webflow Globe Widget

This folder contains the Webflow-ready globe.

## Files

- `embed-snippet.html`: markup to paste into a Webflow Embed element.
- `globe-widget.css`: scoped styles for the widget.
- `globe-widget.js`: scoped initializer and globe behavior.
- `countries-50m.json`: higher-detail world country topology data, including microstates.
- `countries-50m-overview.json`: lower-detail topology used only for the fully zoomed-out globe.
- `countries-50m-close.json`: full-detail topology used only close to maximum zoom.
- `demo.html`: local test page.

## Webflow Setup

1. Host these custom files somewhere public:
   - `globe-widget.css`
   - `globe-widget.js`
   - `countries-50m.json`
   - `countries-50m-overview.json`
   - `countries-50m-close.json`

2. Paste the contents of `embed-snippet.html` into a Webflow Embed element.

3. Replace these placeholder paths with the hosted URLs:
   - `/assets/globe-widget.css`
   - `/assets/countries-50m.json`
   - `/assets/countries-50m-overview.json`
   - `/assets/countries-50m-close.json`
   - `/assets/globe-widget.js`

The snippet loads D3 and TopoJSON from jsDelivr. If you prefer to avoid CDN dependencies, host `d3.min.js` and `topojson-client.min.js` too, then replace those script URLs.

## Notes

The widget is scoped under `.wf-globe-widget`, so it should not interfere with the rest of your Webflow site. The JavaScript initializes every element with `data-globe-widget`, which means the same files can support more than one globe on a page.

The outer `.wf-globe-widget` is the 16px padding wrapper. The inner `.wf-globe-widget__frame` is the bordered, rounded globe space.

You can tune the embedded height from Webflow by setting this custom style on the `.wf-globe-widget` element:

```css
--wf-globe-height: 640px;
```

By default, the widget fills the visible viewport height so it does not leave an empty band below the app. If your Webflow section has fixed headers, sticky bars, or top/bottom padding you want to account for, tune this value:

```css
--wf-globe-viewport-offset: 64px;
```

Override `--wf-globe-height` only if you want a shorter embedded component inside a normal content section.
