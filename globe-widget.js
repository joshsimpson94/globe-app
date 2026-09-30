(function () {
  const DRAG_THRESHOLD = 6;
  const MOBILE_DOUBLE_TAP_DELAY = 150;
  const DESKTOP_DOUBLE_CLICK_DELAY = 150;
  const MOBILE_DOUBLE_TAP_MAX_DISTANCE = 32;
  const MOBILE_DOUBLE_TAP_DRAG_ZOOM_DISTANCE = 200;
  const MAX_SUGGESTIONS = 5;
  const AUTO_ROTATION_SPEED = 0.1;
  const SELECTED_COUNTRY_ROTATION_SPEED = 0.015;
  const CLOSE_ZOOM_ROTATION_SPEED = 0.003;
  const SELECTED_COUNTRY_ROTATION_EASE = 0.14;
  const DEFAULT_SELECTED_COUNTRY_ZOOM = 8;
  const SMALL_COUNTRY_FIT_ZOOM_THRESHOLD = 50;
  // About 4,000 km²: tiny countries and island groups should be legible even
  // when their islands are geographically dispersed.
  const SMALL_COUNTRY_MAX_ZOOM_AREA = 0.0001;
  const AUTO_ROTATION_ZOOM_REFERENCE = 5;
  const OVERVIEW_LOD_ENTER_ZOOM = 3.9;
  const OVERVIEW_LOD_EXIT_ZOOM = 4;
  const CLOSE_DETAIL_LOD_ENTER_ZOOM = 12;
  const CLOSE_DETAIL_LOD_EXIT_ZOOM = 12.2;
  const SELECTED_COUNTRY_FIT_WIDTH = 0.82;
  const SELECTED_COUNTRY_FIT_HEIGHT = 0.66;
  const COUNTRY_FILL = "rgba(60, 185, 165, 0.9)";
  const COUNTRY_HOVER_FILL = "#60d4b7";
  const COUNTRY_BORDER_STROKE = "rgba(143, 231, 207, 0.6)";
  const SELECTED_COUNTRY_FILL = "#d9b96b";
  const SELECTED_COUNTRY_STROKE = "rgba(244, 222, 165, 0.86)";
  const OVERVIEW_COUNTRY_BORDER_WIDTH = 0.75;
  const STANDARD_COUNTRY_BORDER_WIDTH = 1.25;
  const CLOSE_DETAIL_COUNTRY_BORDER_WIDTH = 1.5;
  const INITIAL_PITCH_VELOCITY = -0.075;
  const INTRO_MIN_PITCH = -25;
  const INTRO_PITCH_EASE_DISTANCE = 6;
  const INTRO_PITCH_STOP_SPEED = 0.002;
  const FRAME_DURATION = 1000 / 60;
  const MAX_FRAME_SCALE = 3;
  // Use uppercase K/M/B abbreviations; en-GB uses lowercase m/b.
  const populationFormatter = new Intl.NumberFormat("en-US", {
    notation: "compact", maximumFractionDigits: 1,
  });
  const fullPopulationFormatter = new Intl.NumberFormat("en-GB");
  // Feather external-link icon, Copyright (c) 2013-2023 Cole Bemis (MIT).
  // See FEATHER-LICENSE.txt. Inlined to avoid a library or network dependency.
  const EXTERNAL_LINK_ICON = '<svg class="wf-globe-widget__external-link-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const COUNTRY_DISPLAY_NAMES = {
    "Antigua and Barb.": "Antigua and Barbuda",
    "Ashmore and Cartier Is.": "Ashmore and Cartier Islands",
    "Bosnia and Herz.": "Bosnia and Herzegovina",
    "Br. Indian Ocean Ter.": "British Indian Ocean Territory",
    "British Virgin Is.": "British Virgin Islands",
    "Cayman Is.": "Cayman Islands",
    "Central African Rep.": "Central African Republic",
    "Cook Is.": "Cook Islands",
    "Dem. Rep. Congo": "Democratic Republic of the Congo",
    "Dominican Rep.": "Dominican Republic",
    "Eq. Guinea": "Equatorial Guinea",
    "Faeroe Is.": "Faroe Islands",
    "Falkland Is.": "Falkland Islands",
    "Fr. Polynesia": "French Polynesia",
    "Fr. S. Antarctic Lands": "French Southern and Antarctic Lands",
    "Heard I. and McDonald Is.": "Heard Island and McDonald Islands",
    "Indian Ocean Ter.": "Indian Ocean Territory",
    "Marshall Is.": "Marshall Islands",
    "N. Cyprus": "Northern Cyprus",
    "N. Mariana Is.": "Northern Mariana Islands",
    "Pitcairn Is.": "Pitcairn Islands",
    "S. Geo. and the Is.": "South Georgia and the South Sandwich Islands",
    "S. Sudan": "South Sudan",
    "Solomon Is.": "Solomon Islands",
    "St. Kitts and Nevis": "Saint Kitts and Nevis",
    "St. Pierre and Miquelon": "Saint Pierre and Miquelon",
    "St. Vin. and Gren.": "Saint Vincent and the Grenadines",
    "Turks and Caicos Is.": "Turks and Caicos Islands",
    "U.S. Virgin Is.": "United States Virgin Islands",
    "W. Sahara": "Western Sahara",
    "Wallis and Futuna Is.": "Wallis and Futuna Islands",
  };

  const COUNTRY_SEARCH_ALIASES = {
    "United Kingdom": ["UK", "Britain", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland"],
    "United States of America": ["USA", "United States"],
    "United Arab Emirates": ["UAE"],
  };

  const COUNTRY_FOCUS_CENTERS = {
    France: [2.2137, 46.2276],
    Netherlands: [5.2913, 52.1326],
  };

  // BEGIN GENERATED POPULATIONS
  // World Bank SP.POP.TOTL, latest non-empty values. Refresh: node scripts/update-population.mjs
  // CC BY 4.0; source and methodology: https://data.worldbank.org/indicator/SP.POP.TOTL
  const COUNTRY_POPULATIONS = {
    "Afghanistan": {"value":43844111,"year":2025,"code":"AF"},
    "Albania": {"value":2349580,"year":2025,"code":"AL"},
    "Algeria": {"value":47435312,"year":2025,"code":"DZ"},
    "American Samoa": {"value":46029,"year":2025,"code":"AS"},
    "Andorra": {"value":82904,"year":2025,"code":"AD"},
    "Angola": {"value":39040039,"year":2025,"code":"AO"},
    "Antigua and Barb.": {"value":94209,"year":2025,"code":"AG"},
    "Argentina": {"value":45851378,"year":2025,"code":"AR"},
    "Armenia": {"value":3086700,"year":2025,"code":"AM"},
    "Aruba": {"value":108785,"year":2025,"code":"AW"},
    "Australia": {"value":27614411,"year":2025,"code":"AU"},
    "Austria": {"value":9208163,"year":2025,"code":"AT"},
    "Azerbaijan": {"value":10246996,"year":2025,"code":"AZ"},
    "Bahamas": {"value":403033,"year":2025,"code":"BS"},
    "Bahrain": {"value":1600366,"year":2025,"code":"BH"},
    "Bangladesh": {"value":175686899,"year":2025,"code":"BD"},
    "Barbados": {"value":282623,"year":2025,"code":"BB"},
    "Belarus": {"value":9085991,"year":2025,"code":"BY"},
    "Belgium": {"value":11941781,"year":2025,"code":"BE"},
    "Belize": {"value":422924,"year":2025,"code":"BZ"},
    "Benin": {"value":14814460,"year":2025,"code":"BJ"},
    "Bermuda": {"value":64555,"year":2025,"code":"BM"},
    "Bhutan": {"value":796682,"year":2025,"code":"BT"},
    "Bolivia": {"value":12581843,"year":2025,"code":"BO"},
    "Bosnia and Herz.": {"value":3140095,"year":2025,"code":"BA"},
    "Botswana": {"value":2562122,"year":2025,"code":"BW"},
    "Brazil": {"value":212812405,"year":2025,"code":"BR"},
    "British Virgin Is.": {"value":39732,"year":2025,"code":"VG"},
    "Brunei": {"value":466330,"year":2025,"code":"BN"},
    "Bulgaria": {"value":6433302,"year":2025,"code":"BG"},
    "Burkina Faso": {"value":24074580,"year":2025,"code":"BF"},
    "Burundi": {"value":14390003,"year":2025,"code":"BI"},
    "Cabo Verde": {"value":527326,"year":2025,"code":"CV"},
    "Cambodia": {"value":17847982,"year":2025,"code":"KH"},
    "Cameroon": {"value":29879337,"year":2025,"code":"CM"},
    "Canada": {"value":41651653,"year":2025,"code":"CA"},
    "Cayman Is.": {"value":75844,"year":2025,"code":"KY"},
    "Central African Rep.": {"value":5513282,"year":2025,"code":"CF"},
    "Chad": {"value":21003705,"year":2025,"code":"TD"},
    "Chile": {"value":19859921,"year":2025,"code":"CL"},
    "China": {"value":1406585000,"year":2025,"code":"CN"},
    "Colombia": {"value":53425635,"year":2025,"code":"CO"},
    "Comoros": {"value":882847,"year":2025,"code":"KM"},
    "Congo": {"value":6484437,"year":2025,"code":"CG"},
    "Costa Rica": {"value":5152950,"year":2025,"code":"CR"},
    "Côte d'Ivoire": {"value":32711547,"year":2025,"code":"CI"},
    "Croatia": {"value":3876200,"year":2025,"code":"HR"},
    "Cuba": {"value":10937203,"year":2025,"code":"CU"},
    "Curaçao": {"value":156263,"year":2025,"code":"CW"},
    "Cyprus": {"value":1370754,"year":2025,"code":"CY"},
    "Czechia": {"value":10886878,"year":2025,"code":"CZ"},
    "Dem. Rep. Congo": {"value":112832473,"year":2025,"code":"CD"},
    "Denmark": {"value":6009169,"year":2025,"code":"DK"},
    "Djibouti": {"value":1184076,"year":2025,"code":"DJ"},
    "Dominica": {"value":65871,"year":2025,"code":"DM"},
    "Dominican Rep.": {"value":11520487,"year":2025,"code":"DO"},
    "Ecuador": {"value":18289896,"year":2025,"code":"EC"},
    "Egypt": {"value":118365995,"year":2025,"code":"EG"},
    "El Salvador": {"value":6365503,"year":2025,"code":"SV"},
    "Eq. Guinea": {"value":1938431,"year":2025,"code":"GQ"},
    "Eritrea": {"value":3607003,"year":2025,"code":"ER"},
    "Estonia": {"value":1366475,"year":2025,"code":"EE"},
    "Eswatini": {"value":1256174,"year":2025,"code":"SZ"},
    "Ethiopia": {"value":135472051,"year":2025,"code":"ET"},
    "Faeroe Is.": {"value":54900,"year":2025,"code":"FO"},
    "Fiji": {"value":933154,"year":2025,"code":"FJ"},
    "Finland": {"value":5646436,"year":2025,"code":"FI"},
    "Fr. Polynesia": {"value":282465,"year":2025,"code":"PF"},
    "France": {"value":68720337,"year":2025,"code":"FR"},
    "Gabon": {"value":2593130,"year":2025,"code":"GA"},
    "Gambia": {"value":2822093,"year":2025,"code":"GM"},
    "Georgia": {"value":3935766,"year":2025,"code":"GE"},
    "Germany": {"value":83491249,"year":2025,"code":"DE"},
    "Ghana": {"value":35064272,"year":2025,"code":"GH"},
    "Greece": {"value":10413962,"year":2025,"code":"GR"},
    "Greenland": {"value":56831,"year":2025,"code":"GL"},
    "Grenada": {"value":117303,"year":2025,"code":"GD"},
    "Guam": {"value":168999,"year":2025,"code":"GU"},
    "Guatemala": {"value":18687881,"year":2025,"code":"GT"},
    "Guinea": {"value":15099727,"year":2025,"code":"GN"},
    "Guinea-Bissau": {"value":2249515,"year":2025,"code":"GW"},
    "Guyana": {"value":835986,"year":2025,"code":"GY"},
    "Haiti": {"value":11906095,"year":2025,"code":"HT"},
    "Honduras": {"value":11005850,"year":2025,"code":"HN"},
    "Hong Kong": {"value":7498900,"year":2025,"code":"HK"},
    "Hungary": {"value":9514251,"year":2025,"code":"HU"},
    "Iceland": {"value":392404,"year":2025,"code":"IS"},
    "India": {"value":1463865525,"year":2025,"code":"IN"},
    "Indonesia": {"value":285721236,"year":2025,"code":"ID"},
    "Iran": {"value":92417681,"year":2025,"code":"IR"},
    "Iraq": {"value":47020774,"year":2025,"code":"IQ"},
    "Ireland": {"value":5484367,"year":2025,"code":"IE"},
    "Isle of Man": {"value":84118,"year":2025,"code":"IM"},
    "Israel": {"value":10122800,"year":2025,"code":"IL"},
    "Italy": {"value":58915656,"year":2025,"code":"IT"},
    "Jamaica": {"value":2837077,"year":2025,"code":"JM"},
    "Japan": {"value":123366734,"year":2025,"code":"JP"},
    "Jordan": {"value":11520684,"year":2025,"code":"JO"},
    "Kazakhstan": {"value":20843754,"year":2025,"code":"KZ"},
    "Kenya": {"value":57532493,"year":2025,"code":"KE"},
    "Kiribati": {"value":136488,"year":2025,"code":"KI"},
    "Kosovo": {"value":1576876,"year":2025,"code":"XK"},
    "Kuwait": {"value":4865298,"year":2025,"code":"KW"},
    "Kyrgyzstan": {"value":7343064,"year":2025,"code":"KG"},
    "Laos": {"value":7873046,"year":2025,"code":"LA"},
    "Latvia": {"value":1847785,"year":2025,"code":"LV"},
    "Lebanon": {"value":5849421,"year":2025,"code":"LB"},
    "Lesotho": {"value":2363325,"year":2025,"code":"LS"},
    "Liberia": {"value":5731206,"year":2025,"code":"LR"},
    "Libya": {"value":7458555,"year":2025,"code":"LY"},
    "Liechtenstein": {"value":41024,"year":2025,"code":"LI"},
    "Lithuania": {"value":2888774,"year":2025,"code":"LT"},
    "Luxembourg": {"value":686970,"year":2025,"code":"LU"},
    "Macao": {"value":685900,"year":2025,"code":"MO"},
    "Macedonia": {"value":1820909,"year":2025,"code":"MK"},
    "Madagascar": {"value":32740678,"year":2025,"code":"MG"},
    "Malawi": {"value":22216120,"year":2025,"code":"MW"},
    "Malaysia": {"value":35977838,"year":2025,"code":"MY"},
    "Maldives": {"value":529676,"year":2025,"code":"MV"},
    "Mali": {"value":25198821,"year":2025,"code":"ML"},
    "Malta": {"value":579704,"year":2025,"code":"MT"},
    "Marshall Is.": {"value":36282,"year":2025,"code":"MH"},
    "Mauritania": {"value":5315065,"year":2025,"code":"MR"},
    "Mauritius": {"value":1243741,"year":2025,"code":"MU"},
    "Mexico": {"value":131946900,"year":2025,"code":"MX"},
    "Micronesia": {"value":113683,"year":2025,"code":"FM"},
    "Moldova": {"value":2360527,"year":2025,"code":"MD"},
    "Monaco": {"value":38341,"year":2025,"code":"MC"},
    "Mongolia": {"value":3568978,"year":2025,"code":"MN"},
    "Montenegro": {"value":623129,"year":2025,"code":"ME"},
    "Morocco": {"value":38430770,"year":2025,"code":"MA"},
    "Mozambique": {"value":35631653,"year":2025,"code":"MZ"},
    "Myanmar": {"value":54850648,"year":2025,"code":"MM"},
    "N. Mariana Is.": {"value":43541,"year":2025,"code":"MP"},
    "Namibia": {"value":3092816,"year":2025,"code":"NA"},
    "Nauru": {"value":12025,"year":2025,"code":"NR"},
    "Nepal": {"value":29618118,"year":2025,"code":"NP"},
    "Netherlands": {"value":18087633,"year":2025,"code":"NL"},
    "New Caledonia": {"value":295333,"year":2025,"code":"NC"},
    "New Zealand": {"value":5324700,"year":2025,"code":"NZ"},
    "Nicaragua": {"value":7007502,"year":2025,"code":"NI"},
    "Niger": {"value":27917831,"year":2025,"code":"NE"},
    "Nigeria": {"value":237527782,"year":2025,"code":"NG"},
    "North Korea": {"value":26571036,"year":2025,"code":"KP"},
    "Norway": {"value":5610870,"year":2025,"code":"NO"},
    "Oman": {"value":5494691,"year":2025,"code":"OM"},
    "Pakistan": {"value":255219554,"year":2025,"code":"PK"},
    "Palau": {"value":17663,"year":2025,"code":"PW"},
    "Palestine": {"value":5413596,"year":2025,"code":"PS"},
    "Panama": {"value":4571189,"year":2025,"code":"PA"},
    "Papua New Guinea": {"value":10762817,"year":2025,"code":"PG"},
    "Paraguay": {"value":7013078,"year":2025,"code":"PY"},
    "Peru": {"value":34576665,"year":2025,"code":"PE"},
    "Philippines": {"value":116786962,"year":2025,"code":"PH"},
    "Poland": {"value":36435861,"year":2025,"code":"PL"},
    "Portugal": {"value":10804871,"year":2025,"code":"PT"},
    "Puerto Rico": {"value":3184835,"year":2025,"code":"PR"},
    "Qatar": {"value":2972215,"year":2025,"code":"QA"},
    "Romania": {"value":19020271,"year":2025,"code":"RO"},
    "Russia": {"value":143513328,"year":2025,"code":"RU"},
    "Rwanda": {"value":14569341,"year":2025,"code":"RW"},
    "S. Sudan": {"value":12188788,"year":2025,"code":"SS"},
    "Saint Lucia": {"value":180149,"year":2025,"code":"LC"},
    "Samoa": {"value":219306,"year":2025,"code":"WS"},
    "San Marino": {"value":34109,"year":2025,"code":"SM"},
    "São Tomé and Principe": {"value":240254,"year":2025,"code":"ST"},
    "Saudi Arabia": {"value":36973555,"year":2025,"code":"SA"},
    "Senegal": {"value":18931966,"year":2025,"code":"SN"},
    "Serbia": {"value":6549143,"year":2025,"code":"RS"},
    "Seychelles": {"value":122730,"year":2025,"code":"SC"},
    "Sierra Leone": {"value":8819794,"year":2025,"code":"SL"},
    "Singapore": {"value":6111175,"year":2025,"code":"SG"},
    "Sint Maarten": {"value":43923,"year":2025,"code":"SX"},
    "Slovakia": {"value":5413813,"year":2025,"code":"SK"},
    "Slovenia": {"value":2130986,"year":2025,"code":"SI"},
    "Solomon Is.": {"value":838645,"year":2025,"code":"SB"},
    "Somalia": {"value":19654739,"year":2025,"code":"SO"},
    "South Africa": {"value":64747319,"year":2025,"code":"ZA"},
    "South Korea": {"value":51684564,"year":2025,"code":"KR"},
    "Spain": {"value":49355143,"year":2025,"code":"ES"},
    "Sri Lanka": {"value":21756000,"year":2025,"code":"LK"},
    "St-Martin": {"value":24941,"year":2025,"code":"MF"},
    "St. Kitts and Nevis": {"value":46922,"year":2025,"code":"KN"},
    "St. Vin. and Gren.": {"value":99924,"year":2025,"code":"VC"},
    "Sudan": {"value":51662147,"year":2025,"code":"SD"},
    "Suriname": {"value":639850,"year":2025,"code":"SR"},
    "Sweden": {"value":10596620,"year":2025,"code":"SE"},
    "Switzerland": {"value":9092436,"year":2025,"code":"CH"},
    "Syria": {"value":25620427,"year":2025,"code":"SY"},
    "Tajikistan": {"value":10786734,"year":2025,"code":"TJ"},
    "Tanzania": {"value":70545865,"year":2025,"code":"TZ"},
    "Thailand": {"value":71619863,"year":2025,"code":"TH"},
    "Timor-Leste": {"value":1418517,"year":2025,"code":"TL"},
    "Togo": {"value":8591626,"year":2025,"code":"TG"},
    "Tonga": {"value":103742,"year":2025,"code":"TO"},
    "Trinidad and Tobago": {"value":1367764,"year":2025,"code":"TT"},
    "Tunisia": {"value":12348573,"year":2025,"code":"TN"},
    "Turkey": {"value":85878556,"year":2025,"code":"TR"},
    "Turkmenistan": {"value":7618847,"year":2025,"code":"TM"},
    "Turks and Caicos Is.": {"value":46855,"year":2025,"code":"TC"},
    "U.S. Virgin Is.": {"value":103792,"year":2025,"code":"VI"},
    "Uganda": {"value":51384894,"year":2025,"code":"UG"},
    "Ukraine": {"value":38980376,"year":2025,"code":"UA"},
    "United Arab Emirates": {"value":11513149,"year":2025,"code":"AE"},
    "United Kingdom": {"value":69487000,"year":2025,"code":"GB"},
    "United States of America": {"value":341784857,"year":2025,"code":"US"},
    "Uruguay": {"value":3384688,"year":2025,"code":"UY"},
    "Uzbekistan": {"value":37053428,"year":2025,"code":"UZ"},
    "Vanuatu": {"value":335169,"year":2025,"code":"VU"},
    "Venezuela": {"value":28516896,"year":2025,"code":"VE"},
    "Vietnam": {"value":101598527,"year":2025,"code":"VN"},
    "Yemen": {"value":41773878,"year":2025,"code":"YE"},
    "Zambia": {"value":21913874,"year":2025,"code":"ZM"},
    "Zimbabwe": {"value":16950795,"year":2025,"code":"ZW"},
  };
  // END GENERATED POPULATIONS

  function normalizeSearch(value) {
    return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function getDisplayName(feature) {
    return COUNTRY_DISPLAY_NAMES[feature.properties.name] || feature.properties.name;
  }

  function getFocusCenter(feature) {
    return COUNTRY_FOCUS_CENTERS[feature.properties.name] || window.d3.geoCentroid(feature);
  }

  function countryMatchesQuery(feature, matches) {
    const name = feature.properties.name;
    return [name, getDisplayName(feature), ...(COUNTRY_SEARCH_ALIASES[name] || [])]
      .some((value) => matches(normalizeSearch(value)));
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
    const mobileBreakpointMediaQuery = window.matchMedia("(max-width: 560px)");

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

    // Also update hosts with older embed markup, including the portfolio iframe.
    countrySearchInput.placeholder = "Search countries";
    countrySearchInput.setAttribute("aria-label", "Search countries");
    countrySuggestions.setAttribute("aria-label", "Country suggestions");

    const starsCanvas = document.createElement("canvas");
    starsCanvas.className = "wf-globe-widget__stars";
    starsCanvas.setAttribute("aria-hidden", "true");
    frame.insertBefore(starsCanvas, canvas);
    const starsContext = starsCanvas.getContext("2d");
    let starsDrawn = false;

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
    let hasUserAdjustedZoomSinceCountrySelection = false;
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
    let pendingMobileCountryTap = null;
    let mobileDoubleTapGesture = null;

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

    function updateCountryLabel(name, population = null) {
      countryLabel.textContent = name || "Select a country";
      clearSelectionButton.hidden = !name;
      selectionPanel.classList.toggle("has-population", Boolean(population));
      if (!population) return;

      const sourceUrl = "https://data.worldbank.org/indicator/SP.POP.TOTL?locations=" + encodeURIComponent(population.code);
      const accessiblePopulation = "Population " + fullPopulationFormatter.format(population.value);
      const accessibleLink = "View population data for " + name + " on World Bank (opens in a new tab)";
      countryLabel.innerHTML =
        '<span class="wf-globe-widget__population-details">' +
          '<span class="wf-globe-widget__population-country">' + escapeHtml(name) + '</span>' +
          '<span class="wf-globe-widget__population-value"><span aria-hidden="true">Population ' + populationFormatter.format(population.value) + '</span><span class="wf-globe-widget__sr-only">' + escapeHtml(accessiblePopulation) + '</span></span>' +
        '</span>' +
        '<a class="wf-globe-widget__population-link" href="' + sourceUrl + '" target="_blank" rel="noopener noreferrer" aria-label="' + escapeHtml(accessibleLink) + '"><span class="wf-globe-widget__population-link-text">More info</span>' + EXTERNAL_LINK_ICON + '</a>';
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

    function isMobileBreakpoint() {
      return mobileBreakpointMediaQuery.matches;
    }

    function getDoubleTapDelay(event) {
      if (event.pointerType === "touch" && isMobileBreakpoint()) {
        return MOBILE_DOUBLE_TAP_DELAY;
      }

      if (event.pointerType === "mouse" && !isMobileBreakpoint()) {
        return DESKTOP_DOUBLE_CLICK_DELAY;
      }

      return 0;
    }

    function getCountryBorderWidth(renderSource) {
      if (renderSource.key === "close-detail") {
        return CLOSE_DETAIL_COUNTRY_BORDER_WIDTH;
      }

      if (renderSource.key === "detail") {
        return STANDARD_COUNTRY_BORDER_WIDTH;
      }

      return OVERVIEW_COUNTRY_BORDER_WIDTH;
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

    function drawStars(width, height) {
      if (!starsContext) {
        return;
      }

      // Static sky: a modest resolution cap keeps the extra canvas small.
      const starPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const starWidth = Math.round(width * starPixelRatio);
      const starHeight = Math.round(height * starPixelRatio);

      if (starsDrawn && starsCanvas.width === starWidth && starsCanvas.height === starHeight) {
        return;
      }

      starsCanvas.width = starWidth;
      starsCanvas.height = starHeight;
      starsDrawn = true;
      starsContext.setTransform(starPixelRatio, 0, 0, starPixelRatio, 0, 0);

      let seed = 0x51a7c3e5;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const clusters = [
        [0.12, 0.24, 0.12],
        [0.84, 0.22, 0.1],
        [0.11, 0.75, 0.14],
        [0.88, 0.74, 0.12],
        [0.48, 0.08, 0.16],
      ];
      const starSizeScale = Math.max(0.55, Math.min(1, width / 900));

      function paintStar(x, y, radius, opacity, isBlue, hasHalo) {
        if (x < 0 || x > width || y < 0 || y > height) {
          return;
        }

        const scaledRadius = radius * starSizeScale;
        if (hasHalo) {
          const halo = starsContext.createRadialGradient(x, y, 0, x, y, scaledRadius * 4);
          halo.addColorStop(0, "rgba(170, 211, 255, 0.1)");
          halo.addColorStop(1, "rgba(170, 211, 255, 0)");
          starsContext.fillStyle = halo;
          starsContext.beginPath();
          starsContext.arc(x, y, scaledRadius * 4, 0, Math.PI * 2);
          starsContext.fill();
        }

        starsContext.fillStyle = isBlue
          ? `rgba(151, 199, 242, ${opacity})`
          : `rgba(230, 239, 255, ${opacity})`;
        starsContext.beginPath();
        starsContext.arc(x, y, scaledRadius, 0, Math.PI * 2);
        starsContext.fill();
      }

      const starCount = Math.min(600, Math.round(width * height / 3300));

      for (let index = 0; index < starCount; index += 1) {
        let x = random() * width;
        let y = random() * height;

        if (random() < 0.28) {
          const cluster = clusters[Math.floor(random() * clusters.length)];
          x = (cluster[0] + (random() + random() + random() - 1.5) * cluster[2]) * width;
          y = (cluster[1] + (random() + random() + random() - 1.5) * cluster[2]) * height;
        }

        const brightness = random();
        const isBright = brightness > 0.983;
        const isMedium = brightness > 0.82;
        paintStar(
          x,
          y,
          isBright ? 1.4 + random() * 0.45 : isMedium ? 0.8 + random() * 0.35 : 0.42 + random() * 0.3,
          isBright ? 0.68 + random() * 0.2 : isMedium ? 0.42 + random() * 0.22 : 0.2 + random() * 0.22,
          random() < 0.42,
          isBright,
        );
      }

      // A few brighter, loosely recognizable groupings suggest constellations
      // without drawing artificial connecting lines over the scene.
      const asterisms = [
        [[0.05, 0.34], [0.09, 0.29], [0.13, 0.26], [0.17, 0.24], [0.21, 0.27], [0.2, 0.34], [0.15, 0.35]],
        [[0.81, 0.24], [0.92, 0.27], [0.86, 0.37], [0.88, 0.38], [0.9, 0.39], [0.83, 0.53], [0.94, 0.51]],
      ];
      asterisms.forEach((stars) => {
        stars.forEach(([x, y], index) => {
          paintStar(x * width, y * height, index % 4 === 0 ? 1.45 : 1.05, 0.58, index % 3 === 0, index % 4 === 0);
        });
      });
    }

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect();
      pixelRatio = window.devicePixelRatio || 1;

      drawStars(bounds.width, bounds.height);

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

    function drawSphere(renderContext, renderPath) {
      const ocean = renderContext.createRadialGradient(
        globe.centerX - globe.radius * 0.38,
        globe.centerY - globe.radius * 0.4,
        0,
        globe.centerX + globe.radius * 0.12,
        globe.centerY + globe.radius * 0.16,
        globe.radius * 1.2,
      );

      // One upper-left light: a restrained blue focal highlight falls through
      // rich midtones into ink navy. Avoid opposing gradients that flatten it.
      ocean.addColorStop(0, "#1b6090");
      ocean.addColorStop(0.18, "#144f7b");
      ocean.addColorStop(0.42, "#103f65");
      ocean.addColorStop(0.68, "#0c3556");
      ocean.addColorStop(0.9, "#092b46");
      ocean.addColorStop(1, "#072137");

      renderContext.beginPath();
      renderPath({ type: "Sphere" });
      renderContext.fillStyle = ocean;
      renderContext.fill();

      // Gentle limb darkening adds curvature without washing out the light.
      const shading = renderContext.createRadialGradient(
        globe.centerX,
        globe.centerY,
        globe.radius * 0.55,
        globe.centerX,
        globe.centerY,
        globe.radius,
      );

      shading.addColorStop(0, "rgba(1, 8, 20, 0)");
      shading.addColorStop(0.65, "rgba(1, 8, 20, 0.12)");
      shading.addColorStop(1, "rgba(1, 8, 20, 0.38)");

      renderContext.beginPath();
      renderPath({ type: "Sphere" });
      renderContext.fillStyle = shading;
      renderContext.fill();

      const rim = renderContext.createLinearGradient(
        globe.centerX - globe.radius, globe.centerY - globe.radius,
        globe.centerX + globe.radius, globe.centerY + globe.radius,
      );
      rim.addColorStop(0, "rgba(166, 206, 229, 0.36)");
      rim.addColorStop(0.45, "rgba(108, 158, 190, 0.2)");
      rim.addColorStop(1, "rgba(78, 125, 158, 0.15)");
      renderContext.beginPath();
      renderPath({ type: "Sphere" });
      renderContext.lineWidth = 1.4;
      renderContext.strokeStyle = rim;
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

        drawSphere(staticContext, staticPath);
        staticLayerKey = nextStaticLayerKey;
      }

      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(staticLayerCanvas, 0, 0);
      context.restore();
    }

    function drawGrid(strokeStyle) {
      context.save();
      context.globalCompositeOperation = "soft-light";
      context.beginPath();
      path(graticule);
      context.lineWidth = 0.8;
      context.strokeStyle = strokeStyle;
      context.stroke();
      context.restore();
    }

    function drawWorld() {
      context.save();
      context.beginPath();
      path({ type: "Sphere" });
      context.clip();

      drawGrid("rgba(171, 209, 226, 0.5)");

      const countriesOnFront = getVisibleCountries();
      const renderSource = getRenderGeometrySource();

      context.fillStyle = COUNTRY_FILL;

      for (const country of countriesOnFront.features) {
        fillCountry(country);
      }

      if (hoveredCountry && hoveredCountry !== selectedCountry && isDesktopHoverEnabled()) {
        const hoveredRenderFeature = renderSource.featureByName.get(hoveredCountry.properties.name) || hoveredCountry;

        context.fillStyle = COUNTRY_HOVER_FILL;
        fillCountry(hoveredRenderFeature);
      }

      context.save();
      context.beginPath();
      path(countriesOnFront);
      context.clip("evenodd");
      drawGrid("rgba(181, 211, 204, 0.35)");
      context.restore();

      context.beginPath();
      path(visibleCountryBorderMesh);
      context.lineWidth = getCountryBorderWidth(renderSource);
      context.strokeStyle = COUNTRY_BORDER_STROKE;
      context.stroke();

      if (selectedCountry) {
        const renderSource = getRenderGeometrySource();
        const selectedRenderFeature = renderSource.featureByName.get(selectedCountry.properties.name) || selectedCountry;

        context.fillStyle = SELECTED_COUNTRY_FILL;
        fillCountry(selectedRenderFeature);
        context.beginPath();
        path(selectedRenderFeature);
        context.lineWidth = 1.6;
        context.strokeStyle = SELECTED_COUNTRY_STROKE;
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

        const useSelectedCountryRotation = selectedCountry && !hasUserAdjustedZoomSinceCountrySelection;

        if (selectedCountry && hasUserAdjustedZoomSinceCountrySelection) {
          // User-controlled zoom resumes the normal rotation curve immediately.
          globe.velocityX = getAutoRotationSpeed();
        } else {
          const targetVelocityX = useSelectedCountryRotation
            ? Math.min(SELECTED_COUNTRY_ROTATION_SPEED, getAutoRotationSpeed(globe.targetZoom))
            : getAutoRotationSpeed();
          const rotationEase = useSelectedCountryRotation ? SELECTED_COUNTRY_ROTATION_EASE : 0.02;
          globe.velocityX += (targetVelocityX - globe.velocityX) * getFrameLerpAmount(rotationEase, frameScale);
        }
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
      clearPendingMobileCountryTap();
      cancelMobileDoubleTapGesture();
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
      clearPendingMobileCountryTap();
      cancelMobileDoubleTapGesture();
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
        setTargetZoomFromUser(pointer.pinchStartZoom * (pinchDistance / pointer.pinchStartDistance));
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
      const normalized = normalizeSearch(query);

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
      const nextTargetZoom = clamp(nextZoom, globe.minZoom, globe.maxZoom);
      const hasChanged = nextTargetZoom !== globe.targetZoom;
      globe.targetZoom = nextTargetZoom;
      return hasChanged;
    }

    function setTargetZoomFromUser(nextZoom) {
      if (setTargetZoom(nextZoom) && selectedCountry) {
        hasUserAdjustedZoomSinceCountrySelection = true;
      }
    }

    function zoomBy(delta) {
      const zoomFactor = 1 + Math.abs(delta) * 0.9;
      setTargetZoomFromUser(globe.targetZoom * (delta > 0 ? zoomFactor : 1 / zoomFactor));
    }

    function getCountryFitZoom(feature) {
      if (feature.properties.name === "France" || feature.properties.name === "Netherlands") {
        return DEFAULT_SELECTED_COUNTRY_ZOOM;
      }

      const countryArea = window.d3.geoArea(feature);
      if (Number.isFinite(countryArea) && countryArea <= SMALL_COUNTRY_MAX_ZOOM_AREA) {
        return globe.maxZoom;
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

      // Larger countries retain a fitting or standard 8× view.
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
      if (!selectedCountry) {
        zoomBeforeCountrySelection = globe.targetZoom;
      }

      selectedCountry = feature;
      hasUserAdjustedZoomSinceCountrySelection = false;
      isIntroPitchDriftActive = false;
      globe.yaw = -center[0];
      globe.pitch = clamp(-center[1], -90, 90);
      globe.velocityX = SELECTED_COUNTRY_ROTATION_SPEED;
      globe.velocityY = 0;
      setTargetZoom(getCountryFitZoom(feature));
      countrySearchInput.value = "";
      updateSearchClearButton();
      updateCountryLabel(getDisplayName(feature), COUNTRY_POPULATIONS[feature.properties.name]);
      closeSuggestions();
    }

    function clearSelectedCountry() {
      selectedCountry = null;
      hasUserAdjustedZoomSinceCountrySelection = false;
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
      const normalized = normalizeSearch(name);

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

      const { featureByName } = getRenderGeometrySource();
      return countryFeatures.find((candidate) => window.d3.geoContains(
        featureByName.get(candidate.properties.name) || candidate, coordinates,
      )) || null;
    }

    function updateHoveredCountry(clientX, clientY) {
      const match = getCountryAtPoint(clientX, clientY);
      hoveredCountry = match === selectedCountry ? null : match;
      canvas.classList.toggle("is-country-hovered", Boolean(hoveredCountry));
    }

    function selectCountry(feature) {
      if (!feature || feature === selectedCountry) {
        clearSelectedCountry();
      } else {
        focusOnCountry(feature);
      }
    }

    function selectCountryAtPoint(clientX, clientY) {
      selectCountry(getCountryAtPoint(clientX, clientY));
    }

    function clearPendingMobileCountryTap() {
      if (!pendingMobileCountryTap) {
        return;
      }

      window.clearTimeout(pendingMobileCountryTap.timeoutId);
      pendingMobileCountryTap = null;
    }

    function setPageTextSelectionSuppressed(isSuppressed) {
      document.documentElement.classList.toggle("wf-globe-widget--touch-gesture-active", isSuppressed);
    }

    function preventNativeTouchSelection(event) {
      if (document.documentElement.classList.contains("wf-globe-widget--touch-gesture-active")) {
        event.preventDefault();
      }
    }

    function beginMobileDoubleTapGesture(event) {
      const previousTap = pendingMobileCountryTap;
      const doubleTapDelay = getDoubleTapDelay(event);

      if (!doubleTapDelay || !previousTap) {
        return false;
      }

      const elapsed = performance.now() - previousTap.timestamp;
      const distance = Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y);

      if (elapsed > doubleTapDelay || distance > MOBILE_DOUBLE_TAP_MAX_DISTANCE) {
        return false;
      }

      clearPendingMobileCountryTap();
      mobileDoubleTapGesture = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startZoom: globe.targetZoom,
        hasDragged: false,
        suppressesTextSelection: event.pointerType === "touch",
      };
      canvas.setPointerCapture(event.pointerId);
      updatePointerState(true);
      // iOS can start native text selection before a drag crosses our threshold.
      // Only suppress it for a touch-based potential double-tap hold, never a single tap.
      if (mobileDoubleTapGesture.suppressesTextSelection) {
        setPageTextSelectionSuppressed(true);
      }
      event.preventDefault();
      return true;
    }

    function updateMobileDoubleTapGesture(event) {
      const gesture = mobileDoubleTapGesture;

      if (!gesture || event.pointerId !== gesture.pointerId) {
        return false;
      }

      const verticalDistance = event.clientY - gesture.startY;

      if (Math.abs(verticalDistance) > DRAG_THRESHOLD) {
        gesture.hasDragged = true;
        setTargetZoomFromUser(gesture.startZoom * Math.exp(verticalDistance / MOBILE_DOUBLE_TAP_DRAG_ZOOM_DISTANCE));
      }

      event.preventDefault();
      return true;
    }

    function endMobileDoubleTapGesture(event, isCancelled = false) {
      const gesture = mobileDoubleTapGesture;

      if (!gesture || event.pointerId !== gesture.pointerId) {
        return false;
      }

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      mobileDoubleTapGesture = null;
      updatePointerState(false);
      if (gesture.suppressesTextSelection) {
        setPageTextSelectionSuppressed(false);
      }

      if (!isCancelled && !gesture.hasDragged) {
        zoomBy(0.75);
      }

      event.preventDefault();
      return true;
    }

    function cancelMobileDoubleTapGesture() {
      const gesture = mobileDoubleTapGesture;

      if (!gesture) {
        return;
      }

      if (canvas.hasPointerCapture(gesture.pointerId)) {
        canvas.releasePointerCapture(gesture.pointerId);
      }

      mobileDoubleTapGesture = null;
      updatePointerState(false);
      if (gesture.suppressesTextSelection) {
        setPageTextSelectionSuppressed(false);
      }
    }

    function handleTap(event) {
      const doubleTapDelay = getDoubleTapDelay(event);

      if (!doubleTapDelay) {
        selectCountryAtPoint(event.clientX, event.clientY);
        return;
      }

      const now = performance.now();
      const previousTap = pendingMobileCountryTap;
      const tappedCountry = getCountryAtPoint(event.clientX, event.clientY);

      if (previousTap) {
        const elapsed = now - previousTap.timestamp;
        const distance = Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y);

        if (elapsed <= doubleTapDelay && distance <= MOBILE_DOUBLE_TAP_MAX_DISTANCE) {
          clearPendingMobileCountryTap();
          zoomBy(0.75);
          return;
        }

        clearPendingMobileCountryTap();
        selectCountry(previousTap.country);
      }

      const tap = {
        x: event.clientX,
        y: event.clientY,
        timestamp: now,
        country: tappedCountry,
        timeoutId: 0,
      };

      tap.timeoutId = window.setTimeout(() => {
        if (pendingMobileCountryTap !== tap) {
          return;
        }

        pendingMobileCountryTap = null;
        selectCountry(tap.country);
      }, doubleTapDelay);
      pendingMobileCountryTap = tap;
    }

function onPointerDown(event) {
  if (event.pointerType === "touch") {
    event.preventDefault();
  }

  if (beginMobileDoubleTapGesture(event)) {
    return;
  }

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
  if (updateMobileDoubleTapGesture(event)) {
    return;
  }

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
      setTargetZoomFromUser(pointer.pinchStartZoom * (pinchDistance / pointer.pinchStartDistance));
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
  if (endMobileDoubleTapGesture(event)) {
    return;
  }

  const wasTap = pointer.dragging && !pointer.moved && pointer.activePointers.size === 1 && pointer.activePointers.has(event.pointerId);

  pointer.activePointers.delete(event.pointerId);

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (wasTap) {
    handleTap(event);
  }

  if (!pointer.activePointers.size) {
    pointer.pinching = false;
    updatePointerState(false);
    setPageTextSelectionSuppressed(false);
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
  if (endMobileDoubleTapGesture(event, true)) {
    return;
  }

  pointer.activePointers.delete(event.pointerId);

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (!pointer.activePointers.size) {
    pointer.pinching = false;
    updatePointerState(false);
    setPageTextSelectionSuppressed(false);
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

      dismissSearchKeyboard();
    }

    function dismissSearchKeyboard() {
      if (!isMobileBreakpoint()) {
        return;
      }

      countrySearchInput.blur();
      window.requestAnimationFrame(() => countrySearchInput.blur());
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
        dismissSearchKeyboard();
      }
    }

    function onSuggestionClick(event) {
      selectSuggestionFromEvent(event);
    }

    function selectSuggestionFromEvent(event) {
      const suggestionButton = event.target.closest(".wf-globe-widget__suggestion");

      if (!suggestionButton) {
        return;
      }

      const index = Number(suggestionButton.dataset.index);
      const match = suggestionMatches[index];

      if (match) {
        focusOnCountry(match);
        dismissSearchKeyboard();
      }
    }

    function onSuggestionPointerUp(event) {
      if (event.pointerType !== "touch" || !isMobileBreakpoint()) {
        return;
      }

      event.preventDefault();
      selectSuggestionFromEvent(event);
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
    canvas.addEventListener("selectstart", (event) => event.preventDefault());
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    document.addEventListener("selectstart", (event) => {
      if (document.documentElement.classList.contains("wf-globe-widget--touch-gesture-active")) {
        event.preventDefault();
      }
    }, true);
    document.addEventListener("touchstart", preventNativeTouchSelection, { capture: true, passive: false });
    document.addEventListener("touchmove", preventNativeTouchSelection, { capture: true, passive: false });
    canvas.addEventListener("wheel", onWheel, { passive: false });
    zoomInButton.addEventListener("click", () => zoomBy(0.75));
    zoomOutButton.addEventListener("click", () => zoomBy(-0.75));
    clearSelectionButton.addEventListener("click", clearSelectedCountry);
    selectionPanel.addEventListener("click", (event) => {
      if (!clearSelectionButton.hidden && !event.target.closest("a, button")) {
        clearSelectedCountry();
      }
    });
    countrySearchClearButton.addEventListener("click", clearSearchInput);
    countrySearchForm.addEventListener("submit", onCountrySearch);
    countrySuggestions.addEventListener("pointerup", onSuggestionPointerUp);
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
