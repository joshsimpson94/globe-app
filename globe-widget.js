(function () {
  const DRAG_THRESHOLD = 6;
  const MAX_SUGGESTIONS = 5;
  const AUTO_ROTATION_SPEED = 0.1;
  const SELECTED_COUNTRY_ROTATION_SPEED = 0.015;
  const CLOSE_ZOOM_ROTATION_SPEED = 0.003;
  const SELECTED_COUNTRY_ROTATION_EASE = 0.14;
  const DEFAULT_SELECTED_COUNTRY_ZOOM = 8;
  const SMALL_COUNTRY_FIT_ZOOM_THRESHOLD = 50;
  const AUTO_ROTATION_ZOOM_REFERENCE = 5;
  const OVERVIEW_LOD_ENTER_ZOOM = 3.4;
  const OVERVIEW_LOD_EXIT_ZOOM = 3.5;
  const CLOSE_DETAIL_LOD_ENTER_ZOOM = 12;
  const CLOSE_DETAIL_LOD_EXIT_ZOOM = 12.2;
  const SELECTED_COUNTRY_FIT_WIDTH = 0.82;
  const SELECTED_COUNTRY_FIT_HEIGHT = 0.66;
  const COUNTRY_HOVER_FILL = "#93E8B1";
  const INITIAL_PITCH_VELOCITY = -0.075;
  const INTRO_MIN_PITCH = -25;
  const INTRO_PITCH_EASE_DISTANCE = 6;
  const INTRO_PITCH_STOP_SPEED = 0.002;
  const FRAME_DURATION = 1000 / 60;
  const MAX_FRAME_SCALE = 3;

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

  const COUNTRY_FOCUS_CENTERS = {
    France: [2.2137, 46.2276],
    Netherlands: [5.2913, 52.1326],
  };

  function getCountryAcronym(name) {
    return COUNTRY_ACRONYMS[name] || null;
  }

  function getDisplayName(feature) {
    const acronym = getCountryAcronym(feature.properties.name);
    return acronym ? `${feature.properties.name} (${acronym})` : feature.properties.name;
  }

  function getFocusCenter(feature) {
    return COUNTRY_FOCUS_CENTERS[feature.properties.name] || window.d3.geoCentroid(feature);
  }

  function countryMatchesQuery(feature, matches) {
    const name = feature.properties.name.toLowerCase();
    const acronym = getCountryAcronym(feature.properties.name);
    return matches(name) || (acronym !== null && matches(acronym.toLowerCase()));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getFrameLerpAmount(amount, frameScale) {
    return 1 - Math.pow(1 - amount, frameScale);
  }

  function createGlobeWidget(root) {
    const frame = root.querySelector(".wf-globe-widget__frame");
    const canvas = root.querySelector("[data-globe-canvas]");
    const context = canvas && canvas.getContext("2d");
    const countryLabel = root.querySelector("[data-country-label]");
    const clearSelectionButton = root.querySelector("[data-clear-selection]");
    const selectionPanel = clearSelectionButton && clearSelectionButton.closest(".wf-globe-widget__hud");
    const zoomInButton = root.querySelector("[data-zoom-in]");
    const zoomOutButton = root.querySelector("[data-zoom-out]");
    const countrySearchForm = root.querySelector("[data-country-search-form]");
    const countrySearchInput = root.querySelector("[data-country-search-input]");
    const countrySearchClearButton = root.querySelector("[data-country-search-clear]");
    const countrySuggestions = root.querySelector("[data-country-suggestions]");
    const globeStatus = root.querySelector("[data-globe-status]");
    const desktopHoverMediaQuery = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 561px)");

    const requiredElements = [
      frame,
      canvas,
      context,
      countryLabel,
      clearSelectionButton,
      selectionPanel,
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
      velocityX: AUTO_ROTATION_SPEED,
      velocityY: INITIAL_PITCH_VELOCITY,
      zoom: 1.05,
      targetZoom: 1.05,
      minZoom: 0.75,
      maxZoom: 20,
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
      activePointers: new Map(),
      pinching: false,
      pinchStartDistance: 0,
      pinchStartZoom: 0,
    };
    const frameTouchPointers = new Map();
    let isFramePinching = false;
    let suppressFrameClickUntil = 0;

    let countries;
    let projection;
    let path;
    let graticule;
    let countryFeatures = [];
    let countryRenderBounds = [];
    let countryGeometryByName = new Map();
    let countryFeatureByName = new Map();
    let overviewTopology = null;
    let overviewCountryGeometryByName = new Map();
    let overviewCountryFeatureByName = new Map();
    let isOverviewGeometryActive = false;
    let closeDetailTopology = null;
    let closeDetailCountryGeometryByName = new Map();
    let closeDetailCountryFeatureByName = new Map();
    let isCloseDetailGeometryActive = false;
    const visibleCountries = { type: "FeatureCollection", features: [] };
    const visibleCountryGeometries = { type: "GeometryCollection", geometries: [] };
    let visibleCountryBorderMesh = null;
    let visibleCountryBorderKey = "";
    let selectedCountry = null;
    let hoveredCountry = null;
    let zoomBeforeCountrySelection = null;
    let suggestionMatches = [];
    let activeSuggestionIndex = -1;
    let isIntroPitchDriftActive = true;
    let isAnimationStarted = false;
    let lastFrameTime = null;
    let pixelRatio = 1;
    let staticLayerCanvas = null;
    let staticLayerKey = "";

    function getAutoRotationSpeed(zoom = globe.zoom) {
      const zoomProgress = clamp(
        (zoom - globe.minZoom) / (AUTO_ROTATION_ZOOM_REFERENCE - globe.minZoom),
        0,
        1,
      );
      const standardZoomSpeed = AUTO_ROTATION_SPEED +
        (SELECTED_COUNTRY_ROTATION_SPEED - AUTO_ROTATION_SPEED) * zoomProgress;

      if (zoom <= AUTO_ROTATION_ZOOM_REFERENCE) {
        return standardZoomSpeed;
      }

      const closeZoomProgress = clamp(
        (zoom - AUTO_ROTATION_ZOOM_REFERENCE) / (globe.maxZoom - AUTO_ROTATION_ZOOM_REFERENCE),
        0,
        1,
      );
      return SELECTED_COUNTRY_ROTATION_SPEED +
        (CLOSE_ZOOM_ROTATION_SPEED - SELECTED_COUNTRY_ROTATION_SPEED) * closeZoomProgress;
    }

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
      selectionPanel.classList.toggle("is-clearable", Boolean(name));
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

    function getFeatureAngularRadius(feature, center) {
      let radius = 0;

      function measureCoordinates(coordinates) {
        if (typeof coordinates[0] === "number") {
          radius = Math.max(radius, window.d3.geoDistance(center, coordinates));
          return;
        }

        coordinates.forEach(measureCoordinates);
      }

      measureCoordinates(feature.geometry.coordinates);
      return radius;
    }

    function getRenderGeometrySource() {
      if (closeDetailTopology) {
        if (isCloseDetailGeometryActive && globe.zoom < CLOSE_DETAIL_LOD_ENTER_ZOOM) {
          isCloseDetailGeometryActive = false;
        } else if (!isCloseDetailGeometryActive && globe.zoom > CLOSE_DETAIL_LOD_EXIT_ZOOM) {
          isCloseDetailGeometryActive = true;
        }

        if (isCloseDetailGeometryActive) {
          return {
            key: "close-detail",
            topology: closeDetailTopology,
            geometryByName: closeDetailCountryGeometryByName,
            featureByName: closeDetailCountryFeatureByName,
          };
        }
      }

      if (!overviewTopology) {
        return {
          key: "detail",
          topology: window.WORLD_TOPOLOGY,
          geometryByName: countryGeometryByName,
          featureByName: countryFeatureByName,
        };
      }

      if (isOverviewGeometryActive && globe.zoom > OVERVIEW_LOD_EXIT_ZOOM) {
        isOverviewGeometryActive = false;
      } else if (!isOverviewGeometryActive && globe.zoom < OVERVIEW_LOD_ENTER_ZOOM) {
        isOverviewGeometryActive = true;
      }

      return isOverviewGeometryActive
        ? {
          key: "overview",
          topology: overviewTopology,
          geometryByName: overviewCountryGeometryByName,
          featureByName: overviewCountryFeatureByName,
        }
        : {
          key: "detail",
          topology: window.WORLD_TOPOLOGY,
          geometryByName: countryGeometryByName,
          featureByName: countryFeatureByName,
        };
    }

    function isDesktopHoverEnabled() {
      return desktopHoverMediaQuery.matches;
    }

    function getVisibleCountries() {
      const viewCenter = projection.invert([globe.centerX, globe.centerY]);
      const features = visibleCountries.features;
      const renderSource = getRenderGeometrySource();
      const viewportRadius = Math.hypot(
        Math.max(globe.centerX, canvas.width / pixelRatio - globe.centerX),
        Math.max(globe.centerY, canvas.height / pixelRatio - globe.centerY),
      );
      const viewportAngle = Math.asin(Math.min(1, viewportRadius / globe.radius));

      features.length = 0;

      countryRenderBounds.forEach(({ feature, center, radius }) => {
        if (window.d3.geoDistance(viewCenter, center) <= viewportAngle + radius + 0.01) {
          const renderFeature = renderSource.featureByName.get(feature.properties.name);

          if (renderFeature) {
            features.push(renderFeature);
          }
        }
      });

      const borderKey = `${renderSource.key}:${features.map((feature) => feature.properties.name).join(",")}`;

      if (borderKey !== visibleCountryBorderKey) {
        visibleCountryGeometries.geometries = features
          .map((feature) => renderSource.geometryByName.get(feature.properties.name))
          .filter(Boolean);
        visibleCountryBorderMesh = window.topojson.mesh(
          renderSource.topology,
          visibleCountryGeometries,
        );
        visibleCountryBorderKey = borderKey;
      }

      return visibleCountries;
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
      countryFeatureByName = new Map(countryFeatures.map((feature) => [feature.properties.name, feature]));
      countryGeometryByName = new Map(
        window.WORLD_TOPOLOGY.objects.countries.geometries.map((geometry) => [geometry.properties.name, geometry]),
      );
      overviewTopology = window.WORLD_TOPOLOGY_OVERVIEW || null;
      overviewCountryGeometryByName = overviewTopology
        ? new Map(overviewTopology.objects.countries.geometries.map((geometry) => [geometry.properties.name, geometry]))
        : new Map();
      overviewCountryFeatureByName = overviewTopology
        ? new Map(
          window.topojson.feature(overviewTopology, overviewTopology.objects.countries).features
            .map((feature) => [feature.properties.name, feature]),
        )
        : new Map();
      isOverviewGeometryActive = Boolean(overviewTopology && globe.zoom <= OVERVIEW_LOD_ENTER_ZOOM);
      closeDetailTopology = window.WORLD_TOPOLOGY_CLOSE_DETAIL || null;
      closeDetailCountryGeometryByName = closeDetailTopology
        ? new Map(closeDetailTopology.objects.countries.geometries.map((geometry) => [geometry.properties.name, geometry]))
        : new Map();
      closeDetailCountryFeatureByName = closeDetailTopology
        ? new Map(
          window.topojson.feature(closeDetailTopology, closeDetailTopology.objects.countries).features
            .map((feature) => [feature.properties.name, feature]),
        )
        : new Map();
      isCloseDetailGeometryActive = Boolean(closeDetailTopology && globe.zoom >= CLOSE_DETAIL_LOD_EXIT_ZOOM);
      countryRenderBounds = countryFeatures.map((feature) => {
        const center = window.d3.geoCentroid(feature);

        return {
          feature,
          center,
          radius: getFeatureAngularRadius(feature, center),
        };
      });

      globeStatus.hidden = true;
      return true;
    }

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      pixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      staticLayerKey = "";

      globe.centerX = bounds.width / 2;
      globe.centerY = bounds.height / 2;
      globe.baseRadius = Math.min(bounds.width, bounds.height) * 0.34;
      globe.radius = globe.baseRadius * globe.zoom;

      projection
        .translate([globe.centerX, globe.centerY])
        .scale(globe.radius)
        .precision(0.6);
    }

    function drawAtmosphere(renderContext) {
      renderContext.beginPath();
      renderContext.arc(globe.centerX, globe.centerY, globe.radius * 1.065, 0, Math.PI * 2);
      renderContext.lineWidth = globe.radius * 0.09;
      renderContext.strokeStyle = "rgba(58, 205, 255, 0.08)";
      renderContext.stroke();
    }

    function drawSphere(renderContext, renderPath) {
      const ocean = renderContext.createRadialGradient(
        globe.centerX - globe.radius * 0.35,
        globe.centerY - globe.radius * 0.42,
        globe.radius * 0.12,
        globe.centerX,
        globe.centerY,
        globe.radius * 1.08,
      );

      ocean.addColorStop(0, "#1c9eda");
      ocean.addColorStop(0.24, "#137faf");
      ocean.addColorStop(0.56, "#0b5d8d");
      ocean.addColorStop(1, "#08253a");

      renderContext.beginPath();
      renderPath({ type: "Sphere" });
      renderContext.fillStyle = ocean;
      renderContext.fill();

      const shading = renderContext.createRadialGradient(
        globe.centerX + globe.radius * 0.42,
        globe.centerY + globe.radius * 0.4,
        globe.radius * 0.08,
        globe.centerX,
        globe.centerY,
        globe.radius,
      );

      shading.addColorStop(0, "rgba(2, 9, 15, 0)");
      shading.addColorStop(1, "rgba(2, 8, 14, 0.72)");

      renderContext.beginPath();
      renderPath({ type: "Sphere" });
      renderContext.fillStyle = shading;
      renderContext.fill();

      renderContext.beginPath();
      renderPath({ type: "Sphere" });
      renderContext.lineWidth = 1.4;
      renderContext.strokeStyle = "rgba(191, 242, 255, 0.5)";
      renderContext.stroke();
    }

    function getStaticLayerKey() {
      return [
        canvas.width,
        canvas.height,
        Math.round(globe.radius * pixelRatio),
      ].join(":");
    }

    function drawStaticLayers() {
      const isZoomSettled = Math.abs(globe.zoom - globe.targetZoom) < 0.001;

      if (!isZoomSettled) {
        drawAtmosphere(context);
        drawSphere(context, path);
        staticLayerKey = "";
        return;
      }

      const nextStaticLayerKey = getStaticLayerKey();

      if (staticLayerKey !== nextStaticLayerKey) {
        staticLayerCanvas = staticLayerCanvas || document.createElement("canvas");
        staticLayerCanvas.width = canvas.width;
        staticLayerCanvas.height = canvas.height;

        const staticContext = staticLayerCanvas.getContext("2d");
        staticContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        const staticPath = window.d3.geoPath(projection, staticContext);

        drawAtmosphere(staticContext);
        drawSphere(staticContext, staticPath);
        staticLayerKey = nextStaticLayerKey;
      }

      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(staticLayerCanvas, 0, 0);
      context.restore();
    }

    function drawWorld() {
      context.save();
      context.beginPath();
      path({ type: "Sphere" });
      context.clip();

      const countriesOnFront = getVisibleCountries();

      context.fillStyle = "rgba(116, 222, 154, 0.86)";

      for (const country of countriesOnFront.features) {
        fillCountry(country);
      }

      if (hoveredCountry && hoveredCountry !== selectedCountry && isDesktopHoverEnabled()) {
        const renderSource = getRenderGeometrySource();
        const hoveredRenderFeature = renderSource.featureByName.get(hoveredCountry.properties.name) || hoveredCountry;

        context.fillStyle = COUNTRY_HOVER_FILL;
        fillCountry(hoveredRenderFeature);
      }

      context.beginPath();
      path(visibleCountryBorderMesh);
      context.lineWidth = 0.7;
      context.strokeStyle = "rgba(210, 255, 231, 0.28)";
      context.stroke();

      context.beginPath();
      path(graticule);
      context.lineWidth = 0.85;
      context.strokeStyle = "rgba(202, 242, 255, 0.18)";
      context.stroke();

      if (selectedCountry) {
        const renderSource = getRenderGeometrySource();
        const selectedRenderFeature = renderSource.featureByName.get(selectedCountry.properties.name) || selectedCountry;

        context.fillStyle = "rgba(255, 212, 102, 0.92)";
        fillCountry(selectedRenderFeature);
        context.beginPath();
        path(selectedRenderFeature);
        context.lineWidth = 1.6;
        context.strokeStyle = "rgba(255, 246, 204, 0.9)";
        context.stroke();
      }

      context.restore();
    }

    function isCountryPathCoveringGlobe() {
      const sampleOffsets = [
        [0, 0],
        [-0.55, 0],
        [0.55, 0],
        [0, -0.55],
        [0, 0.55],
        [-0.38, -0.38],
        [0.38, -0.38],
        [-0.38, 0.38],
        [0.38, 0.38],
      ];
      let coveredSamples = 0;

      sampleOffsets.forEach(([x, y]) => {
        if (context.isPointInPath(
          Math.round((globe.centerX + x * globe.radius) * pixelRatio),
          Math.round((globe.centerY + y * globe.radius) * pixelRatio),
        )) {
          coveredSamples += 1;
        }
      });

      return coveredSamples >= sampleOffsets.length - 1;
    }

    function drawCountryPolygonParts(country) {
      if (country.geometry.type !== "MultiPolygon") {
        return;
      }

      country.geometry.coordinates.forEach((coordinates) => {
        context.beginPath();
        path({ type: "Polygon", coordinates });

        if (!isCountryPathCoveringGlobe()) {
          context.fill("evenodd");
        }
      });
    }

    function fillCountry(country) {
      context.beginPath();
      path(country);

      if (isCountryPathCoveringGlobe()) {
        drawCountryPolygonParts(country);
      } else {
        context.fill();
      }
    }

    function clearCanvas() {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }

    function drawFrame() {
      globe.radius = globe.baseRadius * globe.zoom;

      projection.rotate([globe.yaw, globe.pitch]);
      projection.scale(globe.radius);

      clearCanvas();
      drawStaticLayers();
      drawWorld();
    }

    function render(timestamp) {
      if (lastFrameTime === null) {
        lastFrameTime = timestamp || performance.now();
      }

      const elapsed = Math.max(0, (timestamp || performance.now()) - lastFrameTime);
      const frameScale = clamp(elapsed / FRAME_DURATION, 0, MAX_FRAME_SCALE) || 1;
      lastFrameTime = timestamp || performance.now();

      globe.zoom += (globe.targetZoom - globe.zoom) * getFrameLerpAmount(0.14, frameScale);

      if (!pointer.dragging) {
        globe.yaw += globe.velocityX * frameScale;
        const nextPitch = globe.pitch + globe.velocityY * frameScale;

        if (isIntroPitchDriftActive && globe.velocityY < 0) {
          const distanceToIntroLimit = globe.pitch - INTRO_MIN_PITCH;
          const pitchEase = clamp(distanceToIntroLimit / INTRO_PITCH_EASE_DISTANCE, 0, 1);
          const easedVelocityY = globe.velocityY * pitchEase;

          if (distanceToIntroLimit <= 0) {
            globe.pitch = INTRO_MIN_PITCH;
            globe.velocityY = 0;
            isIntroPitchDriftActive = false;
          } else if (Math.abs(easedVelocityY) < INTRO_PITCH_STOP_SPEED) {
            globe.velocityY = 0;
            isIntroPitchDriftActive = false;
          } else {
            globe.pitch = Math.max(INTRO_MIN_PITCH, globe.pitch + easedVelocityY * frameScale);
          }
        } else {
          globe.pitch = clamp(nextPitch, -90, 90);
        }

        const targetVelocityX = selectedCountry
          ? Math.min(SELECTED_COUNTRY_ROTATION_SPEED, getAutoRotationSpeed(globe.targetZoom))
          : getAutoRotationSpeed();
        const rotationEase = selectedCountry ? SELECTED_COUNTRY_ROTATION_EASE : 0.02;
        globe.velocityX += (targetVelocityX - globe.velocityX) * getFrameLerpAmount(rotationEase, frameScale);
        globe.velocityY *= Math.pow(0.996, frameScale);
      }

      drawFrame();
      requestAnimationFrame(render);
    }

    function startAnimation() {
      if (isAnimationStarted) {
        return;
      }

      isAnimationStarted = true;
      lastFrameTime = null;
      requestAnimationFrame(render);
    }

    function startWhenVisible() {
      if (!("IntersectionObserver" in window)) {
        startAnimation();
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        observer.disconnect();
        startAnimation();
      }, { threshold: 0.1 });

      observer.observe(root);
    }

    function updatePointerState(isDragging) {
      pointer.dragging = isDragging;
      canvas.classList.toggle("is-dragging", isDragging);
    }

    function storeActivePointer(event) {
      pointer.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    function getPinchDistance() {
      const activePoints = Array.from(pointer.activePointers.values());

      if (activePoints.length < 2) {
        return 0;
      }

      return Math.hypot(activePoints[0].x - activePoints[1].x, activePoints[0].y - activePoints[1].y);
    }

    function beginPinchZoom() {
      pointer.pinching = true;
      pointer.moved = true;
      pointer.pinchStartDistance = getPinchDistance();
      pointer.pinchStartZoom = globe.targetZoom;
    }

    function getFramePinchDistance() {
      const activePoints = Array.from(frameTouchPointers.values());

      if (activePoints.length < 2) {
        return 0;
      }

      return Math.hypot(activePoints[0].x - activePoints[1].x, activePoints[0].y - activePoints[1].y);
    }

    function beginFramePinchZoom() {
      isFramePinching = true;
      pointer.activePointers.clear();
      pointer.pinching = false;
      pointer.pinchStartDistance = getFramePinchDistance();
      pointer.pinchStartZoom = globe.targetZoom;
      updatePointerState(false);

      frameTouchPointers.forEach((_, pointerId) => {
        if (!frame.hasPointerCapture(pointerId)) {
          frame.setPointerCapture(pointerId);
        }
      });

      const activeElement = document.activeElement;
      if (activeElement && typeof activeElement.blur === "function") {
        activeElement.blur();
      }
    }

    function onFrameTouchPointerDown(event) {
      if (event.pointerType !== "touch") {
        return;
      }

      frameTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (!isFramePinching && frameTouchPointers.size < 2) {
        return;
      }

      if (!isFramePinching) {
        beginFramePinchZoom();
      }

      event.preventDefault();
      event.stopPropagation();
    }

    function onFrameTouchPointerMove(event) {
      if (event.pointerType !== "touch" || !frameTouchPointers.has(event.pointerId)) {
        return;
      }

      frameTouchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (!isFramePinching) {
        return;
      }

      const pinchDistance = getFramePinchDistance();
      if (pinchDistance > 0 && pointer.pinchStartDistance > 0 && frameTouchPointers.size >= 2) {
        setTargetZoom(pointer.pinchStartZoom * (pinchDistance / pointer.pinchStartDistance));
      }

      event.preventDefault();
      event.stopPropagation();
    }

    function endFrameTouchPointer(event) {
      if (event.pointerType !== "touch" || !frameTouchPointers.has(event.pointerId)) {
        return false;
      }

      const wasFramePinching = isFramePinching;
      frameTouchPointers.delete(event.pointerId);

      if (frame.hasPointerCapture(event.pointerId)) {
        frame.releasePointerCapture(event.pointerId);
      }

      if (wasFramePinching) {
        suppressFrameClickUntil = Date.now() + 400;
      }

      if (wasFramePinching && frameTouchPointers.size < 2) {
        isFramePinching = false;
        pointer.pinchStartDistance = 0;
        updatePointerState(false);
      }

      return wasFramePinching;
    }

    function onFrameTouchPointerUp(event) {
      if (!endFrameTouchPointer(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    function onFrameTouchPointerCancel(event) {
      if (!endFrameTouchPointer(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    function onFrameClickCapture(event) {
      if (Date.now() >= suppressFrameClickUntil) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    function resetSinglePointerDrag() {
      const remainingPointer = Array.from(pointer.activePointers.values())[0];

      if (!remainingPointer) {
        return;
      }

      pointer.lastX = remainingPointer.x;
      pointer.lastY = remainingPointer.y;
      pointer.startX = remainingPointer.x;
      pointer.startY = remainingPointer.y;
      pointer.moved = true;
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
      const zoomFactor = 1 + Math.abs(delta) * 0.9;
      setTargetZoom(globe.targetZoom * (delta > 0 ? zoomFactor : 1 / zoomFactor));
    }

    function getCountryFitZoom(feature) {
      if (feature.properties.name === "France" || feature.properties.name === "Netherlands") {
        return DEFAULT_SELECTED_COUNTRY_ZOOM;
      }

      const previousRotate = projection.rotate();
      const previousScale = projection.scale();

      projection.rotate([globe.yaw, globe.pitch]);
      projection.scale(globe.baseRadius);

      const bounds = path.bounds(feature);

      projection.rotate(previousRotate);
      projection.scale(previousScale);

      const width = bounds[1][0] - bounds[0][0];
      const height = bounds[1][1] - bounds[0][1];

      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return DEFAULT_SELECTED_COUNTRY_ZOOM;
      }

      const availableWidth = globe.centerX * 2 * SELECTED_COUNTRY_FIT_WIDTH;
      const availableHeight = globe.centerY * 2 * SELECTED_COUNTRY_FIT_HEIGHT;
      const fitZoom = Math.min(availableWidth / width, availableHeight / height);

      // Larger countries retain a fitting or standard 10× view.
      if (fitZoom <= DEFAULT_SELECTED_COUNTRY_ZOOM) {
        return clamp(fitZoom, globe.minZoom, DEFAULT_SELECTED_COUNTRY_ZOOM);
      }

      // Only genuinely small countries get the closer fitted view. This
      // avoids treating countries such as Belgium or Switzerland as microstates.
      if (fitZoom >= SMALL_COUNTRY_FIT_ZOOM_THRESHOLD) {
        return clamp(fitZoom, DEFAULT_SELECTED_COUNTRY_ZOOM, globe.maxZoom);
      }

      return DEFAULT_SELECTED_COUNTRY_ZOOM;
    }

    function focusOnCountry(feature) {
      const center = getFocusCenter(feature);
      const longitude = center[0];
      const latitude = center[1];

      if (!selectedCountry) {
        zoomBeforeCountrySelection = globe.targetZoom;
      }

      selectedCountry = feature;
      isIntroPitchDriftActive = false;
      globe.yaw = -longitude;
      globe.pitch = clamp(-latitude, -90, 90);
      globe.velocityX = SELECTED_COUNTRY_ROTATION_SPEED;
      globe.velocityY = 0;
      setTargetZoom(getCountryFitZoom(feature));
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

    function getCountryAtPoint(clientX, clientY) {
      const bounds = canvas.getBoundingClientRect();
      const point = [clientX - bounds.left, clientY - bounds.top];
      const coordinates = projection.invert(point);

      if (!coordinates) {
        return null;
      }

      return countryFeatures.find((feature) => window.d3.geoContains(feature, coordinates)) || null;
    }

    function updateHoveredCountry(clientX, clientY) {
      const match = getCountryAtPoint(clientX, clientY);
      hoveredCountry = match === selectedCountry ? null : match;
      canvas.classList.toggle("is-country-hovered", Boolean(hoveredCountry));
    }

    function selectCountryAtPoint(clientX, clientY) {
      const match = getCountryAtPoint(clientX, clientY);

      if (!match) {
        clearSelectedCountry();
        return;
      }

      if (selectedCountry === match) {
        clearSelectedCountry();
        return;
      }

      focusOnCountry(match);
    }

function onPointerDown(event) {
  isIntroPitchDriftActive = false;
  storeActivePointer(event);
  updatePointerState(true);
  canvas.setPointerCapture(event.pointerId);

  if (pointer.activePointers.size === 1) {
    pointer.pinching = false;
    pointer.moved = false;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.startX = event.clientX;
    pointer.startY = event.clientY;
    return;
  }

  beginPinchZoom();
}

function onPointerMove(event) {
  if (event.pointerType === "mouse" && !pointer.dragging && isDesktopHoverEnabled()) {
    updateHoveredCountry(event.clientX, event.clientY);
  }

  if (!pointer.activePointers.has(event.pointerId)) {
    return;
  }

  storeActivePointer(event);

  if (pointer.activePointers.size >= 2) {
    if (!pointer.pinching) {
      beginPinchZoom();
    }

    const pinchDistance = getPinchDistance();

    if (pointer.pinchStartDistance > 0) {
      setTargetZoom(pointer.pinchStartZoom * (pinchDistance / pointer.pinchStartDistance));
    }

    pointer.moved = true;
    return;
  }

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

  // Convert screen movement into angular movement using the globe's current
  // rendered radius. This gives the same on-screen drag distance at every zoom.
  const degreesPerPixel = 180 / (Math.PI * Math.max(globe.radius, 1));
  const dragRotationX = deltaX * degreesPerPixel;
  const dragRotationY = deltaY * degreesPerPixel;

  globe.yaw += dragRotationX;
  globe.pitch = clamp(globe.pitch - dragRotationY, -90, 90);
  globe.velocityX = dragRotationX / 15;
  globe.velocityY = -dragRotationY / 15;
}

function onPointerLeave() {
  hoveredCountry = null;
  canvas.classList.remove("is-country-hovered");
}

function onPointerUp(event) {
  const wasTap = pointer.dragging && !pointer.moved && pointer.activePointers.size === 1 && pointer.activePointers.has(event.pointerId);

  pointer.activePointers.delete(event.pointerId);

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (wasTap) {
    selectCountryAtPoint(event.clientX, event.clientY);
  }

  if (!pointer.activePointers.size) {
    pointer.pinching = false;
    updatePointerState(false);
    return;
  }

  if (pointer.activePointers.size === 1) {
    pointer.pinching = false;
    resetSinglePointerDrag();
    return;
  }

  beginPinchZoom();
}

function onPointerCancel(event) {
  pointer.activePointers.delete(event.pointerId);

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (!pointer.activePointers.size) {
    pointer.pinching = false;
    updatePointerState(false);
    return;
  }

  if (pointer.activePointers.size === 1) {
    pointer.pinching = false;
    resetSinglePointerDrag();
    return;
  }

  beginPinchZoom();
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

      countrySearchInput.blur();
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

    window.addEventListener("resize", () => {
      resizeCanvas();

      if (!isAnimationStarted) {
        drawFrame();
      }
    });
    frame.addEventListener("pointerdown", onFrameTouchPointerDown, { capture: true, passive: false });
    frame.addEventListener("pointermove", onFrameTouchPointerMove, { capture: true, passive: false });
    frame.addEventListener("pointerup", onFrameTouchPointerUp, { capture: true, passive: false });
    frame.addEventListener("pointercancel", onFrameTouchPointerCancel, { capture: true, passive: false });
    frame.addEventListener("click", onFrameClickCapture, true);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    zoomInButton.addEventListener("click", () => zoomBy(0.75));
    zoomOutButton.addEventListener("click", () => zoomBy(-0.75));
    clearSelectionButton.addEventListener("click", clearSelectedCountry);
    selectionPanel.addEventListener("click", (event) => {
      if (clearSelectionButton.hidden || event.target.closest("[data-clear-selection]")) {
        return;
      }

      clearSelectionButton.click();
    });
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
    drawFrame();
    startWhenVisible();
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

  function fetchTopology(topologyUrl) {
    return window.fetch(topologyUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load country geometry: ${response.status}`);
        }

        return response.json();
      });
  }

  function loadWorldTopology() {
    const detailedTopology = window.WORLD_TOPOLOGY
      ? Promise.resolve(window.WORLD_TOPOLOGY)
      : fetchTopology(window.WORLD_TOPOLOGY_URL || "countries-50m.json");
    const overviewUrl = window.WORLD_TOPOLOGY_OVERVIEW_URL;
    const overviewTopology = window.WORLD_TOPOLOGY_OVERVIEW
      ? Promise.resolve(window.WORLD_TOPOLOGY_OVERVIEW)
      : overviewUrl
        ? fetchTopology(overviewUrl).catch((error) => {
          console.warn("Globe overview geometry failed to load; using detailed geometry.", error);
          return null;
        })
        : Promise.resolve(null);
    const closeDetailUrl = window.WORLD_TOPOLOGY_CLOSE_DETAIL_URL;
    const closeDetailTopology = window.WORLD_TOPOLOGY_CLOSE_DETAIL
      ? Promise.resolve(window.WORLD_TOPOLOGY_CLOSE_DETAIL)
      : closeDetailUrl
        ? fetchTopology(closeDetailUrl).catch((error) => {
          console.warn("Globe close-detail geometry failed to load; using standard detail.", error);
          return null;
        })
        : Promise.resolve(null);

    return Promise.all([detailedTopology, overviewTopology, closeDetailTopology]).then(([
      detailed,
      overview,
      closeDetail,
    ]) => {
      window.WORLD_TOPOLOGY = detailed;

      if (overview) {
        window.WORLD_TOPOLOGY_OVERVIEW = overview;
      }

      if (closeDetail) {
        window.WORLD_TOPOLOGY_CLOSE_DETAIL = closeDetail;
      }
    });
  }

  function startGlobeWidgets() {
    loadWorldTopology().then(
      initGlobeWidgets,
      (error) => {
        console.error("Globe country geometry failed to load.", error);
        initGlobeWidgets();
      },
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGlobeWidgets);
  } else {
    startGlobeWidgets();
  }
})();
