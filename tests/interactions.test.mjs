import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the actual widget closure with a deterministic clock and minimal DOM.
// The test-only bridge is injected in memory; the shipped widget has no test API.
const source = readFileSync(new URL('../globe-widget.js', import.meta.url), 'utf8');
const country = { properties: { name: 'Test country' }, center: [170, 20] };

function harness({ reducedMotion = false, desktopHover = false, startWidget = false, dependenciesAvailable = true, animations = false, hostControlled = false } = {}) {
  let now = 1000;
  let timerId = 0;
  const timers = new Map();
  const frames = new Map();
  let frameId = 0;
  const listeners = [];
  const lifecycle = [];
  const animationLog = [];
  function recordListener(target, type, callback, options) {
    listeners.push({ target, type, callback, options });
    lifecycle.push(`listen:${target}:${type}`);
  }
  function element(name = 'element') {
    const captures = new Set();
    return {
      attributes: {},
      classList: { toggle() {}, remove() {}, contains() { return false; } },
      dataset: {}, style: {}, value: '', hidden: false, clientHeight: 600,
      children: [],
      get innerHTML() {
        return this.children.length
          ? this.children.map((child) => `<button id="${child.id}">${child.textContent}</button>`).join('')
          : this.html || '';
      },
      set innerHTML(value) { this.html = value; this.children = []; },
      replaceChildren(...children) {
        this.children = children;
        for (const child of children) child.parentElement = this;
      },
      getBoundingClientRect() {
        const translate = animationLog.findLast((animation) => animation.element === this && !animation.cancelled)?.current.translate;
        const offset = translate ? parseFloat(translate.split(' ')[1]) : 0;
        return { top: (this.parentElement?.children.indexOf(this) || 0) * 41 + offset };
      },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      insertBefore() {}, appendChild() {},
      addEventListener(type, callback, options) { recordListener(name, type, callback, options); },
      querySelectorAll() {
        if (this.children.length) return this.children;
        return [...(this.innerHTML || '').matchAll(/id="(country-suggestion-[^"]+)"/g)]
          .map((match) => ({ ...element('suggestion'), id: match[1] }));
      }, contains() { return false; },
      focus() { document.activeElement = this; },
      blur() { if (document.activeElement === this) document.activeElement = null; },
      ...(animations ? { animate(keyframes, options) {
        const animation = {
          element: this, keyframes, options, current: keyframes[0], cancelled: false,
          cancel() { this.cancelled = true; },
          finish() { this.onfinish?.(); },
        };
        animationLog.push(animation);
        return animation;
      } } : {}),
      getContext() { return {}; }, closest() { return panel; },
      setPointerCapture(id) { captures.add(id); },
      releasePointerCapture(id) { captures.delete(id); },
      hasPointerCapture(id) { return captures.has(id); },
    };
  }
  const panel = element('panel');
  function makeRoot() {
    const elements = new Map();
    const root = element('root');
    root.querySelector = (selector) => {
      if (!elements.has(selector)) {
        const node = element(selector);
        node.hidden = ['[data-country-search-clear]', '[data-country-suggestions]', '[data-clear-selection]'].includes(selector);
        elements.set(selector, node);
      }
      return elements.get(selector);
    };
    return { root, elements };
  }
  const { root, elements } = makeRoot();
  if (hostControlled) root.dataset.globeActivity = "host";
  const motionQuery = {
    matches: reducedMotion,
    addEventListener(type, callback, options) { recordListener('motionQuery', type, callback, options); },
  };
  const window = {
    lifecycle, dependenciesAvailable,
    parent: { postMessage() {} },
    addEventListener(type, callback, options) { recordListener('window', type, callback, options); },
    matchMedia: (query) => query.includes('reduced-motion') ? motionQuery : { matches: query.includes('hover: hover') && desktopHover },
    getComputedStyle(node) {
      return animationLog.findLast((animation) => animation.element === node && !animation.cancelled)?.current ||
        { opacity: '1', translate: '0px 0px' };
    },
    setTimeout(fn, delay) { timers.set(++timerId, { fn, at: now + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    d3: { geoArea: () => 1, geoCentroid: (feature) => feature.center },
  };
  const document = {
    createElement: element, documentElement: element(), readyState: 'loading', activeElement: null,
    addEventListener(type, callback, options) { recordListener('document', type, callback, options); },
  };
  const bridge = `
    let testRotation = [0, 0], testScale = 1, testTranslation = [0, 0];
    projection = {
      rotate(value) { if (!value) return testRotation; testRotation = value; return this; },
      scale(value) { if (value === undefined) return testScale; testScale = value; return this; },
      translate(value) { if (!value) return testTranslation; testTranslation = value; return this; }
    };
    path = { bounds() { window.fitRotation = testRotation.slice(); return [[0, 0], [100, 100]]; } };
    drawFrame = () => { globe.radius = globe.baseRadius * globe.zoom; };
    getCountryAtPoint = () => window.hitCountry || null;
    window.widget = {
      globe, pointer, frameTouchPointers, canvas, frame,
      render, startAnimation, pauseAnimation, onHostActivity, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
      onFrameTouchPointerDown, onFrameTouchPointerMove, onFrameTouchPointerUp, onFrameTouchPointerCancel,
      onCanvasPointerEnter, onPointerLeave, onDocumentClick,
      enableWheelZoom, disableWheelZoom, onWheel, onWindowBlur, onDocumentKeyDown,
      onCountrySearchInput, onZoomInClick, onZoomOutClick,
      renderSuggestions, closeSuggestions, updateSearchClearButton, onCountrySearchKeyDown,
      clearSearchInput, onUIMotionPreferenceChange,
      selectCountry, clearSelectedCountry, focusOnCountry, zoomBy, setDirectUserZoom,
      get selected() { return selectedCountry; },
      get travel() { return searchTravel; }, get glide() { return releaseGlide; },
      get pendingTap() { return pendingMobileCountryTap; },
      get doubleTap() { return mobileDoubleTapGesture; },
      get wheelEnabled() { return wheelZoomEnabled; },
      get hovered() { return hoveredCountry; }
    };
    ${startWidget ? `
      // Keep real event wiring and initial UI updates; stub geometry and animation.
      initializeDependencies = () => {
        window.lifecycle.push('dependencies');
        return window.dependenciesAvailable;
      };
      resizeCanvas = () => window.lifecycle.push('resize');
      drawFrame = () => window.lifecycle.push('draw');
      startWhenVisible = () => window.lifecycle.push('startWhenVisible');
      const originalUpdateCountryLabel = updateCountryLabel;
      updateCountryLabel = (...args) => {
        window.lifecycle.push('label');
        return originalUpdateCountryLabel(...args);
      };
      const originalUpdateSearchClearButton = updateSearchClearButton;
      updateSearchClearButton = () => {
        window.lifecycle.push('searchClear');
        return originalUpdateSearchClearButton();
      };
      const originalCloseSuggestions = closeSuggestions;
      closeSuggestions = () => {
        window.lifecycle.push('suggestions');
        return originalCloseSuggestions();
      };
    ` : 'return;'}
  `;
  const instrumented = source.replace('    if (!initializeDependencies()) {', bridge + '\n    if (!initializeDependencies()) {')
    .replace('  if (document.readyState === "loading") {', '  window.createWidget = createGlobeWidget;\n  if (document.readyState === "loading") {');
  vm.runInNewContext(instrumented, { window, document, performance: { now: () => now }, requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); }, console });
  listeners.length = 0;
  lifecycle.length = 0;
  window.createWidget(root);
  const widget = window.widget;
  Object.assign(widget.globe, {
    baseRadius: 200, radius: 210, centerX: 400, centerY: 332,
    centralCenterY: 300, restingCenterY: 332,
  });
  function advance(ms, render = false) {
    now += ms;
    for (const [id, timer] of timers) {
      if (timer.at <= now) { timers.delete(id); timer.fn(); }
    }
    if (render) widget.render(now);
  }
  function tick(ms) {
    advance(ms);
    const [id, callback] = frames.entries().next().value;
    frames.delete(id);
    callback(now);
  }
  function event(x = 100, y = 100, extra = {}) {
    return { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0,
      type: 'pointerdown', cancelable: true, prevented: false,
      preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extra };
  }
  function wheel(deltaY, deltaMode = 0, extra = {}) {
    const e = event(0, 0, { deltaY, deltaMode, ...extra });
    widget.onWheel(e);
    return e;
  }
  function drag() {
    widget.onPointerDown(event());
    advance(20); widget.onPointerMove(event(120, 100));
    if (frames.size) tick(0); else advance(0, true);
    advance(20); widget.onPointerMove(event(150, 120));
    tick(0);
    advance(20); widget.onPointerMove(event(190, 140));
    tick(0);
  }
  return { widget, window, advance, tick, event, wheel, drag, listeners, lifecycle, elements, panel, root, makeRoot,
    animationLog, motionQuery, frames, document };
}

function view(widget) {
  const { yaw, pitch, zoom, targetZoom } = widget.globe;
  return { yaw, pitch, zoom, targetZoom };
}

test('suggestions update without replaying entrances and close semantically before their exit ends', () => {
  const { widget: w, elements, animationLog } = harness({ animations: true });
  const suggestions = elements.get('[data-country-suggestions]');
  const input = elements.get('[data-country-search-input]');
  w.renderSuggestions([country]);
  const opening = animationLog.at(-1);
  assert.equal(opening.options.duration, 200);
  const other = { properties: { name: 'Other country' }, center: [10, 10] };
  w.renderSuggestions([other]);
  assert.equal(opening.cancelled, false);
  assert.equal(animationLog.filter((animation) => animation.element === suggestions).length, 1);
  assert.equal(animationLog.at(-1).options.duration, 180);
  assert.match(suggestions.innerHTML, /Other country/);
  w.onCountrySearchKeyDown({ key: 'ArrowDown', preventDefault() {} });
  assert.match(input.attributes['aria-activedescendant'], /country-suggestion/);
  w.onCountrySearchKeyDown({ key: 'Escape' });
  const closing = animationLog.at(-1);
  assert.equal(suggestions.hidden, false);
  assert.equal(suggestions.inert, true);
  assert.equal(suggestions.attributes['aria-hidden'], 'true');
  assert.equal(input.attributes['aria-expanded'], 'false');
  assert.equal(input.attributes['aria-activedescendant'], undefined);
  assert.match(suggestions.innerHTML, /Other country/);
  w.renderSuggestions([country]);
  closing.finish();
  assert.match(suggestions.innerHTML, /Test country/);
  assert.equal(suggestions.inert, false);
  w.onCountrySearchKeyDown({ key: 'ArrowDown', preventDefault() {} });
  w.onCountrySearchKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(w.selected, country);
  assert.equal(input.attributes['aria-expanded'], 'false');
  animationLog.at(-1).finish();
  assert.equal(suggestions.hidden, true);
  assert.equal(suggestions.innerHTML, '');
});

test('search results retain matching rows and ease their movement while new rows fade in', () => {
  const { widget: w, elements, animationLog } = harness({ animations: true });
  const suggestions = elements.get('[data-country-suggestions]');
  const other = { properties: { name: 'Other country' }, center: [10, 10] };
  const third = { properties: { name: 'Third country' }, center: [20, 20] };
  w.renderSuggestions([country, other]);
  animationLog.at(-1).finish();
  const [firstRow, otherRow] = suggestions.children;
  w.renderSuggestions([other, third]);
  assert.equal(suggestions.children[0], otherRow);
  assert.equal(otherRow.dataset.index, '0');
  const move = animationLog.findLast((animation) => animation.element === otherRow);
  assert.equal(move.keyframes[0].translate, '0px 41px');
  assert.equal(move.keyframes[0].opacity, '1');
  const incoming = animationLog.at(-1);
  assert.equal(incoming.keyframes[0].opacity, '0');
  assert.equal(incoming.keyframes[0].translate, '0px 3px');
  assert.ok(!suggestions.children.includes(firstRow));
  const count = animationLog.length;
  w.renderSuggestions([other, third]);
  assert.equal(animationLog.length, count, 'unchanged matches must not replay motion');
  move.current = { opacity: '1', translate: '0px 20px' };
  w.renderSuggestions([third, other]);
  const reversed = animationLog.findLast((animation) => animation.element === otherRow);
  assert.equal(move.cancelled, true);
  assert.equal(reversed.keyframes[0].translate, '0px -21px');
  move.finish();
  assert.equal(reversed.cancelled, false);
  w.onCountrySearchKeyDown({ key: 'ArrowDown', preventDefault() {} });
  w.onCountrySearchKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(w.selected, third, 'keyboard selection uses the current order immediately');
  animationLog.findLast((animation) => animation.element === suggestions).finish();
  assert.equal(reversed.cancelled, true);
  assert.equal(suggestions.innerHTML, '');
});

test('result replacement is immediate with reduced motion or without animation support', () => {
  for (const options of [{ animations: true, reducedMotion: true }, { animations: false }]) {
    const { widget: w, elements, animationLog } = harness(options);
    const other = { properties: { name: 'Other country' }, center: [10, 10] };
    w.renderSuggestions([country]);
    w.renderSuggestions([other]);
    assert.match(elements.get('[data-country-suggestions]').innerHTML, /Other country/);
    assert.equal(animationLog.length, 0);
  }
});

test('country changes fade the label, retain the exiting panel, and reject stale dismissal callbacks', () => {
  const { widget: w, panel, elements, animationLog } = harness({ animations: true });
  const label = elements.get('[data-country-label]');
  w.selectCountry(country);
  const entrance = animationLog.at(-1);
  assert.equal(entrance.element, panel);
  assert.equal(entrance.options.duration, 240);
  entrance.finish();
  const other = { properties: { name: 'Other country' }, center: [0, 0] };
  w.selectCountry(other);
  const textAnimation = animationLog.at(-1);
  assert.equal(textAnimation.element, label);
  assert.equal(textAnimation.options.duration, 140);
  assert.equal(label.textContent, 'Other country');
  w.clearSelectedCountry();
  const closing = animationLog.at(-1);
  assert.equal(w.selected, null);
  assert.equal(panel.inert, true);
  assert.equal(panel.hidden, false);
  assert.equal(label.textContent, 'Other country');
  w.selectCountry(country);
  closing.finish();
  assert.equal(panel.hidden, false);
  assert.equal(panel.inert, false);
  assert.equal(label.textContent, 'Test country');
  w.clearSelectedCountry();
  animationLog.at(-1).finish();
  assert.equal(panel.hidden, true);
  assert.equal(label.textContent, '');
  assert.equal(elements.get('[data-clear-selection]').hidden, true);
});

test('search clear retains focus and cannot be hidden by an interrupted exit', () => {
  const { widget: w, elements, animationLog } = harness({ animations: true });
  const input = elements.get('[data-country-search-input]');
  const clear = elements.get('[data-country-search-clear]');
  input.value = 'Test';
  w.updateSearchClearButton();
  animationLog.at(-1).finish();
  w.clearSearchInput();
  const closing = animationLog.at(-1);
  assert.equal(input.value, '');
  assert.equal(clear.inert, true);
  input.value = 'Other';
  w.updateSearchClearButton();
  closing.finish();
  assert.equal(clear.hidden, false);
  assert.equal(clear.inert, false);
});

test('reduced motion and unavailable animation APIs apply UI changes immediately', () => {
  for (const options of [{ animations: true, reducedMotion: true }, { animations: false }]) {
    const { widget: w, panel, elements, animationLog } = harness(options);
    w.selectCountry(country);
    assert.equal(panel.hidden, false);
    w.clearSelectedCountry();
    assert.equal(panel.hidden, true);
    w.renderSuggestions([country]);
    w.closeSuggestions();
    assert.equal(elements.get('[data-country-suggestions]').hidden, true);
    assert.equal(elements.get('[data-country-suggestions]').innerHTML, '');
    assert.equal(animationLog.length, 0);
  }
});

test('changing reduced motion settles active exits and label updates immediately', () => {
  const { widget: w, panel, animationLog, motionQuery, listeners } = harness({ animations: true, startWidget: true });
  w.selectCountry(country);
  w.selectCountry({ properties: { name: 'Other country' }, center: [0, 0] });
  w.renderSuggestions([country]);
  w.clearSelectedCountry();
  motionQuery.matches = true;
  listeners.find(({ target }) => target === 'motionQuery').callback();
  assert.equal(panel.hidden, true);
  assert.ok(animationLog.every((animation) => animation.cancelled));
  w.selectCountry(country);
  assert.equal(panel.hidden, false);
  assert.equal(panel.inert, false);
});

test('startup checks dependencies, binds events, resets the UI, then draws before animation', () => {
  const { lifecycle, listeners, elements, panel } = harness({ startWidget: true });
  assert.ok(listeners.length > 0);
  assert.deepEqual(lifecycle, [
    'dependencies',
    ...listeners.map(({ target, type }) => `listen:${target}:${type}`),
    'resize', 'label', 'searchClear', 'suggestions', 'draw', 'startWhenVisible',
  ]);
  assert.equal(panel.hidden, true);
  assert.equal(elements.get('[data-country-label]').textContent, '');
  for (const selector of ['[data-clear-selection]', '[data-country-search-clear]', '[data-country-suggestions]']) {
    assert.equal(elements.get(selector).hidden, true);
  }
});

test('each widget connects its search input to its own suggestions', () => {
  const { window, elements, makeRoot } = harness({ startWidget: true });
  const firstInput = elements.get('[data-country-search-input]');
  const firstSuggestions = elements.get('[data-country-suggestions]');
  const { root: secondRoot, elements: secondElements } = makeRoot();
  window.createWidget(secondRoot);
  const secondInput = secondElements.get('[data-country-search-input]');
  const secondSuggestions = secondElements.get('[data-country-suggestions]');
  assert.equal(firstInput.attributes['aria-controls'], firstSuggestions.id);
  assert.equal(secondInput.attributes['aria-controls'], secondSuggestions.id);
  assert.ok(firstSuggestions.id);
  assert.notEqual(firstSuggestions.id, secondSuggestions.id);
});

test('failed dependency setup does not bind events, draw, or start animation', () => {
  const { lifecycle, listeners } = harness({ startWidget: true, dependenciesAvailable: false });
  assert.deepEqual(lifecycle, ['dependencies']);
  assert.deepEqual(listeners, []);
});

test('event wiring preserves gesture capture order, cancellable wheel input, and zoom controls', () => {
  const { widget: w, listeners, event } = harness({ startWidget: true });
  function listener(target, type) {
    const matches = listeners.filter((entry) => entry.target === target && entry.type === type);
    assert.equal(matches.length, 1, `${target} ${type} should be bound once`);
    return matches[0];
  }
  for (const [type, frameHandler, canvasHandler] of [
    ['pointerdown', w.onFrameTouchPointerDown, w.onPointerDown],
    ['pointermove', w.onFrameTouchPointerMove, w.onPointerMove],
    ['pointerup', w.onFrameTouchPointerUp, w.onPointerUp],
    ['pointercancel', w.onFrameTouchPointerCancel, w.onPointerCancel],
  ]) {
    const frame = listener('.wf-globe-widget__frame', type);
    const canvas = listener('[data-globe-canvas]', type);
    assert.equal(frame.callback, frameHandler);
    assert.equal(frame.options.capture, true);
    assert.equal(frame.options.passive, false);
    assert.equal(canvas.callback, canvasHandler);
    assert.equal(canvas.options, undefined);
    assert.ok(listeners.indexOf(frame) < listeners.indexOf(canvas));
  }
  for (const type of ['touchstart', 'touchmove']) {
    const touch = listener('document', type);
    assert.equal(touch.options.capture, true);
    assert.equal(touch.options.passive, false);
  }
  assert.equal(listener('.wf-globe-widget__frame', 'click').options, true);
  const wheel = listener('[data-globe-canvas]', 'wheel');
  assert.equal(wheel.callback, w.onWheel);
  assert.equal(wheel.options.passive, false);
  const beforeEntry = event(0, 0, { deltaY: -20, deltaMode: 0 });
  wheel.callback(beforeEntry);
  assert.equal(beforeEntry.prevented, false);

  listener('[data-globe-canvas]', 'pointerenter').callback();
  const afterEntry = event(0, 0, { deltaY: -20, deltaMode: 0 });
  wheel.callback(afterEntry);
  assert.equal(afterEntry.prevented, true);

  const initialZoom = w.globe.targetZoom;
  listener('[data-zoom-in]', 'click').callback();
  assert.equal(w.globe.targetZoom, initialZoom * 1.25);
  const zoomBeforeOut = w.globe.targetZoom;
  listener('[data-zoom-out]', 'click').callback();
  assert.equal(w.globe.targetZoom, zoomBeforeOut / 1.25);
});

test('registered resize and blur callbacks retain their startup behaviour', () => {
  const { widget: w, listeners, lifecycle } = harness({ startWidget: true });
  lifecycle.length = 0;
  listeners.find(({ target, type }) => target === 'window' && type === 'resize').callback();
  assert.deepEqual(lifecycle, ['resize', 'draw']);
  listeners.find(({ target, type }) => target === '[data-zoom-in]' && type === 'click').callback();
  assert.equal(w.wheelEnabled, true);
  listeners.find(({ target, type }) => target === 'window' && type === 'blur').callback();
  assert.equal(w.wheelEnabled, false);
});

test('country selection zooms in and deselection immediately returns to the saved scale', () => {
  const { widget: w, advance } = harness();
  w.setDirectUserZoom(1.8);
  w.selectCountry(country);
  assert.equal(w.selected, country);
  assert.ok(w.globe.targetZoom > 1.8);
  advance(500, true);
  const closeZoom = w.globe.zoom;
  w.selectCountry(country);
  assert.equal(w.selected, null);
  assert.equal(w.globe.targetZoom, 1.8);
  const yaw = w.globe.yaw;
  advance(16, true);
  assert.ok(w.globe.zoom < closeZoom);
  assert.ok(w.globe.yaw > yaw, 'rotation resumes without an idle pause');
  for (let i = 0; i < 50; i++) advance(16, true);
  assert.ok(Math.abs(w.globe.zoom - 1.8) < 0.001);
});

test('switching countries and interrupting focus preserve the original return scale', () => {
  const { widget: w, advance } = harness();
  w.setDirectUserZoom(1.8);
  w.selectCountry(country); advance(150, true);
  w.focusOnCountry({ properties: { name: 'Another country' }, center: [40, 30] });
  advance(500, true);
  w.zoomBy(1); advance(16, true);
  w.selectCountry(null);
  assert.equal(w.globe.targetZoom, 1.8);
  assert.equal(w.selected, null);
});

test('zoom out uses the same 500 ms easing as focus and stays interruptible', () => {
  const { widget: w, advance, event } = harness();
  w.selectCountry(country); advance(500, true);
  const closeZoom = w.globe.zoom;
  w.clearSelectedCountry();
  assert.equal(w.globe.zoom, closeZoom);
  advance(250, true);
  assert.ok(Math.abs(w.globe.zoom - Math.sqrt(closeZoom * 1.05)) < 1e-9);
  advance(250, true);
  assert.ok(Math.abs(w.globe.zoom - 1.05) < 1e-9);
  w.selectCountry(country); advance(500, true);
  w.clearSelectedCountry(); advance(100, true);
  const interruptedZoom = w.globe.zoom;
  w.onPointerDown(event()); advance(500, true);
  assert.equal(w.globe.zoom, interruptedZoom);
  assert.equal(w.globe.targetZoom, interruptedZoom);
});

test('selection centers the globe and deselection returns it to its resting position', () => {
  const { widget: w, advance } = harness();
  w.selectCountry(country);
  assert.equal(w.globe.centerY, 332);
  advance(250, true);
  assert.equal(w.globe.centerY, 316);
  advance(250, true);
  assert.equal(w.globe.centerY, 300);

  w.clearSelectedCountry();
  advance(250, true);
  assert.equal(w.globe.centerY, 316);
  advance(250, true);
  assert.equal(w.globe.centerY, 332);
});

test('reselecting during the return reverses the center motion smoothly', () => {
  const { widget: w, advance } = harness();
  w.selectCountry(country);
  advance(500, true);
  w.clearSelectedCountry();
  advance(250, true);
  w.selectCountry(country);
  assert.equal(w.globe.centerY, 316);
  advance(250, true);
  assert.equal(w.globe.centerY, 308);
  advance(250, true);
  assert.equal(w.globe.centerY, 300);
});

test('reduced motion also applies the return zoom immediately', () => {
  const { widget: w } = harness({ reducedMotion: true });
  w.selectCountry(country);
  assert.equal(w.globe.centerY, 300);
  w.clearSelectedCountry();
  assert.equal(w.globe.zoom, 1.05);
  assert.equal(w.globe.targetZoom, 1.05);
  assert.equal(w.globe.centerY, 332);
});

test('touch and mouse jitter do not rotate; crossing the threshold consumes only the dead zone', () => {
  for (const [pointerType, threshold] of [['touch', 4], ['mouse', 2]]) {
    const { widget: w, event, advance } = harness();
    const before = view(w);
    w.onPointerDown(event(100, 100, { pointerType }));
    advance(0, true);
    w.onPointerMove(event(100 + threshold, 100, { pointerType }));
    assert.deepEqual(view(w), before);
    advance(16);
    w.onPointerMove(event(100 + threshold + 1, 100, { pointerType }));
    advance(650, true);
    assert.ok(Math.abs(w.globe.yaw - before.yaw - 180 / (Math.PI * 210)) < 1e-9);
  }
});

test('a small touch jitter still selects and begins country focus', () => {
  const { widget: w, window, event, advance } = harness();
  window.hitCountry = country;
  const before = view(w);
  w.onPointerDown(event()); w.onPointerMove(event(102, 101)); w.onPointerUp(event(102, 101));
  assert.ok(w.pendingTap);
  advance(151);
  assert.equal(w.selected, country);
  assert.equal(w.globe.zoom, before.zoom);
  assert.ok(w.globe.targetZoom > before.zoom);
  assert.ok(w.travel);
});

test('a new drag or pinch cancels a pending country tap', () => {
  for (const pinch of [false, true]) {
    const { widget: w, window, event, advance } = harness();
    window.hitCountry = country;
    w.onPointerDown(event()); w.onPointerUp(event());
    advance(30);
    if (pinch) {
      w.onFrameTouchPointerDown(event());
      w.onFrameTouchPointerDown(event(200, 100, { pointerId: 2 }));
    } else {
      w.onPointerDown(event(200, 100));
      w.onPointerMove(event(240, 100));
    }
    advance(200);
    assert.equal(w.selected, null);
    assert.equal(w.pendingTap, null);
  }
});

test('double tap is a 50% step and double-tap drag eases toward the finger in both directions', () => {
  const { widget: w, event, advance } = harness();
  w.onPointerDown(event()); w.onPointerUp(event());
  advance(30); w.onPointerDown(event()); w.onPointerUp(event());
  assert.equal(w.globe.targetZoom, 1.05 * 1.5);
  advance(500, true);
  w.onPointerDown(event()); w.onPointerUp(event());
  advance(30); w.onPointerDown(event());
  const initial = w.globe.zoom;
  w.onPointerMove(event(100, 150));
  assert.ok(Math.abs(w.globe.targetZoom - initial * Math.exp(46 / 200)) < 1e-9);
  assert.equal(w.globe.zoom, initial);
  advance(16, true);
  assert.ok(w.globe.zoom > initial && w.globe.zoom < w.globe.targetZoom);
  const zoomAfterDownwardDrag = w.globe.zoom;
  w.onPointerMove(event(100, 50));
  assert.ok(Math.abs(w.globe.targetZoom - initial * Math.exp(-46 / 200)) < 1e-9);
  assert.equal(w.globe.zoom, zoomAfterDownwardDrag);
  advance(16, true);
  assert.ok(w.globe.zoom < zoomAfterDownwardDrag);
  w.onPointerUp(event(100, 50));
  assert.ok(w.globe.targetZoom < initial);
});

test('mouse and touch drags ease toward their full destination without overshooting', () => {
  for (const pointerType of ['mouse', 'touch']) {
    const { widget: w, event, advance } = harness();
    const input = (x) => event(x, 100, { pointerType });
    w.onPointerDown(input(100));
    advance(0, true);
    const yaw = w.globe.yaw;
    advance(16); w.onPointerMove(input(200));
    assert.equal(w.globe.yaw, yaw, 'events queue movement until the animation frame');
    advance(0, true);
    const destination = yaw + (100 - w.pointer.threshold) * 180 / (Math.PI * 210);
    assert.ok(w.globe.yaw > yaw && w.globe.yaw < destination);
    const firstYaw = w.globe.yaw;
    advance(65, true);
    assert.ok(w.globe.yaw > firstYaw && w.globe.yaw < destination);
    advance(600, true);
    assert.ok(Math.abs(w.globe.yaw - destination) < 1e-9);
    w.onPointerMove(input(150));
    advance(16, true);
    assert.ok(w.globe.yaw < destination, 'reversing the pointer reverses rotation');
  }
});

test('drag easing depends on elapsed time and total input rather than event or display frequency', () => {
  function rotate(frameDuration, splitInput) {
    const { widget: w, event, advance } = harness();
    w.onPointerDown(event());
    advance(0, true);
    if (splitInput) {
      for (let x = 110; x <= 200; x += 10) w.onPointerMove(event(x, 100));
    } else {
      w.onPointerMove(event(200, 100));
    }
    for (let elapsed = 0; elapsed < 160; elapsed += frameDuration) advance(frameDuration, true);
    return w.globe.yaw;
  }
  const expected = rotate(16, false);
  assert.ok(Math.abs(rotate(8, false) - expected) < 1e-9);
  assert.ok(Math.abs(rotate(16, true) - expected) < 1e-9);
});

test('new contact, pinch, cancellation, and blur discard pending drag movement', () => {
  for (const action of ['touch', 'pinch', 'frame-pinch', 'cancel', 'blur']) {
    const { widget: w, event, advance } = harness();
    w.onPointerDown(event());
    w.onPointerMove(event(200, 150));
    if (action === 'touch') {
      w.onPointerUp(event(200, 150));
      w.onPointerDown(event(200, 150));
    }
    if (action === 'pinch') w.onPointerDown(event(250, 150, { pointerId: 2 }));
    if (action === 'frame-pinch') {
      w.onFrameTouchPointerDown(event());
      w.onFrameTouchPointerDown(event(250, 150, { pointerId: 2 }));
    }
    if (action === 'cancel') w.onPointerCancel(event(200, 150));
    if (action === 'blur') w.onWindowBlur();
    const before = view(w);
    advance(100, true);
    assert.deepEqual(view(w), before, action);
  }
});

test('reduced-motion dragging applies input directly', () => {
  const { widget: w, event } = harness({ reducedMotion: true });
  w.onPointerDown(event());
  const yaw = w.globe.yaw;
  w.onPointerMove(event(200, 100));
  assert.ok(Math.abs(w.globe.yaw - yaw - 96 * 180 / (Math.PI * 210)) < 1e-9);
});

test('release glide carries a flick, decays continuously, and resumes automatic rotation', () => {
  const { widget: w, event, advance, drag } = harness();
  drag(); w.onPointerUp(event(190, 140));
  assert.ok(w.glide);
  assert.ok(Math.hypot(w.glide.x, w.glide.y) <= 0.9);
  const before = view(w);
  advance(90, true);
  const firstMovement = Math.abs(w.globe.pitch - before.pitch);
  const middlePitch = w.globe.pitch;
  advance(90, true);
  const secondMovement = Math.abs(w.globe.pitch - middlePitch);
  assert.ok(firstMovement > secondMovement && secondMovement > 0);
  assert.ok(w.globe.velocityX > 0);
  advance(220, true);
  assert.ok(Math.abs(w.globe.pitch - before.pitch) > 10);
  advance(1000, true);
  assert.equal(w.glide, null);
});

test('release speed uses input timestamps when event handling is delayed', () => {
  const { widget: w, event, advance } = harness();
  w.onPointerDown(event(100, 100, { timeStamp: 1000 }));
  advance(120); w.onPointerMove(event(120, 100, { timeStamp: 1016 }));
  advance(120); w.onPointerMove(event(140, 100, { timeStamp: 1032 }));
  advance(120); w.onPointerUp(event(140, 100, { timeStamp: 1048 }));
  assert.ok(w.glide);
  assert.ok(Math.hypot(w.glide.x, w.glide.y) <= 0.9);
});

test('holding still, cancellation, and touching again suppress the release glide', () => {
  for (const action of ['hold', 'cancel', 'touch', 'blur']) {
    const { widget: w, event, advance, drag } = harness();
    drag();
    if (action === 'hold') advance(100);
    if (action === 'cancel') w.onPointerCancel(event(190, 140));
    else w.onPointerUp(event(190, 140));
    if (action === 'touch') w.onPointerDown(event(190, 140));
    if (action === 'blur') w.onWindowBlur();
    assert.equal(w.glide, null);
    const before = view(w);
    advance(300, true);
    if (action === 'hold') {
      assert.ok(w.globe.pitch < before.pitch, 'a held drag can finish settling without a flick');
    } else {
      assert.deepEqual(view(w), before);
    }
  }
});

test('mouse hover highlights countries and the first click selects one', () => {
  const { widget: w, window, event, advance } = harness({ desktopHover: true });
  window.hitCountry = country;
  w.onPointerMove(event(100, 100, { pointerType: 'mouse' }));
  assert.equal(w.hovered, country);
  w.onPointerDown(event(100, 100, { pointerType: 'mouse' }));
  w.onPointerUp(event(100, 100, { pointerType: 'mouse' }));
  advance(151);
  assert.equal(w.selected, country);
});

test('the first touch tap selects a country and the first drag rotates the globe', () => {
  const { widget: w, window, event, advance, drag } = harness();
  window.hitCountry = country;
  w.onPointerDown(event());
  w.onPointerUp(event());
  advance(151);
  assert.equal(w.selected, country);
  w.onWindowBlur();
  const yaw = w.globe.yaw;
  drag();
  assert.notEqual(w.globe.yaw, yaw);
  w.onPointerUp(event(190, 140));
});

test('search and zoom buttons perform their first action immediately', () => {
  for (const action of ['search', 'zoom-in', 'zoom-out']) {
    const { widget: w } = harness();
    if (action === 'search') w.onCountrySearchInput();
    if (action === 'zoom-in') w.onZoomInClick();
    if (action === 'zoom-out') w.onZoomOutClick();
    if (action === 'zoom-in') assert.ok(w.globe.targetZoom > 1.05);
    if (action === 'zoom-out') assert.ok(w.globe.targetZoom < 1.05);
  }
});

test('canvas entry, exit, Escape, and blur control wheel zoom', () => {
  const { widget: w, wheel } = harness();
  assert.equal(wheel(-100).prevented, false);
  assert.equal(w.globe.targetZoom, 1.05);
  w.onCanvasPointerEnter();
  assert.equal(wheel(-100).prevented, true);
  assert.ok(w.globe.targetZoom > 1.05);
  w.disableWheelZoom(); assert.equal(wheel(-100).prevented, false);
  w.onCanvasPointerEnter(); w.onDocumentKeyDown({ key: 'Escape' }); assert.equal(w.wheelEnabled, false);
  w.onCanvasPointerEnter(); w.onWindowBlur(); assert.equal(w.wheelEnabled, false);
});

test('wheel magnitude and units agree; zero vertical input is ignored', () => {
  const results = [];
  for (const [delta, mode] of [[-16, 0], [-1, 1], [-16 / 600, 2]]) {
    const { widget: w, wheel } = harness();
    w.enableWheelZoom(); wheel(delta, mode); results.push(w.globe.targetZoom);
    const before = view(w);
    assert.equal(wheel(0).prevented, false);
    assert.deepEqual(view(w), before);
  }
  assert.ok(results.every((zoom) => Math.abs(zoom - results[0]) < 1e-9));
  const { widget: w, wheel } = harness();
  w.enableWheelZoom(); wheel(-1);
  assert.ok(w.globe.targetZoom < results[0]);
});

test('wheel bursts allow fast deliberate zoom while bounding queued movement and reversing immediately', () => {
  const { widget: w, wheel } = harness();
  w.enableWheelZoom();
  for (let i = 0; i < 100; i++) wheel(-1000);
  assert.ok(w.globe.targetZoom <= w.globe.zoom * 2);
  wheel(1);
  assert.ok(w.globe.targetZoom < w.globe.zoom);
  for (let i = 0; i < 100; i++) wheel(1000);
  assert.ok(w.globe.targetZoom >= w.globe.zoom / 2);
});

test('trackpad pinch normalizes small deltas to wheel strength and shares its easing', () => {
  for (const delta of [-25, 25]) {
    const pinch = harness();
    const scroll = harness();
    pinch.widget.enableWheelZoom();
    scroll.widget.enableWheelZoom();
    assert.equal(pinch.wheel(delta, 0, { ctrlKey: true }).prevented, true);
    scroll.wheel(delta * 4);
    assert.equal(pinch.widget.globe.targetZoom, scroll.widget.globe.targetZoom);
    for (const elapsed of [1000 / 60, 1000 / 120, 1000 / 30]) {
      pinch.advance(elapsed, true);
      scroll.advance(elapsed, true);
      assert.equal(pinch.widget.globe.zoom, scroll.widget.globe.zoom);
    }
  }
});

test('trackpad pinch matches touch scale and button steps while retaining bounds and reversal', () => {
  const pinch = harness();
  const touch = harness();
  const button = harness();
  pinch.widget.enableWheelZoom();
  pinch.wheel(-Math.log(1.25) / 0.008, 0, { ctrlKey: true });
  touch.widget.onPointerDown(touch.event());
  touch.widget.onPointerDown(touch.event(200, 100, { pointerId: 2 }));
  touch.widget.onPointerMove(touch.event(225, 100, { pointerId: 2 }));
  button.widget.onZoomInClick();
  assert.ok(Math.abs(pinch.widget.globe.targetZoom - touch.widget.globe.targetZoom) < 1e-9);
  assert.ok(Math.abs(pinch.widget.globe.targetZoom - button.widget.globe.targetZoom) < 1e-9);

  const w = pinch.widget;
  w.globe.zoom = w.globe.targetZoom = 4;
  pinch.wheel(-1000, 0, { ctrlKey: true });
  assert.equal(w.globe.targetZoom, 5);
  for (let i = 0; i < 100; i++) pinch.wheel(-1000, 0, { ctrlKey: true });
  assert.equal(w.globe.targetZoom, w.globe.zoom * 2);
  pinch.wheel(1, 0, { ctrlKey: true });
  assert.ok(w.globe.targetZoom < w.globe.zoom);
  for (let i = 0; i < 100; i++) pinch.wheel(1000, 0, { ctrlKey: true });
  assert.equal(w.globe.targetZoom, w.globe.zoom / 2);
  w.setDirectUserZoom(w.globe.maxZoom);
  pinch.wheel(-1000, 0, { ctrlKey: true });
  assert.equal(w.globe.targetZoom, w.globe.maxZoom);
  w.setDirectUserZoom(w.globe.minZoom);
  pinch.wheel(1000, 0, { ctrlKey: true });
  assert.equal(w.globe.targetZoom, w.globe.minZoom);
});

test('pinch starts at displayed zoom, eases toward separation, and resets when fingers change', () => {
  const { widget: w, event, advance } = harness();
  w.globe.targetZoom = 8;
  w.onFrameTouchPointerDown(event());
  w.onFrameTouchPointerDown(event(200, 100, { pointerId: 2 }));
  w.onFrameTouchPointerMove(event(300, 100, { pointerId: 2 }));
  assert.equal(w.globe.zoom, 1.05);
  assert.equal(w.globe.targetZoom, 2.1);
  w.onFrameTouchPointerDown(event(400, 100, { pointerId: 3 }));
  w.onFrameTouchPointerUp(event(100, 100));
  const before = view(w);
  w.onFrameTouchPointerMove(event(300, 100, { pointerId: 2 }));
  assert.deepEqual(view(w), before);
  w.onFrameTouchPointerUp(event(400, 100, { pointerId: 3 }));
  assert.deepEqual(view(w), before);
  w.onFrameTouchPointerMove(event(350, 100, { pointerId: 2 }));
  w.onPointerMove(event(350, 100, { pointerId: 2 }));
  advance(1000 / 60, true);
  assert.ok(w.globe.yaw > before.yaw);
  assert.equal(w.globe.zoom, before.zoom);
  w.onFrameTouchPointerCancel(event(350, 100, { pointerId: 2, type: 'pointercancel' }));
  w.onPointerCancel(event(350, 100, { pointerId: 2 }));
  assert.equal(w.frameTouchPointers.size, 0);
  assert.equal(w.glide, null);
});

test('frame and canvas pinch use the same easing as wheel zoom and settle after release', () => {
  for (const frame of [false, true]) {
    const { widget: w, event, advance } = harness();
    const wheelInput = harness();
    const down = frame ? w.onFrameTouchPointerDown : w.onPointerDown;
    const move = frame ? w.onFrameTouchPointerMove : w.onPointerMove;
    const up = frame ? w.onFrameTouchPointerUp : w.onPointerUp;
    down(event());
    down(event(200, 100, { pointerId: 2 }));
    move(event(220, 100, { pointerId: 2 }));
    wheelInput.widget.enableWheelZoom();
    wheelInput.wheel(-Math.log(1.2) / 0.002);
    assert.equal(w.globe.zoom, 1.05);
    assert.ok(Math.abs(w.globe.targetZoom - wheelInput.widget.globe.targetZoom) < 1e-9);
    for (const elapsed of [1000 / 60, 1000 / 120, 1000 / 30]) {
      advance(elapsed, true);
      wheelInput.advance(elapsed, true);
      assert.ok(Math.abs(w.globe.zoom - wheelInput.widget.globe.zoom) < 1e-9);
      assert.ok(w.globe.zoom > 1.05 && w.globe.zoom < w.globe.targetZoom);
    }
    const releasedZoom = w.globe.zoom;
    const target = w.globe.targetZoom;
    up(event(220, 100, { pointerId: 2, type: 'pointerup' }));
    up(event(100, 100, { type: 'pointerup' }));
    assert.equal(w.globe.zoom, releasedZoom);
    assert.equal(w.globe.targetZoom, target);
    for (let i = 0; i < 60; i++) advance(1000 / 60, true);
    assert.ok(Math.abs(w.globe.zoom - target) < 0.001);
    assert.equal(w.glide, null);
  }
});

test('frame and canvas pinch bound queued zoom and reverse from the displayed scale', () => {
  for (const frame of [false, true]) {
    const { widget: w, event, advance } = harness();
    const down = frame ? w.onFrameTouchPointerDown : w.onPointerDown;
    const move = frame ? w.onFrameTouchPointerMove : w.onPointerMove;
    w.globe.zoom = w.globe.targetZoom = 4;
    down(event());
    down(event(200, 100, { pointerId: 2 }));
    move(event(1100, 100, { pointerId: 2 }));
    assert.equal(w.globe.targetZoom, 8);
    advance(1000 / 60, true);
    const displayedZoom = w.globe.zoom;
    move(event(1000, 100, { pointerId: 2 }));
    assert.ok(w.globe.targetZoom < displayedZoom);
    advance(1000 / 60, true);
    assert.ok(w.globe.zoom < displayedZoom);
    move(event(101, 100, { pointerId: 2 }));
    assert.equal(w.globe.targetZoom, w.globe.zoom / 2);
    move(event(102, 100, { pointerId: 2 }));
    assert.ok(w.globe.targetZoom > w.globe.zoom);
  }
});

test('pinch respects zoom limits, recovers from coincident fingers, and keeps reduced motion immediate', () => {
  for (const reducedMotion of [false, true]) {
    for (const frame of [false, true]) {
      const { widget: w, event } = harness({ reducedMotion });
      const down = frame ? w.onFrameTouchPointerDown : w.onPointerDown;
      const move = frame ? w.onFrameTouchPointerMove : w.onPointerMove;
      w.globe.zoom = w.globe.targetZoom = w.globe.maxZoom;
      down(event());
      down(event(200, 100, { pointerId: 2 }));
      move(event(300, 100, { pointerId: 2 }));
      assert.equal(w.globe.targetZoom, w.globe.maxZoom);
      move(event(280, 100, { pointerId: 2 }));
      assert.ok(w.globe.targetZoom < w.globe.maxZoom);
      if (reducedMotion) assert.equal(w.globe.zoom, w.globe.targetZoom);
      else assert.equal(w.globe.zoom, w.globe.maxZoom);

      w.globe.zoom = w.globe.targetZoom = w.globe.minZoom;
      move(event(110, 100, { pointerId: 2 }));
      assert.equal(w.globe.targetZoom, w.globe.minZoom);
      move(event(120, 100, { pointerId: 2 }));
      assert.ok(w.globe.targetZoom > w.globe.minZoom);
      move(event(100, 100, { pointerId: 2 }));
      const before = view(w);
      move(event(110, 100, { pointerId: 2 }));
      assert.deepEqual(view(w), before);
      move(event(120, 100, { pointerId: 2 }));
      assert.ok(Number.isFinite(w.globe.targetZoom));
      assert.ok(w.globe.targetZoom > before.zoom);
      if (reducedMotion) assert.equal(w.globe.zoom, w.globe.targetZoom);
    }
  }
});

test('zoom buttons take reciprocal 25% steps and all zoom paths respect limits', () => {
  const { widget: w, wheel } = harness();
  w.zoomBy(1); assert.equal(w.globe.targetZoom, 1.3125);
  w.zoomBy(-1); assert.equal(w.globe.targetZoom, 1.05);
  w.setDirectUserZoom(1000); assert.equal(w.globe.zoom, 20);
  wheel(-100); assert.equal(w.globe.targetZoom, 20);
  w.setDirectUserZoom(0.001); assert.equal(w.globe.zoom, 0.75);
  w.zoomBy(-1); assert.equal(w.globe.targetZoom, 0.75);
});

test('search fits at destination, follows the shortest path, and arrives gently in 500 ms', () => {
  const { widget: w, window, advance } = harness();
  w.globe.yaw = 170;
  w.focusOnCountry(country);
  assert.deepEqual(Array.from(window.fitRotation), [-170, -20]);
  assert.equal(w.globe.yaw, 170);
  assert.equal(w.travel.deltaYaw, 20);
  advance(250, true);
  assert.equal(w.globe.yaw, 180);
  assert.ok(w.globe.zoom > 1.05 && w.globe.zoom < w.globe.targetZoom);
  advance(250, true);
  assert.equal(w.travel, null);
  assert.equal(w.globe.yaw, 190);
  assert.equal(w.globe.pitch, -20);
  assert.equal(w.globe.zoom, w.globe.targetZoom);
});

test('drag, pinch, wheel, and buttons interrupt search at its displayed position', () => {
  for (const action of ['drag', 'pinch', 'wheel', 'button']) {
    const { widget: w, event, advance, wheel } = harness();
    w.focusOnCountry(country); advance(150, true);
    const before = view(w);
    if (action === 'drag') w.onPointerDown(event());
    if (action === 'pinch') {
      w.onFrameTouchPointerDown(event());
      w.onFrameTouchPointerDown(event(200, 100, { pointerId: 2 }));
    }
    if (action === 'wheel') wheel(-1);
    if (action === 'button') w.zoomBy(1);
    assert.equal(w.travel, null);
    assert.equal(w.globe.yaw, before.yaw);
    assert.equal(w.globe.zoom, before.zoom);
    assert.ok(w.globe.targetZoom <= before.zoom * 1.25 + 1e-9);
  }
});

test('reduced motion search applies the destination immediately', () => {
  const { widget: w } = harness({ reducedMotion: true });
  w.focusOnCountry(country);
  assert.equal(w.travel, null);
  assert.equal(w.globe.yaw, -170);
  assert.equal(w.globe.pitch, -20);
  assert.equal(w.globe.zoom, w.globe.targetZoom);
});


test('host-controlled animation validates messages, preserves state and owns one loop', () => {
  const { widget: w, window, frames, document, tick } = harness({ hostControlled: true });
  const message = (data, source = window.parent) => w.onHostActivity({ source, data });
  w.startAnimation();
  assert.equal(frames.size, 0);
  message({ type: 'portfolio-sample-activity', active: true }, {});
  message({ type: 'portfolio-sample-activity', active: 'true' });
  assert.equal(frames.size, 0);
  message({ type: 'portfolio-sample-activity', active: true });
  message({ type: 'portfolio-sample-activity', active: true });
  assert.equal(frames.size, 1);
  w.selectCountry(country);
  const before = view(w);
  message({ type: 'portfolio-sample-activity', active: false });
  assert.equal(frames.size, 1);
  assert.deepEqual(view(w), before);
  assert.equal(w.selected, country);
  tick(500);
  assert.equal(w.travel, null);
  assert.equal(frames.size, 0);
  document.hidden = true;
  message({ type: 'portfolio-sample-activity', active: true });
  assert.equal(frames.size, 0);
  document.hidden = false;
  message({ type: 'portfolio-sample-activity', active: true });
  assert.equal(frames.size, 1);
});

test('a hidden host-controlled globe pauses immediately and excludes paused time from country travel', () => {
  const { widget: w, window, advance, document } = harness({ hostControlled: true });
  const active = (value) => w.onHostActivity({ source: window.parent, data: { type: 'portfolio-sample-activity', active: value } });
  active(true);
  w.selectCountry(country);
  advance(100, true);
  const before = view(w);
  document.hidden = true;
  active(false);
  advance(60000);
  document.hidden = false;
  active(true);
  w.render(61100);
  assert.deepEqual(view(w), before);
  advance(100, true);
  assert.notDeepEqual(view(w), before);
});

test('host deactivation waits for zoom easing and zoom return to finish', () => {
  for (const returning of [false, true]) {
    const { widget: w, window, frames, tick } = harness({ hostControlled: true });
    const active = (value) => w.onHostActivity({ source: window.parent, data: { type: 'portfolio-sample-activity', active: value } });
    active(true);
    if (returning) {
      w.selectCountry(country);
      tick(500);
      w.clearSelectedCountry();
    } else {
      w.zoomBy(1);
    }
    active(false);
    assert.equal(frames.size, 1);
    for (let i = 0; i < 60 && frames.size; i++) tick(16);
    assert.equal(frames.size, 0);
    assert.ok(Math.abs(w.globe.zoom - w.globe.targetZoom) < 0.001);
  }
});

test('host deactivation pauses immediately when the camera has no pending movement', () => {
  const { widget: w, window, frames, root } = harness({ hostControlled: true });
  const active = (value) => w.onHostActivity({ source: window.parent, data: { type: 'portfolio-sample-activity', active: value } });
  active(true);
  assert.equal(frames.size, 1);
  active(false);
  assert.equal(frames.size, 0);
  assert.equal(root.dataset.globeAnimation, 'paused');
});

test('host deactivation finishes release glide and a quick reactivation keeps one loop', () => {
  const { widget: w, window, frames, tick, event, drag, root } = harness({ hostControlled: true });
  const active = (value) => w.onHostActivity({ source: window.parent, data: { type: 'portfolio-sample-activity', active: value } });
  active(true);
  drag();
  w.onPointerUp(event(190, 140));
  assert.ok(w.glide);
  active(false);
  assert.equal(frames.size, 1);
  tick(100);
  assert.ok(w.glide);
  active(true);
  assert.equal(frames.size, 1);
  active(false);
  tick(1200);
  assert.equal(w.glide, null);
  assert.equal(frames.size, 0);
  assert.equal(root.dataset.globeAnimation, 'paused');
});

test('host deactivation lets a slow drag settle even without release glide', () => {
  const { widget: w, window, frames, event, advance, tick, root } = harness({ hostControlled: true });
  w.onHostActivity({ source: window.parent, data: { type: 'portfolio-sample-activity', active: true } });
  w.onPointerDown(event());
  w.onPointerMove(event(200, 150));
  advance(100);
  w.onPointerUp(event(200, 150));
  assert.equal(w.glide, null);
  w.onHostActivity({ source: window.parent, data: { type: 'portfolio-sample-activity', active: false } });
  assert.equal(frames.size, 1);
  const pitch = w.globe.pitch;
  tick(16);
  assert.ok(w.globe.pitch < pitch);
  assert.equal(frames.size, 1);
  tick(1000);
  assert.equal(frames.size, 0);
  assert.equal(root.dataset.globeAnimation, 'paused');
});

test('standalone globes ignore host activity messages', () => {
  const { widget: w, window, frames } = harness();
  w.startAnimation();
  assert.equal(frames.size, 1);
  w.onHostActivity({ source: window.parent, data: { type: 'portfolio-sample-activity', active: false } });
  assert.equal(frames.size, 1);
});
