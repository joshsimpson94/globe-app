import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../globe-widget.js', import.meta.url), 'utf8');

// D3 can project a small country at the horizon as a sphere-sized path. Model
// that result here and exercise the real fill rejection and land-grid masking.
// Browser reproduction: overview geometry, pitch -25, yaw -13.04 (Hong Kong)
// and -12.52 (Macao). The unfiltered mask brightened the Atlantic ocean grid.
function draw(features) {
  let currentPath;
  let mask;
  const fills = [];
  const geometry = (object) => object?.geometry || object;
  const context = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    fill() { fills.push(geometry(currentPath)); },
    clip(rule) {
      if (rule === 'evenodd') {
        mask = currentPath.geometries || currentPath.features.map(geometry);
      }
    },
    isPointInPath() {
      const shape = geometry(currentPath);
      return Boolean(shape.coversGlobe || shape.coordinates?.coversGlobe);
    },
  };
  function element() {
    return {
      classList: { toggle() {} },
      setAttribute() {}, insertBefore() {}, appendChild() {},
      getContext: () => context,
      closest: () => element(),
    };
  }
  const root = element();
  root.querySelector = element;
  const window = {
    matchMedia: () => ({ matches: false }),
    features,
    trace(object) { currentPath = object; },
  };
  const document = { readyState: 'loading', addEventListener() {}, createElement: element };
  const bridge = `
    path = window.trace;
    getVisibleCountries = () => ({ type: 'FeatureCollection', features: window.features });
    getRenderGeometrySource = () => ({ key: 'overview' });
    Object.assign(globe, { radius: 200, centerX: 400, centerY: 300 });
    drawWorld();
    return;
  `;
  const instrumented = source
    .replace('    if (!initializeDependencies()) {', bridge + '\n    if (!initializeDependencies()) {')
    .replace('  if (document.readyState === "loading") {', '  window.createWidget = createGlobeWidget;\n  if (document.readyState === "loading") {');
  vm.runInNewContext(instrumented, { window, document });
  window.createWidget(root);
  return { fills, mask: Array.from(mask) };
}

const feature = (geometry) => ({ type: 'Feature', properties: { name: 'Fixture' }, geometry });

test('a rejected horizon polygon cannot turn the ocean into a land-grid mask', () => {
  const land = { type: 'Polygon', coordinates: [] };
  const horizonArtifact = { type: 'Polygon', coordinates: [], coversGlobe: true };
  const { fills, mask } = draw([feature(land), feature(horizonArtifact)]);
  assert.deepEqual(fills, [land]);
  assert.deepEqual(mask, fills, 'grid mask must contain only the shapes actually filled');
});

test('a rejected multipolygon contributes only its successfully drawn polygon parts', () => {
  const goodCoordinates = [];
  const badCoordinates = Object.assign([], { coversGlobe: true });
  const country = feature({
    type: 'MultiPolygon', coversGlobe: true,
    coordinates: [goodCoordinates, badCoordinates],
  });
  const { fills, mask } = draw([country]);
  assert.equal(fills.length, 1);
  assert.equal(fills[0].coordinates, goodCoordinates);
  assert.deepEqual(mask, fills, 'recovered polygon parts must also define the grid mask');
});

test('an entirely rejected country leaves the land-grid mask empty', () => {
  const { fills, mask } = draw([feature({ type: 'Polygon', coordinates: [], coversGlobe: true })]);
  assert.equal(fills.length, 0);
  assert.equal(mask.length, 0);
});
