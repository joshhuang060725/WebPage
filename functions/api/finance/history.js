import {
  ALLOWED_CURRENCIES,
  errorResponse,
  fetchJsonWithTimeout,
  guardReadOnly,
  normalizeCurrency,
  regionForCurrency,
  successResponse
} from "./_shared.js";

const ENDPOINT = "/api/finance/history";
const HISTORY_CACHE_SECONDS = 6 * 60 * 60;
const FRANKFURTER_ROOT = "https://api.frankfurter.app";
const FAWAZ_HISTORY_ROOT = "currency-api.pages.dev/v1/currencies";
const FRANKFURTER_TIMEOUT_MS = 3000;
const FAWAZ_TIMEOUT_MS = 2500;
const MAX_FAWAZ_REQUESTS = 16;

const FRANKFURTER_CURRENCIES = new Set(
  ALLOWED_CURRENCIES.filter((currency) => currency !== "TWD")
);

const RANGE_CONFIG = Object.freeze({
  "7D": Object.freeze({
    days: 7,
    maxPoints: 8,
    fallbackRequests: 8
  }),
  "1M": Object.freeze({
    months: 1,
    maxPoints: 24,
    fallbackRequests: 12
  }),
  "3M": Object.freeze({
    months: 3,
    maxPoints: 48,
    fallbackRequests: 14
  }),
  "1Y": Object.freeze({
    months: 12,
    maxPoints: 64,
    fallbackRequests: MAX_FAWAZ_REQUESTS
  })
});

const PROVIDERS = Object.freeze({
  frankfurter: Object.freeze({
    id: "frankfurter",
    name: "Frankfurter",
    url: "https://frankfurter.dev/",
    role: "primary"
  }),
  fawaz: Object.freeze({
    id: "fawaz-currency-api",
    name: "Fawaz Ahmed Currency API official mirror",
    url: "https://github.com/fawazahmed0/exchange-api",
    role: "fallback"
  })
});

function requestResponse(request, response) {
  if (request.method !== "HEAD") return response;
  return new Response(null, {
    status: response.status,
    headers: response.headers
  });
}

function parseRequest(url) {
  const baseCurrency = normalizeCurrency(url.searchParams.get("base") || "USD");
  if (!baseCurrency) {
    return {
      error: errorResponse({
        endpoint: ENDPOINT,
        code: "unsupported_base",
        message: `Base must be one of: ${ALLOWED_CURRENCIES.join(", ")}.`,
        status: 400
      })
    };
  }

  const requestedSymbol = url.searchParams.get("symbol") ?? url.searchParams.get("to");
  if (!requestedSymbol) {
    return {
      error: errorResponse({
        endpoint: ENDPOINT,
        code: "missing_symbol",
        message: "A target symbol is required.",
        status: 400
      })
    };
  }

  const symbolCurrency = normalizeCurrency(requestedSymbol);
  if (!symbolCurrency) {
    return {
      error: errorResponse({
        endpoint: ENDPOINT,
        code: "unsupported_symbol",
        message: `Symbol must be one of: ${ALLOWED_CURRENCIES.join(", ")}.`,
        status: 400
      })
    };
  }

  if (symbolCurrency === baseCurrency) {
    return {
      error: errorResponse({
        endpoint: ENDPOINT,
        code: "same_currency",
        message: "Base and symbol must be different currencies.",
        status: 400
      })
    };
  }

  const range = String(url.searchParams.get("range") || "1M")
    .trim()
    .toUpperCase();
  if (!Object.hasOwn(RANGE_CONFIG, range)) {
    return {
      error: errorResponse({
        endpoint: ENDPOINT,
        code: "unsupported_range",
        message: `Range must be one of: ${Object.keys(RANGE_CONFIG).join(", ")}.`,
        status: 400
      })
    };
  }

  return {
    baseCurrency,
    symbolCurrency,
    range,
    config: RANGE_CONFIG[range]
  };
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || formatDate(parsed) !== value ? null : parsed;
}

function subtractDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}

function subtractMonths(date, months) {
  const day = date.getUTCDate();
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1)
  );
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function requestedWindow(config) {
  const end = new Date();
  const endDate = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );
  const startDate =
    typeof config.days === "number"
      ? subtractDays(endDate, config.days)
      : subtractMonths(endDate, config.months);

  return {
    start: formatDate(startDate),
    end: formatDate(endDate)
  };
}

function validRate(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function withinWindow(date, start, end) {
  return date >= start && date <= end;
}

function boundedPoints(points, maxPoints) {
  if (points.length <= maxPoints) return points;

  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round(
      (index * (points.length - 1)) / (maxPoints - 1)
    );
    return points[sourceIndex];
  });
}

function normalizedPoints(points, start, end) {
  const unique = new Map();

  for (const point of points) {
    const parsedDate = parseIsoDate(point.date);
    if (!parsedDate || !withinWindow(point.date, start, end) || !validRate(point.rate)) {
      continue;
    }
    if (!unique.has(point.date)) {
      unique.set(point.date, {
        date: point.date,
        rate: point.rate
      });
    }
  }

  return [...unique.values()].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
}

async function frankfurterHistory(
  baseCurrency,
  symbolCurrency,
  window,
  maxPoints
) {
  if (
    !FRANKFURTER_CURRENCIES.has(baseCurrency) ||
    !FRANKFURTER_CURRENCIES.has(symbolCurrency)
  ) {
    return null;
  }

  const requestUrl = new URL(
    `${FRANKFURTER_ROOT}/${window.start}..${window.end}`
  );
  requestUrl.searchParams.set("from", baseCurrency);
  requestUrl.searchParams.set("to", symbolCurrency);

  const payload = await fetchJsonWithTimeout(requestUrl, {
    timeoutMs: FRANKFURTER_TIMEOUT_MS
  });
  if (
    normalizeCurrency(payload.base) !== baseCurrency ||
    !payload.rates ||
    typeof payload.rates !== "object"
  ) {
    throw new Error("upstream_payload_error");
  }

  const observed = normalizedPoints(
    Object.entries(payload.rates).map(([date, rates]) => ({
      date,
      rate:
        rates && typeof rates === "object"
          ? rates[symbolCurrency]
          : null
    })),
    window.start,
    window.end
  );

  if (observed.length < 2) throw new Error("upstream_history_unavailable");

  return {
    provider: PROVIDERS.frankfurter,
    samplingMode:
      observed.length > maxPoints ? "bounded-observed-days" : "observed-days",
    observedPointCount: observed.length,
    points: boundedPoints(observed, maxPoints)
  };
}

function fawazRequestDates(start, end, maximumRequests) {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate) return [];

  const totalDays = Math.round(
    (endDate.getTime() - startDate.getTime()) / 86_400_000
  );
  const requestCount = Math.min(
    Math.max(totalDays + 1, 0),
    maximumRequests,
    MAX_FAWAZ_REQUESTS
  );
  if (requestCount === 0) return [];
  if (requestCount === 1) return [start];

  return Array.from({ length: requestCount }, (_, index) => {
    const dayOffset = Math.round((index * totalDays) / (requestCount - 1));
    return formatDate(
      new Date(startDate.getTime() + dayOffset * 86_400_000)
    );
  });
}

async function fawazHistory(
  baseCurrency,
  symbolCurrency,
  window,
  config
) {
  const base = baseCurrency.toLowerCase();
  const symbol = symbolCurrency.toLowerCase();
  const requestDates = fawazRequestDates(
    window.start,
    window.end,
    config.fallbackRequests
  );

  const results = await Promise.allSettled(
    requestDates.map(async (requestedDate) => {
      const requestUrl =
        `https://${requestedDate}.${FAWAZ_HISTORY_ROOT}/${base}.json`;
      const payload = await fetchJsonWithTimeout(requestUrl, {
        timeoutMs: FAWAZ_TIMEOUT_MS
      });
      const sourceRates = payload[base];
      const date = parseIsoDate(payload.date) ? payload.date : null;
      const rate =
        sourceRates && typeof sourceRates === "object"
          ? sourceRates[symbol]
          : null;

      if (!date || !validRate(rate)) return null;
      return { date, rate };
    })
  );

  const observed = normalizedPoints(
    results.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : []
    ),
    window.start,
    window.end
  );

  if (observed.length < 2) throw new Error("upstream_history_unavailable");

  return {
    provider: PROVIDERS.fawaz,
    samplingMode: "date-sampled",
    observedPointCount: observed.length,
    points: boundedPoints(observed, config.maxPoints)
  };
}

export async function onRequest(context) {
  const { request } = context;
  const guarded = guardReadOnly(request, ENDPOINT);
  if (guarded) return guarded;

  const parsed = parseRequest(new URL(request.url));
  if (parsed.error) return requestResponse(request, parsed.error);

  const {
    baseCurrency,
    symbolCurrency,
    range,
    config
  } = parsed;
  const window = requestedWindow(config);
  let history = null;

  try {
    history = await frankfurterHistory(
      baseCurrency,
      symbolCurrency,
      window,
      config.maxPoints
    );
  } catch {
    // The bounded, keyless public fallback below handles primary failures.
  }

  if (!history) {
    try {
      history = await fawazHistory(
        baseCurrency,
        symbolCurrency,
        window,
        config
      );
    } catch {
      // A safe 503 below covers total upstream failure without exposing internals.
    }
  }

  if (!history) {
    return requestResponse(
      request,
      errorResponse({
        endpoint: ENDPOINT,
        code: "fx_history_upstream_unavailable",
        message: "FX reference-rate history is temporarily unavailable.",
        status: 503
      })
    );
  }

  const firstPoint = history.points[0];
  const lastPoint = history.points.at(-1);
  const response = successResponse({
    endpoint: ENDPOINT,
    cacheSeconds: HISTORY_CACHE_SECONDS,
    sourceMode:
      history.provider.id === PROVIDERS.frankfurter.id
        ? "public-reference-rate-history"
        : "date-sampled-public-reference-rate-history",
    asOf: lastPoint.date,
    sources: [history.provider],
    data: {
      base: {
        region: regionForCurrency(baseCurrency),
        currency: baseCurrency,
        amount: 1
      },
      symbol: {
        region: regionForCurrency(symbolCurrency),
        currency: symbolCurrency
      },
      pair: `${baseCurrency}/${symbolCurrency}`,
      range,
      requestedWindow: window,
      actualWindow: {
        start: firstPoint.date,
        end: lastPoint.date
      },
      sampling: {
        mode: history.samplingMode,
        observedPoints: history.observedPointCount,
        returnedPoints: history.points.length,
        maximumPoints: config.maxPoints
      },
      points: history.points,
      unavailable: [],
      rateType: "reference",
      disclaimer: "Reference rates are not executable trading quotes."
    }
  });

  return requestResponse(request, response);
}
