import { readFile, writeFile, rename, rm } from "node:fs/promises";

// Topology names that differ from the World Bank Country API names.
const worldBankNames = {
  "Antigua and Barb.": "Antigua and Barbuda",
  Bahamas: "Bahamas, The",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  Brunei: "Brunei Darussalam",
  "Cayman Is.": "Cayman Islands",
  "Central African Rep.": "Central African Republic",
  Congo: "Congo, Rep.",
  "Curaçao": "Curacao",
  "Côte d'Ivoire": "Cote d'Ivoire",
  "Dem. Rep. Congo": "Congo, Dem. Rep.",
  "Dominican Rep.": "Dominican Republic",
  Egypt: "Egypt, Arab Rep.",
  "Eq. Guinea": "Equatorial Guinea",
  "Faeroe Is.": "Faroe Islands",
  "Fr. Polynesia": "French Polynesia",
  "Hong Kong": "Hong Kong SAR, China",
  Macao: "Macao SAR, China",
  Palestine: "West Bank and Gaza",
  "Sint Maarten": "Sint Maarten (Dutch part)",
  "St-Martin": "St. Martin (French part)",
  Gambia: "Gambia, The",
  Iran: "Iran, Islamic Rep.",
  Kyrgyzstan: "Kyrgyz Republic",
  Laos: "Lao PDR",
  "Marshall Is.": "Marshall Islands",
  Micronesia: "Micronesia, Fed. Sts.",
  "N. Mariana Is.": "Northern Mariana Islands",
  Nauru: "Naoero",
  "North Korea": "Korea, Dem. People's Rep.",
  Macedonia: "North Macedonia",
  "Puerto Rico": "Puerto Rico (US)",
  Russia: "Russian Federation",
  "S. Sudan": "South Sudan",
  "São Tomé and Principe": "Sao Tome and Principe",
  Slovakia: "Slovak Republic",
  "Solomon Is.": "Solomon Islands",
  Somalia: "Somalia, Fed. Rep.",
  "South Korea": "Korea, Rep.",
  "St. Vin. and Gren.": "St. Vincent and the Grenadines",
  "Saint Lucia": "St. Lucia",
  Syria: "Syrian Arab Republic",
  Turkey: "Turkiye",
  "Turks and Caicos Is.": "Turks and Caicos Islands",
  "U.S. Virgin Is.": "Virgin Islands (U.S.)",
  "United States of America": "United States",
  Venezuela: "Venezuela, RB",
  Vietnam: "Viet Nam",
  "W. Sahara": "Western Sahara",
  Yemen: "Yemen, Rep.",
  "British Virgin Is.": "British Virgin Islands",
};

// Fetch every page before touching the checked-in snapshot.
async function fetchRows(endpoint) {
  const url = new URL(endpoint, "https://api.worldbank.org/v2/");
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "400");
  const rows = [];
  let pages = 1;
  let expectedTotal;
  for (let page = 1; page <= pages; page += 1) {
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`World Bank request failed: ${response.status}`);
    const payload = await response.json();
    const [meta, records] = Array.isArray(payload) ? payload : [];
    if (!Number.isInteger(meta?.pages) || meta.pages < 1 || !Number.isInteger(meta.total) || !Array.isArray(records)) {
      throw new Error("Invalid World Bank response; existing snapshot preserved.");
    }
    if (expectedTotal !== undefined && expectedTotal !== meta.total) {
      throw new Error("World Bank data changed during pagination; retry the refresh.");
    }
    pages = meta.pages;
    expectedTotal = meta.total;
    rows.push(...records);
  }
  if (!rows.length || rows.length !== expectedTotal) throw new Error("Incomplete World Bank response.");
  return rows;
}

const root = new URL("../", import.meta.url);
const widgetUrl = new URL("globe-widget.js", root);
const topology = JSON.parse(await readFile(new URL("countries-50m.json", root), "utf8"));
const [countries, observations] = await Promise.all([
  fetchRows("country"),
  fetchRows("country/all/indicator/SP.POP.TOTL?mrnev=1&source=2"),
]);
const byName = new Map(countries.filter((country) => country.region?.id !== "NA")
  .map((country) => [country.name, country]));
const countryCodeBySource = new Map([...byName.values()].map((country) => [country.iso2Code, country.id]));
const byCode = new Map();
for (const row of observations) {
  const countryCode = countryCodeBySource.get(row.country?.id);
  if (!countryCode || row.value === null) continue;
  if (!Number.isSafeInteger(row.value) || row.value < 0 || !/^\d{4}$/.test(row.date) || row.countryiso3code !== countryCode) {
    throw new Error("Invalid population observation; existing snapshot preserved.");
  }
  const previous = byCode.get(row.countryiso3code);
  if (!previous || Number(row.date) > Number(previous.date)) byCode.set(row.countryiso3code, row);
}
const populations = {};
const missing = [];
for (const geometry of topology.objects.countries.geometries) {
  const mapName = geometry.properties.name;
  const country = byName.get(worldBankNames[mapName] || mapName);
  const row = country && byCode.get(country.id);
  if (!row) {
    missing.push(mapName);
    continue;
  }
  if (!/^[A-Z0-9]{2}$/.test(country.iso2Code)) throw new Error(`Invalid source code for ${mapName}`);
  populations[mapName] = { value: row.value, year: Number(row.date), code: country.iso2Code };
}
const entries = Object.entries(populations).sort(([a], [b]) => a.localeCompare(b, "en"));
if (!entries.length) throw new Error("No countries matched; existing snapshot preserved.");

const startMarker = "  // BEGIN GENERATED POPULATIONS";
const endMarker = "  // END GENERATED POPULATIONS";
const widget = await readFile(widgetUrl, "utf8");
const start = widget.indexOf(startMarker);
const end = widget.indexOf(endMarker);
if (start < 0 || end < start) throw new Error("Population markers missing from globe-widget.js");
const generated = [
  startMarker,
  "  // World Bank SP.POP.TOTL, latest non-empty values. Refresh: node scripts/update-population.mjs",
  "  // CC BY 4.0; source and methodology: https://data.worldbank.org/indicator/SP.POP.TOTL",
  "  const COUNTRY_POPULATIONS = {",
  ...entries.map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)},`),
  "  };",
  endMarker,
].join("\n");
const updated = widget.slice(0, start) + generated + widget.slice(end + endMarker.length);
if (updated !== widget) {
  const temporaryUrl = new URL(`globe-widget.js.population-${process.pid}.tmp`, root);
  try {
    await writeFile(temporaryUrl, updated, { flag: "wx" });
    await rename(temporaryUrl, widgetUrl);
  } finally {
    await rm(temporaryUrl, { force: true });
  }
}
console.log(`Updated ${entries.length} populations; ${missing.length} map areas have no population data.`);
console.log(`Without data: ${missing.join(", ")}`);
