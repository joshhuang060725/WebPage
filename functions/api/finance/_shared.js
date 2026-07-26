const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Accept"
};

export const CACHE_SECONDS = Object.freeze({
  fx: 6 * 60 * 60,
  snapshot: 24 * 60 * 60
});

export const REGION_DEFINITIONS = Object.freeze({
  us: {
    id: "us",
    label: "United States",
    currency: "USD",
    officialSources: [
      {
        id: "us-treasury",
        category: "rates",
        name: "U.S. Department of the Treasury",
        url: "https://home.treasury.gov/treasury-daily-interest-rate-xml-feed",
        integrationMode: "official-api"
      },
      {
        id: "us-bls",
        category: "macro",
        name: "U.S. Bureau of Labor Statistics",
        url: "https://www.bls.gov/developers/",
        integrationMode: "official-api"
      },
      {
        id: "us-fed",
        category: "rates-and-fx",
        name: "Federal Reserve Board Data Download Program",
        url: "https://www.federalreserve.gov/datadownload/",
        integrationMode: "link-only"
      }
    ]
  },
  hk: {
    id: "hk",
    label: "Hong Kong",
    currency: "HKD",
    officialSources: [
      {
        id: "hk-hkma",
        category: "rates-and-fx",
        name: "Hong Kong Monetary Authority Open API",
        url: "https://apidocs.hkma.gov.hk/",
        integrationMode: "official-api"
      },
      {
        id: "hk-census",
        category: "macro",
        name: "Census and Statistics Department",
        url: "https://www.censtatd.gov.hk/en/",
        integrationMode: "link-only"
      }
    ]
  },
  cn: {
    id: "cn",
    label: "Mainland China",
    currency: "CNY",
    officialSources: [
      {
        id: "cn-sse",
        category: "market",
        name: "Shanghai Stock Exchange",
        url: "https://www.sse.com.cn/market/sseindex/indexlist/",
        integrationMode: "link-only"
      },
      {
        id: "cn-szse",
        category: "market",
        name: "Shenzhen Stock Exchange",
        url: "https://www.szse.cn/market/trend/index.html",
        integrationMode: "link-only"
      },
      {
        id: "cn-pbc",
        category: "rates-and-fx",
        name: "People's Bank of China",
        url: "https://www.pbc.gov.cn/zhengcehuobisi/125207/125217/125925/17105-2.html",
        integrationMode: "link-only"
      },
      {
        id: "cn-nbs",
        category: "macro",
        name: "National Bureau of Statistics of China",
        url: "https://data.stats.gov.cn/easyquery.htm",
        integrationMode: "link-only"
      }
    ]
  },
  tw: {
    id: "tw",
    label: "Taiwan",
    currency: "TWD",
    officialSources: [
      {
        id: "tw-twse",
        category: "market",
        name: "Taiwan Stock Exchange",
        url: "https://openapi.twse.com.tw/",
        integrationMode: "official-api"
      },
      {
        id: "tw-cbc",
        category: "rates-and-fx",
        name: "Central Bank of the Republic of China (Taiwan)",
        url: "https://cpx.cbc.gov.tw/Data/ExportToAPIInfo",
        integrationMode: "link-only"
      },
      {
        id: "tw-dgbas",
        category: "macro",
        name: "Directorate-General of Budget, Accounting and Statistics",
        url: "https://www.dgbas.gov.tw/",
        integrationMode: "link-only"
      }
    ]
  },
  sg: {
    id: "sg",
    label: "Singapore",
    currency: "SGD",
    officialSources: [
      {
        id: "sg-sgx",
        category: "market",
        name: "Singapore Exchange",
        url: "https://www.sgx.com/indices/products/sti",
        integrationMode: "link-only"
      },
      {
        id: "sg-mas",
        category: "rates-and-fx",
        name: "Monetary Authority of Singapore",
        url: "https://eservices.mas.gov.sg/Statistics/msb/ExchangeRates.aspx",
        integrationMode: "link-only"
      },
      {
        id: "sg-singstat",
        category: "macro",
        name: "Singapore Department of Statistics",
        url: "https://tablebuilder.singstat.gov.sg/view-api/for-developers",
        integrationMode: "official-api"
      }
    ]
  }
});

export const ALLOWED_REGIONS = Object.freeze(Object.keys(REGION_DEFINITIONS));
export const ALLOWED_CURRENCIES = Object.freeze([
  "USD",
  "HKD",
  "CNY",
  "TWD",
  "SGD",
  "EUR",
  "JPY",
  "GBP",
  "KRW",
  "AUD",
  "CAD",
  "CHF"
]);

const REGION_BY_CURRENCY = Object.freeze(
  Object.fromEntries(
    Object.values(REGION_DEFINITIONS).map((region) => [region.currency, region.id])
  )
);

function cacheControl(seconds) {
  return `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=3600`;
}

function responseHeaders(status, cacheSeconds, extraHeaders = {}) {
  return {
    ...JSON_HEADERS,
    "Cache-Control": status >= 200 && status < 300 ? cacheControl(cacheSeconds) : "no-store",
    ...extraHeaders
  };
}

export function successResponse({
  endpoint,
  data,
  sourceMode,
  cacheSeconds,
  asOf = null,
  sources = [],
  status = 200,
  headers = {}
}) {
  return new Response(
    JSON.stringify({
      ok: true,
      data,
      error: null,
      meta: {
        schemaVersion: "1.0",
        endpoint,
        sourceMode,
        asOf,
        generatedAt: new Date().toISOString(),
        sources
      }
    }),
    {
      status,
      headers: responseHeaders(status, cacheSeconds, headers)
    }
  );
}

export function errorResponse({
  endpoint,
  code,
  message,
  status = 500,
  headers = {}
}) {
  return new Response(
    JSON.stringify({
      ok: false,
      data: null,
      error: { code, message },
      meta: {
        schemaVersion: "1.0",
        endpoint,
        sourceMode: "unavailable",
        asOf: null,
        generatedAt: new Date().toISOString(),
        sources: []
      }
    }),
    {
      status,
      headers: responseHeaders(status, 0, headers)
    }
  );
}

export function preflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      ...JSON_HEADERS,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export function guardReadOnly(request, endpoint) {
  if (request.method === "OPTIONS") return preflightResponse();
  if (request.method === "GET" || request.method === "HEAD") return null;

  return errorResponse({
    endpoint,
    code: "method_not_allowed",
    message: "Only GET, HEAD, and OPTIONS requests are supported.",
    status: 405,
    headers: { Allow: "GET, HEAD, OPTIONS" }
  });
}

export function normalizeRegion(value) {
  const token = String(value || "").trim();
  if (!token) return null;

  const region = token.toLowerCase();
  if (Object.hasOwn(REGION_DEFINITIONS, region)) return region;

  return REGION_BY_CURRENCY[token.toUpperCase()] || null;
}

export function normalizeCurrency(value) {
  const currency = String(value || "").trim().toUpperCase();
  return ALLOWED_CURRENCIES.includes(currency) ? currency : null;
}

export function regionForCurrency(value) {
  const currency = normalizeCurrency(value);
  return currency ? REGION_BY_CURRENCY[currency] || null : null;
}

export function publicRegionSummary(region) {
  return {
    id: region.id,
    label: region.label,
    currency: region.currency,
    sourceMode: "unavailable",
    status: "unavailable",
    snapshot: null,
    reason: "No redistribution-safe official market quote feed is configured.",
    href: `/api/finance/regions/${region.id}`
  };
}

async function fetchWithTimeout(
  url,
  { timeoutMs = 5000, responseType = "json", headers = {}, ...init } = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: init.method || "GET",
      headers: {
        Accept: responseType === "text" ? "application/xml,text/xml,text/plain" : "application/json",
        ...headers
      },
      body: init.body,
      signal: controller.signal
    });

    if (!response.ok) throw new Error("upstream_http_error");

    const payload = responseType === "text" ? await response.text() : await response.json();
    if (
      (responseType === "text" && typeof payload !== "string") ||
      (responseType === "json" && (!payload || typeof payload !== "object"))
    ) {
      throw new Error("upstream_payload_error");
    }

    return payload;
  } catch {
    throw new Error("upstream_unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJsonWithTimeout(url, options = {}) {
  return fetchWithTimeout(url, { ...options, responseType: "json" });
}

export async function fetchTextWithTimeout(url, options = {}) {
  return fetchWithTimeout(url, { ...options, responseType: "text" });
}
