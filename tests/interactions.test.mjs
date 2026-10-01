import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the actual widget closure with a deterministic clock and minimal DOM.
// The test-only bridge is injected in memory; the shipped widget has no test API.
const source = readFileSync(new URL('../globe-widget.js', import.meta.url), 'utf8');
const country = { properties: { name: 'Test country' }, center: [170, 20] };

function harness({ reducedMotion = false, activated = true, startWidget = false, dependenciesAvailable = true, animations = false } = {}) {
  let now = 1000;
  let timerId = 0;
  const timers = new Map();
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
  const motionQuery = {
    matches: reducedMotion,
    addEventListener(type, callback, options) { recordListener('motionQuery', type, callback, options); },
  };
  const window = {
    lifecycle, dependenciesAvailable,
    addEventListener(type, callback, options) { recordListener('window', type, callback, options); },
    matchMedia: (query) => query.includes('reduced-motion') ? motionQuery : { matches: false },
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
      globe, pointer, frameTouchPointers, canvas, frame, interactionHint,
      render, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
      onFrameTouchPointerDown, onFrameTouchPointerMove, onFrameTouchPointerUp, onFrameTouchPointerCancel,
      onAreaPointerEnter, onRootPointerDown, onCanvasPointerEnter, onPointerLeave,
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
      get activated() { return hasActivatedGlobe; },
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
  vm.runInNewContext(instrumented, { window, document, performance: { now: () => now }, requestAnimationFrame() {}, console });
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
  function event(x = 100, y = 100, extra = {}) {
    return { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0,
      type: 'pointerdown', cancelable: true, prevented: false,
      preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extra };
  }
  function wheel(deltaY, deltaMode = 0) {
    const e = event(0, 0, { deltaY, deltaMode });
    widget.onWheel(e);
    return e;
  }
  function drag() {
    widget.onPointerDown(event());
    advance(20); widget.onPointerMove(event(120, 100));
    advance(20); widget.onPointerMove(event(150, 120));
    advance(20); widget.onPointerMove(event(190, 140));
  }
  if (activated) {
    widget.onPointerDown(event());
    widget.onPointerUp(event());
    widget.disableWheelZoom();
  }
  return { widget, window, advance, event, wheel, drag, listeners, lifecycle, elements, panel, makeRoot,
    animationLog, motionQuery };
}

function view(widget) {
  const { yaw, pitch, zoom, targetZoom } = widget.globe;
  return { yaw, pitch, zoom, targetZoom };
}

test('hint motion survives repeated pointer movement and reverses from its current position', () => {
  const { widget: w, animationLog, event } = harness({ animations: true, activated: false });
  const hover = event(100, 100, { pointerType: 'mouse' });
  w.onAreaPointerEnter(hover);
  const opening = animationLog.at(-1);
  assert.equal(opening.options.duration, 220);
  w.onAreaPointerEnter(hover);
  assert.equal(animationLog.length, 1);
  opening.current = { opacity: '0.4', translate: '0px 1.8px' };
  w.disableWheelZoom();
  const closing = animationLog.at(-1);
  assert.equal(opening.cancelled, true);
  assert.equal(closing.keyframes[0].opacity, '0.4');
  assert.equal(closing.keyframes[0].translate, '0px 1.8px');
  assert.equal(w.interactionHint.hidden, false);
  assert.equal(w.interactionHint.inert, true);
  assert.equal(w.interactionHint.attributes['aria-hidden'], 'true');
  closing.current = { opacity: '0.2', translate: '0px 2.4px' };
  w.onAreaPointerEnter(hover);
  const reopened = animationLog.at(-1);
  assert.equal(reopened.keyframes[0].opacity, '0.2');
  closing.finish();
  opening.finish();
  assert.equal(w.interactionHint.hidden, false);
  assert.equal(w.interactionHint.inert, false);
  reopened.finish();
  w.onPointerDown(event());
  w.onPointerUp(event());
  assert.equal(w.activated, true);
  assert.equal(w.selected, null);
  animationLog.at(-1).finish();
  assert.equal(w.interactionHint.hidden, true);
});

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
  const { lifecycle, listeners, elements, panel } = harness({ startWidget: true, activated: false });
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
  const { window, elements, makeRoot } = harness({ startWidget: true, activated: false });
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
  const { lifecycle, listeners } = harness({ startWidget: true, activated: false, dependenciesAvailable: false });
  assert.deepEqual(lifecycle, ['dependencies']);
  assert.deepEqual(listeners, []);
});

test('event wiring preserves gesture capture order, cancellable wheel input, and zoom controls', () => {
  const { widget: w, listeners, event } = harness({ startWidget: true, activated: false });
  function listener(target, type) {
    const matches = listeners.filter((entry) => entry.target === target && entry.type === type);
    assert.equal(matches.length, 1, `${target} ${type} should be bound once`);
    return matches[0];
  }
  const rootDown = listener('root', 'pointerdown');
  assert.equal(rootDown.callback, w.onRootPointerDown);
  assert.equal(rootDown.options.capture, true);
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
    assert.ok(listeners.indexOf(rootDown) < listeners.indexOf(frame));
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
  const beforeActivation = event(0, 0, { deltaY: -20, deltaMode: 0 });
  wheel.callback(beforeActivation);
  assert.equal(beforeActivation.prevented, false);

  const initialZoom = w.globe.targetZoom;
  listener('[data-zoom-in]', 'click').callback();
  assert.equal(w.activated, true);
  assert.equal(w.globe.targetZoom, initialZoom * 1.25);
  const afterActivation = event(0, 0, { deltaY: -20, deltaMode: 0 });
  wheel.callback(afterActivation);
  assert.equal(afterActivation.prevented, true);
  const zoomBeforeOut = w.globe.targetZoom;
  listener('[data-zoom-out]', 'click').callback();
  assert.equal(w.globe.targetZoom, zoomBeforeOut / 1.25);
});

test('registered resize and blur callbacks retain their startup behaviour', () => {
  const { widget: w, listeners, lifecycle } = harness({ startWidget: true, activated: false });
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
    w.onPointerMove(event(100 + threshold, 100, { pointerType }));
    assert.deepEqual(view(w), before);
    advance(16);
    w.onPointerMove(event(100 + threshold + 1, 100, { pointerType }));
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

test('release glide carries a flick, decays continuously, and resumes automatic rotation', () => {
  const { widget: w, event, advance, drag } = harness();
  drag(); w.onPointerUp(event(190, 140));
  assert.ok(w.glide);
  assert.ok(Math.hypot(w.glide.x, w.glide.y) <= 1.2);
  const before = view(w);
  advance(90, true);
  const firstMovement = Math.abs(w.globe.pitch - before.pitch);
  const middlePitch = w.globe.pitch;
  advance(90, true);
  const secondMovement = Math.abs(w.globe.pitch - middlePitch);
  assert.ok(firstMovement > secondMovement && secondMovement > 0);
  assert.ok(w.globe.velocityX > 0);
  advance(220, true);
  assert.ok(Math.abs(w.globe.pitch - before.pitch) > 20);
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
  assert.ok(Math.hypot(w.glide.x, w.glide.y) <= 1.2);
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
    assert.deepEqual(view(w), before);
  }
});

test('hover prompts for a first tap without enabling country hover, drag, pinch, or wheel', () => {
  const { widget: w, window, event, wheel } = harness({ activated: false });
  window.hitCountry = country;
  w.onAreaPointerEnter(event(100, 100, { pointerType: 'mouse' }));
  assert.equal(w.interactionHint.hidden, false);
  w.onPointerMove(event(100, 100, { pointerType: 'mouse' }));
  assert.equal(w.hovered, null);
  assert.equal(wheel(-100).prevented, false);
  assert.equal(w.globe.targetZoom, 1.05);
  w.onFrameTouchPointerDown(event());
  w.onFrameTouchPointerDown(event(200, 100, { pointerId: 2 }));
  assert.equal(w.frameTouchPointers.size, 0);
  const yaw = w.globe.yaw;
  w.onPointerDown(event());
  w.onPointerMove(event(150, 100));
  w.onPointerUp(event(150, 100));
  assert.equal(w.activated, false);
  assert.equal(w.globe.yaw, yaw);
});

test('the first canvas tap unlocks interactions without selecting its country', () => {
  const { widget: w, window, event, advance } = harness({ activated: false });
  window.hitCountry = country;
  w.onAreaPointerEnter(event(100, 100, { pointerType: 'mouse' }));
  w.onPointerDown(event());
  w.onPointerUp(event());
  assert.equal(w.activated, true);
  assert.equal(w.selected, null);
  assert.equal(w.interactionHint.hidden, true);
  w.onPointerDown(event());
  w.onPointerUp(event());
  advance(151);
  assert.equal(w.selected, country);
});

test('a first tap anywhere else in the widget unlocks globe controls', () => {
  const { widget: w, event, wheel } = harness({ activated: false });
  w.onAreaPointerEnter(event(0, 0, { pointerType: 'mouse' }));
  assert.equal(w.interactionHint.hidden, false);
  w.onRootPointerDown(event(0, 0, { target: w.frame }));
  assert.equal(w.activated, true);
  assert.equal(w.interactionHint.hidden, true);
  assert.equal(wheel(-100).prevented, true);
});

test('search and zoom buttons unlock the globe while performing their first action', () => {
  for (const action of ['search', 'zoom-in', 'zoom-out']) {
    const { widget: w, event } = harness({ activated: false });
    w.onAreaPointerEnter(event(100, 100, { pointerType: 'mouse' }));
    if (action === 'search') w.onCountrySearchInput();
    if (action === 'zoom-in') w.onZoomInClick();
    if (action === 'zoom-out') w.onZoomOutClick();
    assert.equal(w.activated, true);
    assert.equal(w.interactionHint.hidden, true);
    if (action === 'zoom-in') assert.ok(w.globe.targetZoom > 1.05);
    if (action === 'zoom-out') assert.ok(w.globe.targetZoom < 1.05);
  }
});

test('inactive wheel input passes through; activation, exit, Escape, and blur control wheel zoom', () => {
  const { widget: w, wheel } = harness();
  assert.equal(wheel(-100).prevented, false);
  assert.equal(w.globe.targetZoom, 1.05);
  assert.equal(w.interactionHint.hidden, true);
  w.enableWheelZoom();
  assert.equal(w.interactionHint.hidden, true);
  assert.equal(wheel(-100).prevented, true);
  assert.ok(w.globe.targetZoom > 1.05);
  w.disableWheelZoom(); assert.equal(wheel(-100).prevented, false);
  w.enableWheelZoom(); w.onDocumentKeyDown({ key: 'Escape' }); assert.equal(w.wheelEnabled, false);
  w.enableWheelZoom(); w.onWindowBlur(); assert.equal(w.wheelEnabled, false);
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

test('pinch starts at displayed zoom, follows separation, and resets when fingers change', () => {
  const { widget: w, event } = harness();
  w.globe.targetZoom = 8;
  w.onFrameTouchPointerDown(event());
  w.onFrameTouchPointerDown(event(200, 100, { pointerId: 2 }));
  w.onFrameTouchPointerMove(event(300, 100, { pointerId: 2 }));
  assert.equal(w.globe.zoom, 2.1);
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
  assert.ok(w.globe.yaw > before.yaw);
  assert.equal(w.globe.zoom, before.zoom);
  w.onFrameTouchPointerCancel(event(350, 100, { pointerId: 2, type: 'pointercancel' }));
  w.onPointerCancel(event(350, 100, { pointerId: 2 }));
  assert.equal(w.frameTouchPointers.size, 0);
  assert.equal(w.glide, null);
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
