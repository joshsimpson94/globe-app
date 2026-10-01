import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the shipped page loader and public initializer. Replace only canvas
// construction in memory; these tests concern topology and widget discovery.
const source = readFileSync(new URL('../globe-widget.js', import.meta.url), 'utf8');

function loader({ readyState = 'loading', supplied = {}, urls = {}, fetchResponse } = {}) {
  const roots = [{ dataset: {} }, { dataset: {} }];
  const initialized = [];
  const requests = [];
  const warnings = [];
  const errors = [];
  const listeners = new Map();
  const window = {
    ...supplied,
    ...urls,
    initialized,
    fetch(url) {
      requests.push(url);
      return fetchResponse(url);
    },
  };
  const document = {
    readyState,
    addEventListener(name, callback) { listeners.set(name, callback); },
    querySelectorAll(selector) {
      assert.equal(selector, '[data-globe-widget]');
      return roots;
    },
  };
  const instrumented = source.replace(
    '  function initGlobeWidgets() {',
    '  createGlobeWidget = (root) => window.initialized.push(root);\n  function initGlobeWidgets() {',
  );
  vm.runInNewContext(instrumented, {
    window, document,
    console: { warn(...args) { warnings.push(args); }, error(...args) { errors.push(args); } },
  });
  return { window, roots, initialized, requests, warnings, errors, listeners };
}

const ok = (value) => Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
const fail = (status) => Promise.resolve({ ok: false, status });
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('DOMContentLoaded loads all configured topology tiers before initializing each widget once', async () => {
  const data = {
    detail: { type: 'Topology', tier: 'detail' },
    overview: { type: 'Topology', tier: 'overview' },
    close: { type: 'Topology', tier: 'close' },
  };
  const pending = new Map();
  const { window, roots, initialized, requests, listeners } = loader({
    urls: {
      WORLD_TOPOLOGY_URL: 'detail.json',
      WORLD_TOPOLOGY_OVERVIEW_URL: 'overview.json',
      WORLD_TOPOLOGY_CLOSE_DETAIL_URL: 'close.json',
    },
    fetchResponse: (url) => new Promise((resolve) => pending.set(url, resolve)),
  });
  assert.deepEqual(requests, []);
  assert.deepEqual([...listeners.keys()], ['DOMContentLoaded']);
  assert.equal(typeof window.WebflowGlobeWidget.init, 'function');
  listeners.get('DOMContentLoaded')();
  assert.deepEqual(requests, ['detail.json', 'overview.json', 'close.json']);
  pending.get('overview.json')(await ok(data.overview));
  pending.get('close.json')(await ok(data.close));
  await settle();
  assert.equal(initialized.length, 0, 'the detail tier is required before startup');
  pending.get('detail.json')(await ok(data.detail));
  await settle();
  assert.equal(window.WORLD_TOPOLOGY, data.detail);
  assert.equal(window.WORLD_TOPOLOGY_OVERVIEW, data.overview);
  assert.equal(window.WORLD_TOPOLOGY_CLOSE_DETAIL, data.close);
  assert.deepEqual(initialized, roots);
  assert.deepEqual(roots.map((root) => root.dataset.globeInstance), ['1', '2']);
  window.WebflowGlobeWidget.init();
  assert.equal(initialized.length, 2, 'the public initializer does not recreate existing widgets');
});

test('optional topology failures retain the detailed globe and still initialize widgets', async () => {
  const detail = { type: 'Topology', tier: 'detail' };
  const { window, initialized, warnings, errors } = loader({
    readyState: 'complete',
    urls: {
      WORLD_TOPOLOGY_URL: 'detail.json',
      WORLD_TOPOLOGY_OVERVIEW_URL: 'overview.json',
      WORLD_TOPOLOGY_CLOSE_DETAIL_URL: 'close.json',
    },
    fetchResponse: (url) => url === 'detail.json' ? ok(detail) : fail(404),
  });
  await settle();
  assert.equal(window.WORLD_TOPOLOGY, detail);
  assert.equal(window.WORLD_TOPOLOGY_OVERVIEW, undefined);
  assert.equal(window.WORLD_TOPOLOGY_CLOSE_DETAIL, undefined);
  assert.equal(initialized.length, 2);
  assert.equal(warnings.length, 2);
  assert.equal(errors.length, 0);
});

test('a required topology failure reaches the widget error path', async () => {
  const { window, initialized, requests, errors } = loader({
    readyState: 'complete',
    fetchResponse: () => fail(503),
  });
  await settle();
  assert.deepEqual(requests, ['countries-50m.json']);
  assert.equal(window.WORLD_TOPOLOGY, undefined);
  assert.equal(errors.length, 1);
  assert.match(errors[0][0], /failed to load/);
  assert.equal(initialized.length, 2, 'the loader still initializes widgets to show their error state');
});

test('preloaded topology avoids requests and initializes on an already loaded page', async () => {
  const detail = { type: 'Topology', tier: 'detail' };
  const { initialized, requests, errors } = loader({
    readyState: 'complete',
    supplied: { WORLD_TOPOLOGY: detail },
    fetchResponse: () => { throw new Error('unexpected fetch'); },
  });
  await settle();
  assert.deepEqual(requests, []);
  assert.equal(initialized.length, 2);
  assert.equal(errors.length, 0);
});
