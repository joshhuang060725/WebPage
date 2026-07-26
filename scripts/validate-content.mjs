import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dataDir = resolve(root, "data");
const languages = ["en", "zh-TW", "zh-CN"];
const errors = [];
const parsed = {};

for (const name of readdirSync(dataDir).filter((name) => name.endsWith(".json"))) {
  try {
    parsed[name] = JSON.parse(readFileSync(resolve(dataDir, name), "utf8"));
  } catch (error) {
    errors.push(`${name}: invalid JSON (${error.message})`);
  }
}

function walk(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  const present = languages.filter((language) => language in value);
  if (present.length > 0 && present.length !== languages.length) {
    errors.push(`${path}: localized value is missing ${languages.filter((language) => !present.includes(language)).join(", ")}`);
  }
  Object.entries(value).forEach(([key, child]) => walk(child, `${path}.${key}`));
}

Object.entries(parsed).forEach(([name, value]) => walk(value, name));

function uniqueIds(items, label) {
  const seen = new Set();
  for (const item of items || []) {
    if (!item.id) errors.push(`${label}: item is missing id`);
    else if (seen.has(item.id)) errors.push(`${label}: duplicate id "${item.id}"`);
    else seen.add(item.id);
  }
}

uniqueIds(parsed["projects.json"], "projects.json");
uniqueIds(parsed["tools.json"], "tools.json");
uniqueIds(parsed["files.json"], "files.json");
uniqueIds(parsed["formulas.json"]?.items, "formulas.json");

const finance = parsed["finance.json"];
if (!finance) {
  errors.push("finance.json: missing finance content registry");
} else {
  const requiredSections = ["overview", "us", "hk", "cn", "tw", "sg", "fx", "sources"];
  for (const section of requiredSections) {
    if (!(section in finance)) errors.push(`finance.json: missing "${section}" section`);
  }

  if (finance.schemaVersion !== 1) {
    errors.push("finance.json: schemaVersion must be 1");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(finance.lastReviewedAt || ""))) {
    errors.push("finance.json: lastReviewedAt must use YYYY-MM-DD");
  }

  uniqueIds(finance.sources, "finance.json.sources");
  const sourceIds = new Set((finance.sources || []).map((source) => source.id).filter(Boolean));
  const requiredSourceIds = [
    "us-treasury",
    "us-bls",
    "us-fed",
    "hk-hkma",
    "hk-census",
    "cn-nbs",
    "cn-pbc",
    "cn-sse",
    "cn-szse",
    "tw-twse",
    "tw-cbc",
    "tw-dgbas",
    "sg-singstat",
    "sg-mas",
    "sg-sgx",
    "frankfurter",
    "fawaz-currency-api",
    "tradingview"
  ];
  for (const sourceId of requiredSourceIds) {
    if (!sourceIds.has(sourceId)) errors.push(`finance.json.sources: missing required source "${sourceId}"`);
  }

  const allowedSourceModes = new Set(["api", "official-download", "official-snapshot", "external-widget"]);
  for (const source of finance.sources || []) {
    if (!allowedSourceModes.has(source.accessMode)) {
      errors.push(`finance.json.sources.${source.id}: invalid accessMode "${source.accessMode}"`);
    }
    if (source.apiKeyRequired !== false) {
      errors.push(`finance.json.sources.${source.id}: apiKeyRequired must be false`);
    }
    const links = [source.url, ...(source.links || []).map((link) => link.url)];
    for (const url of links) {
      try {
        if (new URL(url).protocol !== "https:") throw new Error("not HTTPS");
      } catch {
        errors.push(`finance.json.sources.${source.id}: invalid HTTPS source URL "${url}"`);
      }
    }
    if (source.region === "cn" && source.accessMode !== "official-snapshot") {
      errors.push(`finance.json.sources.${source.id}: Mainland China sources must remain official-snapshot`);
    }
  }

  const regionIds = ["us", "hk", "cn", "tw", "sg"];
  const requiredCategories = ["market", "fx", "rates"];
  const allowedAvailability = new Set(["direct", "official-snapshot", "external-widget"]);
  const indicatorIds = new Set();
  const referencedSourceIds = new Set();

  for (const regionId of regionIds) {
    const region = finance[regionId];
    if (!region || region.id !== regionId) {
      errors.push(`finance.json.${regionId}: missing region or mismatched id`);
      continue;
    }
    if (!Array.isArray(region.indicators)) {
      errors.push(`finance.json.${regionId}: indicators must be an array`);
      continue;
    }
    const categories = new Set(region.indicators.map((indicator) => indicator.category));
    for (const category of requiredCategories) {
      if (!categories.has(category)) errors.push(`finance.json.${regionId}: missing "${category}" indicator`);
    }
    if (region.indicators.filter((indicator) => indicator.category === "macro").length < 2) {
      errors.push(`finance.json.${regionId}: expected at least two macro indicators`);
    }

    for (const indicator of region.indicators) {
      if (!indicator.id) {
        errors.push(`finance.json.${regionId}: indicator is missing id`);
      } else if (indicatorIds.has(indicator.id)) {
        errors.push(`finance.json: duplicate indicator id "${indicator.id}"`);
      } else {
        indicatorIds.add(indicator.id);
      }
      if (!sourceIds.has(indicator.sourceId)) {
        errors.push(`finance.json.${regionId}.${indicator.id}: unknown sourceId "${indicator.sourceId}"`);
      } else {
        referencedSourceIds.add(indicator.sourceId);
      }
      if (!allowedAvailability.has(indicator.availability)) {
        errors.push(`finance.json.${regionId}.${indicator.id}: invalid availability "${indicator.availability}"`);
      }
      if (regionId === "cn" && indicator.availability !== "official-snapshot") {
        errors.push(`finance.json.${regionId}.${indicator.id}: Mainland China indicators must remain official-snapshot`);
      }
      if ("value" in indicator && !/^\d{4}-\d{2}-\d{2}$/.test(String(indicator.asOf || ""))) {
        errors.push(`finance.json.${regionId}.${indicator.id}: a stored value requires an asOf date`);
      }
    }
  }

  for (const indicatorId of finance.overview?.headlineIndicatorIds || []) {
    if (!indicatorIds.has(indicatorId)) {
      errors.push(`finance.json.overview: unknown headline indicator "${indicatorId}"`);
    }
  }

  const currencyCodes = new Set((finance.fx?.supportedCurrencies || []).map((currency) => currency.code));
  if (!currencyCodes.has(finance.fx?.baseCurrency)) {
    errors.push("finance.json.fx: baseCurrency must be included in supportedCurrencies");
  }
  uniqueIds(finance.fx?.pairs, "finance.json.fx.pairs");
  for (const pair of finance.fx?.pairs || []) {
    if (!currencyCodes.has(pair.base) || !currencyCodes.has(pair.quote)) {
      errors.push(`finance.json.fx.${pair.id}: base and quote must be supported currencies`);
    }
    if (!sourceIds.has(pair.sourceId)) {
      errors.push(`finance.json.fx.${pair.id}: unknown sourceId "${pair.sourceId}"`);
    } else {
      referencedSourceIds.add(pair.sourceId);
    }
  }

  for (const sourceId of sourceIds) {
    if (!referencedSourceIds.has(sourceId)) {
      errors.push(`finance.json.sources.${sourceId}: source is not referenced by any indicator or FX pair`);
    }
  }
}

for (const file of parsed["files.json"] || []) {
  if (file.storage_provider === "git") {
    const path = String(file.storage_key || file.path || "").replace(/^\/+/, "");
    if (!existsSync(resolve(root, path))) errors.push(`files.json: missing Git asset ${path}`);
  }
}
for (const wallpaper of parsed["wallpapers.json"]?.backgrounds || []) {
  const path = String(wallpaper.src || "").replace(/^\/+/, "");
  if (path && !existsSync(resolve(root, path))) errors.push(`wallpapers.json: missing asset ${path}`);
}

if (parsed["formulas.json"]?.items?.length !== 20) {
  errors.push("formulas.json: expected 20 formula modules");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validated ${Object.keys(parsed).length} JSON files, localized fields, IDs, and local assets.`);
