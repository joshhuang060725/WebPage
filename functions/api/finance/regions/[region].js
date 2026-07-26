import {
  CACHE_SECONDS,
  REGION_DEFINITIONS,
  errorResponse,
  fetchJsonWithTimeout,
  fetchTextWithTimeout,
  guardReadOnly,
  normalizeRegion,
  successResponse
} from "../_shared.js";

const ENDPOINT = "/api/finance/regions/[region]";
const SOURCE_URLS = Object.freeze({
  "us-treasury": "https://home.treasury.gov/treasury-daily-interest-rate-xml-feed",
  "us-bls": "https://www.bls.gov/developers/",
  "hk-hkma": "https://apidocs.hkma.gov.hk/",
  "tw-twse": "https://openapi.twse.com.tw/",
  "sg-singstat": "https://tablebuilder.singstat.gov.sg/view-api/for-developers"
});

const SOURCE_META = Object.freeze({
  "us-treasury": {
    id: "us-treasury",
    category: "rates",
    name: "U.S. Department of the Treasury",
    url: SOURCE_URLS["us-treasury"],
    integrationMode: "official-api"
  },
  "us-bls": {
    id: "us-bls",
    category: "macro",
    name: "U.S. Bureau of Labor Statistics",
    url: SOURCE_URLS["us-bls"],
    integrationMode: "official-api"
  },
  "hk-hkma": {
    id: "hk-hkma",
    category: "rates-and-fx",
    name: "Hong Kong Monetary Authority",
    url: SOURCE_URLS["hk-hkma"],
    integrationMode: "official-api"
  },
  "tw-twse": {
    id: "tw-twse",
    category: "market",
    name: "Taiwan Stock Exchange",
    url: SOURCE_URLS["tw-twse"],
    integrationMode: "official-api"
  },
  "sg-singstat": {
    id: "sg-singstat",
    category: "macro",
    name: "Singapore Department of Statistics",
    url: SOURCE_URLS["sg-singstat"],
    integrationMode: "official-api"
  }
});

function number(value) {
  const normalized = String(value ?? "").replaceAll(",", "").trim();
  if (!normalized || /^(?:-|--|na|n\/a|null)$/i.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toPrecision(12)) : null;
}

function positive(value) {
  const parsed = number(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function movement(value, previousValue) {
  if (value === null || previousValue === null) {
    return { previousValue: previousValue ?? null, change: null, changePercent: null };
  }
  const change = value - previousValue;
  return {
    previousValue,
    change,
    changePercent: previousValue === 0 ? null : (change / Math.abs(previousValue)) * 100
  };
}

function statusFor(asOf, frequency) {
  const timestamp = Date.parse(asOf);
  if (!Number.isFinite(timestamp)) return "unavailable";
  const days = Math.max(0, (Date.now() - timestamp) / 86400000);
  const windows = {
    daily: [4, 10],
    "business-daily": [4, 10],
    monthly: [70, 100]
  };
  const [fresh, delayed] = windows[frequency] || [120, 180];
  if (days <= fresh) return "fresh";
  if (days <= delayed) return "delayed";
  return "stale";
}

function item({
  id,
  region,
  category,
  value,
  unit,
  asOf,
  frequency,
  sourceId,
  previousValue = null,
  change = null,
  changePercent = null
}) {
  return {
    id,
    region,
    category,
    value,
    unit,
    asOf,
    fetchedAt: new Date().toISOString(),
    frequency,
    status: value === null ? "unavailable" : statusFor(asOf, frequency),
    sourceId,
    sourceUrl: SOURCE_URLS[sourceId],
    sourceMode: "official-api",
    previousValue,
    change,
    changePercent
  };
}

function xmlTag(block, name) {
  const match = block.match(new RegExp(`<${name}>([^<]*)</${name}>`, "i"));
  return match?.[1]?.trim() || null;
}

function treasuryDate(value) {
  const match = String(value || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

async function unitedStatesItems() {
  const tasks = await Promise.allSettled([
    fetchTextWithTimeout("https://home.treasury.gov/sites/default/files/interest-rates/yield.xml"),
    fetchJsonWithTimeout("https://api.bls.gov/publicAPI/v1/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesid: ["CUUR0000SA0", "LNS14000000"] })
    })
  ]);
  const items = [];

  if (tasks[0].status === "fulfilled") {
    const blocks = [...tasks[0].value.matchAll(/<G_NEW_DATE>([\s\S]*?)<\/G_NEW_DATE>/gi)]
      .map((match) => match[1])
      .filter((block) => xmlTag(block, "BC_2YEAR") && xmlTag(block, "BC_10YEAR"));
    const latest = blocks.at(-1);
    const previous = blocks.at(-2);
    const asOf = treasuryDate(xmlTag(latest || "", "NEW_DATE"));

    for (const [id, tag] of [
      ["us-treasury-2y", "BC_2YEAR"],
      ["us-treasury-10y", "BC_10YEAR"]
    ]) {
      const value = positive(xmlTag(latest || "", tag));
      const previousValue = positive(xmlTag(previous || "", tag));
      if (value === null || !asOf) continue;
      items.push(
        item({
          id,
          region: "us",
          category: "rates",
          value,
          unit: "percent",
          asOf,
          frequency: "business-daily",
          sourceId: "us-treasury",
          ...movement(value, previousValue)
        })
      );
    }
  }

  if (tasks[1].status === "fulfilled" && tasks[1].value?.status === "REQUEST_SUCCEEDED") {
    const series = tasks[1].value?.Results?.series || [];
    for (const definition of [
      { id: "us-cpi-u", seriesId: "CUUR0000SA0", unit: "index-1982-1984-100" },
      { id: "us-unemployment-rate", seriesId: "LNS14000000", unit: "percent" }
    ]) {
      const rows = series.find((entry) => entry.seriesID === definition.seriesId)?.data || [];
      const latest = rows.find((row) => /^M(0[1-9]|1[0-2])$/.test(row.period));
      const previous = rows.filter((row) => /^M(0[1-9]|1[0-2])$/.test(row.period))[1];
      const value = number(latest?.value);
      const previousValue = number(previous?.value);
      const month = latest?.period?.slice(1);
      const asOf = latest?.year && month ? `${latest.year}-${month}-01` : null;
      if (value === null || !asOf) continue;
      items.push(
        item({
          id: definition.id,
          region: "us",
          category: "macro",
          value,
          unit: definition.unit,
          asOf,
          frequency: "monthly",
          sourceId: "us-bls",
          ...movement(value, previousValue)
        })
      );
    }
  }

  return items;
}

function hkmaRecords(payload) {
  return payload?.header?.success === true && Array.isArray(payload?.result?.records)
    ? payload.result.records
    : [];
}

async function hongKongItems() {
  const tasks = await Promise.allSettled([
    fetchJsonWithTimeout(
      "https://api.hkma.gov.hk/public/market-data-and-statistics/daily-monetary-statistics/daily-figures-interbank-liquidity?offset=0"
    ),
    fetchJsonWithTimeout(
      "https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?offset=0"
    )
  ]);
  const items = [];

  if (tasks[0].status === "fulfilled") {
    const records = hkmaRecords(tasks[0].value);
    const latest = records[0];
    const previous = records[1];
    for (const definition of [
      { id: "hk-base-rate", field: "disc_win_base_rate", frequency: "event-driven" },
      { id: "hk-hibor-1m", field: "hibor_fixing_1m", frequency: "business-daily" }
    ]) {
      const value = positive(latest?.[definition.field]);
      const previousValue = positive(previous?.[definition.field]);
      if (value === null || !latest?.end_of_date) continue;
      items.push(
        item({
          id: definition.id,
          region: "hk",
          category: "rates",
          value,
          unit: "percent",
          asOf: latest.end_of_date,
          frequency: definition.frequency,
          sourceId: "hk-hkma",
          ...movement(value, previousValue)
        })
      );
    }
  }

  if (tasks[1].status === "fulfilled") {
    const records = hkmaRecords(tasks[1].value);
    const value = positive(records[0]?.usd);
    const previousValue = positive(records[1]?.usd);
    if (value !== null && records[0]?.end_of_day) {
      items.push(
        item({
          id: "hk-usd-hkd-reference",
          region: "hk",
          category: "fx",
          value,
          unit: "HKD-per-USD",
          asOf: records[0].end_of_day,
          frequency: "business-daily",
          sourceId: "hk-hkma",
          ...movement(value, previousValue)
        })
      );
    }
  }

  return items;
}

function rocDate(value) {
  const match = String(value || "").match(/^(\d{3})(\d{2})(\d{2})$/);
  if (!match) return null;
  return `${Number(match[1]) + 1911}-${match[2]}-${match[3]}`;
}

async function taiwanItems() {
  const payload = await fetchJsonWithTimeout(
    "https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX"
  );
  if (!Array.isArray(payload)) return [];
  const items = [];

  for (const definition of [
    { id: "tw-taiex", label: "發行量加權股價指數" },
    { id: "tw-taiwan-50", label: "臺灣50指數" }
  ]) {
    const row = payload.find((entry) => entry?.["指數"] === definition.label);
    const value = positive(row?.["收盤指數"]);
    const asOf = rocDate(row?.["日期"]);
    if (value === null || !asOf) continue;
    const direction = row?.["漲跌"] === "-" ? -1 : 1;
    const change = number(row?.["漲跌點數"]);
    const changePercent = number(row?.["漲跌百分比"]);
    items.push(
      item({
        id: definition.id,
        region: "tw",
        category: "market",
        value,
        unit: "index-points",
        asOf,
        frequency: "business-daily",
        sourceId: "tw-twse",
        change: change === null ? null : direction * Math.abs(change),
        changePercent: changePercent === null ? null : direction * Math.abs(changePercent)
      })
    );
  }

  return items;
}

function singStatDate(value) {
  const label = String(value || "").trim();
  const monthly = label.match(/^(\d{4})\s+([A-Za-z]{3})$/);
  if (monthly) {
    const months = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12"
    };
    const month = months[monthly[2]];
    return month ? `${monthly[1]}-${month}-01` : null;
  }

  const quarterly = label.match(/^(\d{4})\s+([1-4])Q$/i);
  if (!quarterly) return null;
  const quarterEnds = {
    1: "03-31",
    2: "06-30",
    3: "09-30",
    4: "12-31"
  };
  return `${quarterly[1]}-${quarterEnds[quarterly[2]]}`;
}

function singStatColumns(payload) {
  const columns = payload?.Data?.row?.[0]?.columns;
  return Array.isArray(columns) ? columns : [];
}

async function singaporeItems() {
  const definitions = [
    {
      id: "sg-consumer-price-index",
      url:
        "https://tablebuilder.singstat.gov.sg/api/table/tabledata/M213751" +
        "?seriesNoORrowNo=1&sortBy=key%20desc",
      unit: "index-2024-100",
      frequency: "monthly"
    },
    {
      id: "sg-real-gdp-growth",
      url:
        "https://tablebuilder.singstat.gov.sg/api/table/tabledata/M015631" +
        "?seriesNoORrowNo=2&sortBy=key%20desc",
      unit: "percent-year-on-year",
      frequency: "quarterly"
    },
    {
      id: "sg-unemployment-rate",
      url:
        "https://tablebuilder.singstat.gov.sg/api/table/tabledata/M182342" +
        "?seriesNoORrowNo=2&sortBy=key%20desc",
      unit: "percent",
      frequency: "quarterly"
    }
  ];
  const tasks = await Promise.allSettled(
    definitions.map((definition) => fetchJsonWithTimeout(definition.url))
  );
  const items = [];

  for (const [index, task] of tasks.entries()) {
    if (task.status !== "fulfilled") continue;
    const columns = singStatColumns(task.value);
    const latest = columns[0];
    const previous = columns[1];
    const value = number(latest?.value);
    const previousValue = number(previous?.value);
    const asOf = singStatDate(latest?.key);
    if (value === null || !asOf) continue;

    const definition = definitions[index];
    items.push(
      item({
        id: definition.id,
        region: "sg",
        category: "macro",
        value,
        unit: definition.unit,
        asOf,
        frequency: definition.frequency,
        sourceId: "sg-singstat",
        ...movement(value, previousValue)
      })
    );
  }

  return items;
}

async function regionalItems(regionId) {
  if (regionId === "us") return unitedStatesItems();
  if (regionId === "hk") return hongKongItems();
  if (regionId === "tw") return taiwanItems();
  if (regionId === "sg") return singaporeItems();
  return [];
}

function dateCoverage(items) {
  const dates = [...new Set(items.map((entry) => entry.asOf).filter(Boolean))].sort();
  return {
    common: dates.length === 1 ? dates[0] : null,
    earliest: dates.at(0) || null,
    latest: dates.at(-1) || null
  };
}

export async function onRequest(context) {
  const guarded = guardReadOnly(context.request, ENDPOINT);
  if (guarded) return guarded;

  const regionId = normalizeRegion(context.params?.region);
  if (!regionId) {
    return errorResponse({
      endpoint: ENDPOINT,
      code: "region_not_found",
      message: "The requested finance region is not supported.",
      status: 404
    });
  }

  const region = REGION_DEFINITIONS[regionId];
  let items = [];
  try {
    items = await regionalItems(regionId);
  } catch {
    items = [];
  }

  const hasReviewedAdapter = regionId !== "cn";
  if (hasReviewedAdapter && items.length === 0) {
    return errorResponse({
      endpoint: ENDPOINT,
      code: "region_upstream_unavailable",
      message: "Official regional data is temporarily unavailable.",
      status: 503
    });
  }

  const status = items.length > 0 ? "partial" : "unavailable";
  const usedSourceIds = new Set(items.map((entry) => entry.sourceId));
  const sources = [...usedSourceIds]
    .map((sourceId) => SOURCE_META[sourceId])
    .filter(Boolean);
  const coverage = dateCoverage(items);

  return successResponse({
    endpoint: ENDPOINT,
    cacheSeconds: CACHE_SECONDS.snapshot,
    sourceMode: items.length > 0 ? "official-api" : "unavailable",
    sources: sources.length > 0 ? sources : region.officialSources,
    asOf: coverage.common,
    data: {
      id: region.id,
      label: region.label,
      currency: region.currency,
      sourceMode: items.length > 0 ? "official-api" : "unavailable",
      status,
      snapshot: items.length > 0 ? { items } : null,
      items,
      asOfRange: {
        earliest: coverage.earliest,
        latest: coverage.latest
      },
      reason:
        items.length > 0
          ? "Only reviewed redistribution-safe official adapters are included."
          : "No reviewed redistribution-safe official adapter is configured for this region.",
      fxHref: `/api/finance/fx?base=${region.currency}`,
      officialSources: region.officialSources
    }
  });
}
