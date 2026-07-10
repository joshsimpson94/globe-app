# Webflow Globe Widget

This folder contains the Webflow-ready version of the globe.

## Files

- `embed-snippet.html`: markup to paste into a Webflow Embed element.
- `globe-widget.css`: scoped styles for the widget.
- `globe-widget.js`: scoped initializer and globe behavior.
- `countries-110m.js`: world country topology data.
- `demo.html`: local test page.

## Webflow Setup

1. Host these custom files somewhere public:
   - `globe-widget.css`
   - `globe-widget.js`
   - `countries-110m.js`

2. Paste the contents of `embed-snippet.html` into a Webflow Embed element.

3. Replace these placeholder paths with the hosted URLs:
   - `/assets/globe-widget.css`
   - `/assets/countries-110m.js`
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
