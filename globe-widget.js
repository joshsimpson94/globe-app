(function () {
  const DRAG_THRESHOLD = 6;
  const MAX_SUGGESTIONS = 5;

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const COUNTRY_ACRONYMS = {
    "United Kingdom": "UK",
    "United States of America": "USA",
    "United Arab Emirates": "UAE",
  };

  function getCountryAcronym(name) {
    return COUNTRY_ACRONYMS[name] || null;
  }

  function getDisplayName(feature) {
    const acronym = getCountryAcronym(feature.properties.name);
    return acronym ? `${feature.properties.name} (${acronym})` : feature.properties.name;
  }

  function countryMatchesQuery(feature, matches) {
    const name = feature.properties.name.toLowerCase();
    const acronym = getCountryAcronym(feature.properties.name);
    return matches(name) || (acronym !== null && matches(acronym.toLowerCase()));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createGlobeWidget(root) {
    const canvas = root.querySelector("[data-globe-canvas]");
    const context = canvas && canvas.getContext("2d");
    const countryLabel = root.querySelector("[data-country-label]");
    const clearSelectionButton = root.querySelector("[data-clear-selection]");
    const zoomInButton = root.querySelector("[data-zoom-in]");
    const zoomOutButton = root.querySelector("[data-zoom-out]");
    const countrySearchForm = root.querySelector("[data-country-search-form]");
    const countrySearchInput = root.querySelector("[data-country-search-input]");
    const countrySearchClearButton = root.querySelector("[data-country-search-clear]");
    const countrySuggestions = root.querySelector("[data-country-suggestions]");
    const globeStatus = root.querySelector("[data-globe-status]");

    const requiredElements = [
      canvas,
      context,
      countryLabel,
      clearSelectionButton,
      zoomInButton,
      zoomOutButton,
      countrySearchForm,
      countrySearchInput,
      countrySearchClearButton,
      countrySuggestions,
      globeStatus,
    ];

    if (!requiredElements.every(Boolean)) {
      console.error("Globe widget could not start because required elements are missing.", root);
      return;
    }

    const globe = {
      yaw: -36,
      pitch: -18,
      velocityX: 0.18,
      velocityY: -0.06,
      zoom: 1.05,
      targetZoom: 1.05,
      minZoom: 0.75,
      maxZoom: 5,
      baseRadius: 0,
      radius: 0,
      centerX: 0,
      centerY: 0,
    };

    const pointer = {
      dragging: false,
      moved: false,
      lastX: 0,
      lastY: 0,
      startX: 0,
      startY: 0,
    };

    let countries;
    let projection;
    let path;
    let graticule;
    let countryFeatures = [];
    let selectedCountry = null;
    let zoomBeforeCountrySelection = null;
    let suggestionMatches = [];
    let activeSuggestionIndex = -1;

    function setSearchExpanded(isExpanded) {
      countrySearchInput.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    }

    function updateSearchClearButton() {
      countrySearchClearButton.hidden = !countrySearchInput.value;
    }

    function clearActiveSuggestion() {
      activeSuggestionIndex = -1;
      countrySearchInput.removeAttribute("aria-activedescendant");
    }

    function closeSuggestions() {
      countrySuggestions.hidden = true;
      countrySuggestions.innerHTML = "";
      suggestionMatches = [];
      clearActiveSuggestion();
      setSearchExpanded(false);
    }

    function updateCountryLabel(name) {
      countryLabel.textContent = name || "Select a country";
      clearSelectionButton.hidden = !name;
    }

    function showGlobeStatus(message) {
      globeStatus.hidden = false;
      globeStatus.textContent = message;
      updateCountryLabel("Globe unavailable");
      countrySearchInput.disabled = true;
      countrySearchInput.placeholder = "Globe unavailable";
      countrySearchClearButton.hidden = true;
      zoomInButton.disabled = true;
      zoomOutButton.disabled = true;
      clearSelectionButton.hidden = true;
      closeSuggestions();
    }

    function initializeDependencies() {
      if (!context) {
        showGlobeStatus("Your browser could not start the globe canvas.");
        return false;
      }

      if (!window.d3 || !window.topojson || !window.WORLD_TOPOLOGY) {
        showGlobeStatus("The globe data failed to load. Refresh and try again.");
        return false;
      }

      countries = window.topojson.feature(window.WORLD_TOPOLOGY, window.WORLD_TOPOLOGY.objects.countries);
      projection = window.d3.geoOrthographic();
      path = window.d3.geoPath(projection, context);
      graticule = window.d3.geoGraticule10();
      countryFeatures = countries.features
        .filter((feature) => feature && feature.properties && feature.properties.name)
        .sort((left, right) => left.properties.name.localeCompare(right.properties.name));

      globeStatus.hidden = true;
      return true;
    }

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      globe.centerX = bounds.width / 2;
      globe.centerY = bounds.height / 2;
      globe.baseRadius = Math.min(bounds.width, bounds.height) * 0.34;
      globe.radius = globe.baseRadius * globe.zoom;

      projection
        .translate([globe.centerX, globe.centerY])
        .scale(globe.radius)
        .precision(0.3);
    }

    function drawAtmosphere() {
      context.beginPath();
      context.arc(globe.centerX, globe.centerY, globe.radius * 1.065, 0, Math.PI * 2);
      context.lineWidth = globe.radius * 0.09;
      context.strokeStyle = "rgba(58, 205, 255, 0.08)";
      context.stroke();
    }

    function drawSphere() {
      const ocean = context.createRadialGradient(
        globe.centerX - globe.radius * 0.35,
        globe.centerY - globe.radius * 0.42,
        globe.radius * 0.12,
        globe.centerX,
        globe.centerY,
        globe.radius * 1.08,
      );

      ocean.addColorStop(0, "#4de0ff");
      ocean.addColorStop(0.18, "#1c9eda");
      ocean.addColorStop(0.56, "#0b5d8d");
      ocean.addColorStop(1, "#08253a");

      context.beginPath();
      path({ type: "Sphere" });
      context.fillStyle = ocean;
      context.fill();

      const shading = context.createRadialGradient(
        globe.centerX + globe.radius * 0.42,
        globe.centerY + globe.radius * 0.4,
        globe.radius * 0.08,
        globe.centerX,
        globe.centerY,
        globe.radius,
      );

      shading.addColorStop(0, "rgba(2, 9, 15, 0)");
      shading.addColorStop(1, "rgba(2, 8, 14, 0.72)");

      context.beginPath();
      path({ type: "Sphere" });
      context.fillStyle = shading;
      context.fill();

      context.beginPath();
      context.arc(
        globe.centerX - globe.radius * 0.26,
        globe.centerY - globe.radius * 0.34,
        globe.radius * 0.24,
        0,
        Math.PI * 2,
      );
      context.fillStyle = "rgba(255, 255, 255, 0.14)";
      context.fill();

      context.beginPath();
      path({ type: "Sphere" });
      context.lineWidth = 1.4;
      context.strokeStyle = "rgba(191, 242, 255, 0.5)";
      context.stroke();
    }

    function drawWorld() {
      context.save();
      context.beginPath();
      path({ type: "Sphere" });
      context.clip();

      context.beginPath();
      path(countries);
      context.fillStyle = "rgba(116, 222, 154, 0.86)";
      context.fill();
      context.lineWidth = 0.7;
      context.strokeStyle = "rgba(210, 255, 231, 0.28)";
      context.stroke();

      context.beginPath();
      path(graticule);
      context.lineWidth = 0.85;
      context.strokeStyle = "rgba(202, 242, 255, 0.18)";
      context.stroke();

      if (selectedCountry) {
        context.beginPath();
        path(selectedCountry);
        context.fillStyle = "rgba(255, 212, 102, 0.92)";
        context.fill();
        context.lineWidth = 1.6;
        context.strokeStyle = "rgba(255, 246, 204, 0.9)";
        context.stroke();
      }

      context.restore();
    }

    function render() {
      globe.zoom += (globe.targetZoom - globe.zoom) * 0.14;
      globe.radius = globe.baseRadius * globe.zoom;

      projection.rotate([globe.yaw, globe.pitch]);
      projection.scale(globe.radius);

      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      drawAtmosphere();
      drawSphere();
      drawWorld();

      if (!pointer.dragging) {
        globe.yaw += globe.velocityX;
        globe.pitch = clamp(globe.pitch + globe.velocityY, -90, 90);
        globe.velocityX *= 0.992;
        globe.velocityY *= 0.992;

        if (Math.abs(globe.velocityX) < 0.015) {
          globe.velocityX += 0.004;
        }

        if (Math.abs(globe.velocityY) < 0.006) {
          globe.velocityY *= 0.98;
        }
      }

      requestAnimationFrame(render);
    }

    function updatePointerState(isDragging) {
      pointer.dragging = isDragging;
      canvas.classList.toggle("is-dragging", isDragging);
    }

    function updateActiveSuggestion() {
      const suggestionButtons = Array.from(countrySuggestions.querySelectorAll(".wf-globe-widget__suggestion"));

      suggestionButtons.forEach((button, index) => {
        const isActive = index === activeSuggestionIndex;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      if (activeSuggestionIndex >= 0 && suggestionButtons[activeSuggestionIndex]) {
        countrySearchInput.setAttribute("aria-activedescendant", suggestionButtons[activeSuggestionIndex].id);
      } else {
        countrySearchInput.removeAttribute("aria-activedescendant");
      }
    }

    function renderSuggestions(matches) {
      suggestionMatches = matches;
      clearActiveSuggestion();

      if (!matches.length) {
        closeSuggestions();
        return;
      }

      countrySuggestions.hidden = false;
      setSearchExpanded(true);
      countrySuggestions.innerHTML = matches
        .map(
          (feature, index) =>
            `<button class="wf-globe-widget__suggestion" id="country-suggestion-${root.dataset.globeInstance}-${index}" data-index="${index}" type="button" role="option" aria-selected="false">${escapeHtml(getDisplayName(feature))}</button>`,
        )
        .join("");
    }

    function getSuggestions(query) {
      const normalized = query.trim().toLowerCase();

      if (!normalized) {
        return [];
      }

      const startsWithMatches = countryFeatures.filter((feature) =>
        countryMatchesQuery(feature, (value) => value.startsWith(normalized)),
      );

      const includesMatches = countryFeatures.filter((feature) => {
        if (countryMatchesQuery(feature, (value) => value.startsWith(normalized))) {
          return false;
        }
        return countryMatchesQuery(feature, (value) => value.includes(normalized));
      });

      return [...startsWithMatches, ...includesMatches].slice(0, MAX_SUGGESTIONS);
    }

    function setTargetZoom(nextZoom) {
      globe.targetZoom = clamp(nextZoom, globe.minZoom, globe.maxZoom);
    }

    function zoomBy(delta) {
      setTargetZoom(globe.targetZoom + delta);
    }

    function focusOnCountry(feature) {
      const center = window.d3.geoCentroid(feature);
      const longitude = center[0];
      const latitude = center[1];

      if (!selectedCountry) {
        zoomBeforeCountrySelection = globe.targetZoom;
      }

      selectedCountry = feature;
      globe.yaw = -longitude;
      globe.pitch = clamp(-latitude, -90, 90);
      globe.velocityX = 0;
      globe.velocityY = 0;
      setTargetZoom(3.5);
      countrySearchInput.value = "";
      updateSearchClearButton();
      updateCountryLabel(getDisplayName(feature));
      closeSuggestions();
    }

    function clearSelectedCountry() {
      selectedCountry = null;
      if (zoomBeforeCountrySelection !== null) {
        setTargetZoom(zoomBeforeCountrySelection);
        zoomBeforeCountrySelection = null;
      }
      updateCountryLabel("");
    }

    function clearSearchInput() {
      countrySearchInput.value = "";
      updateSearchClearButton();
      closeSuggestions();
      countrySearchInput.focus();
    }

    function findCountryByName(name) {
      const normalized = name.trim().toLowerCase();

      if (!normalized) {
        return null;
      }

      return (
        countryFeatures.find((feature) => countryMatchesQuery(feature, (value) => value === normalized)) || null
      );
    }

    function selectCountryAtPoint(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      const point = [clientX - bounds.left, clientY - bounds.top];
      const coordinates = projection.invert(point);

      if (!coordinates) {
        clearSelectedCountry();
        return;
      }

      const match = countryFeatures.find((feature) => window.d3.geoContains(feature, coordinates)) || null;

      if (!match) {
        clearSelectedCountry();
        return;
      }

      focusOnCountry(match);
    }

    function onPointerDown(event) {
      updatePointerState(true);
      pointer.moved = false;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.startX = event.clientX;
      pointer.startY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event) {
      if (!pointer.dragging) {
        return;
      }

      const deltaX = event.clientX - pointer.lastX;
      const deltaY = event.clientY - pointer.lastY;
      const travelX = event.clientX - pointer.startX;
      const travelY = event.clientY - pointer.startY;

      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;

      if (Math.hypot(travelX, travelY) > DRAG_THRESHOLD) {
        pointer.moved = true;
      }

      globe.yaw += deltaX * 0.45;
      globe.pitch = clamp(globe.pitch - deltaY * 0.45, -90, 90);
      globe.velocityX = deltaX * 0.03;
      globe.velocityY = -deltaY * 0.03;
    }

    function onPointerUp(event) {
      if (!pointer.dragging) {
        return;
      }

      updatePointerState(false);

      if (!pointer.moved) {
        selectCountryAtPoint(event.clientX, event.clientY);
      }

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }

    function onPointerCancel(event) {
      if (!pointer.dragging) {
        return;
      }

      updatePointerState(false);

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }

    function onWheel(event) {
      event.preventDefault();
      zoomBy(event.deltaY > 0 ? -0.14 : 0.14);
    }

    function onCountrySearch(event) {
      event.preventDefault();
      const match = findCountryByName(countrySearchInput.value);

      if (match) {
        focusOnCountry(match);
      }
    }

    function onCountrySearchInput() {
      updateSearchClearButton();
      renderSuggestions(getSuggestions(countrySearchInput.value));
    }

    function onCountrySearchKeyDown(event) {
      if (event.key === "Escape") {
        closeSuggestions();
        return;
      }

      if (event.key === "Tab") {
        closeSuggestions();
        return;
      }

      if (!suggestionMatches.length) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestionMatches.length;
        updateActiveSuggestion();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestionMatches.length) % suggestionMatches.length;
        updateActiveSuggestion();
        return;
      }

      if (event.key === "Enter" && activeSuggestionIndex >= 0) {
        event.preventDefault();
        focusOnCountry(suggestionMatches[activeSuggestionIndex]);
      }
    }

    function onSuggestionClick(event) {
      const suggestionButton = event.target.closest(".wf-globe-widget__suggestion");

      if (!suggestionButton) {
        return;
      }

      const index = Number(suggestionButton.dataset.index);
      const match = suggestionMatches[index];

      if (match) {
        focusOnCountry(match);
      }
    }

    function onDocumentClick(event) {
      if (!countrySearchForm.contains(event.target)) {
        closeSuggestions();
      }
    }

    function onDocumentKeyDown(event) {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      closeSuggestions();
      clearSelectedCountry();
    }

    if (!initializeDependencies()) {
      return;
    }

    window.addEventListener("resize", resizeCanvas);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    zoomInButton.addEventListener("click", () => zoomBy(0.75));
    zoomOutButton.addEventListener("click", () => zoomBy(-0.75));
    clearSelectionButton.addEventListener("click", clearSelectedCountry);
    countrySearchClearButton.addEventListener("click", clearSearchInput);
    countrySearchForm.addEventListener("submit", onCountrySearch);
    countrySuggestions.addEventListener("click", onSuggestionClick);
    countrySearchInput.addEventListener("input", onCountrySearchInput);
    countrySearchInput.addEventListener("change", onCountrySearch);
    countrySearchInput.addEventListener("keydown", onCountrySearchKeyDown);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeyDown);

    resizeCanvas();
    updateCountryLabel("");
    updateSearchClearButton();
    closeSuggestions();
    render();
  }

  function initGlobeWidgets() {
    const widgets = Array.from(document.querySelectorAll("[data-globe-widget]"));

    widgets.forEach((root, index) => {
      if (root.dataset.globeInitialized === "true") {
        return;
      }

      root.dataset.globeInitialized = "true";
      root.dataset.globeInstance = String(index + 1);
      createGlobeWidget(root);
    });
  }

  window.WebflowGlobeWidget = {
    init: initGlobeWidgets,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGlobeWidgets);
  } else {
    initGlobeWidgets();
  }
})();
