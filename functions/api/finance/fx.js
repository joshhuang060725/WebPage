import {
  ALLOWED_CURRENCIES,
  CACHE_SECONDS,
  errorResponse,
  fetchJsonWithTimeout,
  guardReadOnly,
  normalizeCurrency,
  regionForCurrency,
  successResponse
} from "./_shared.js";

const ENDPOINT = "/api/finance/fx";
const FRANKFURTER_URL = "https://api.frankfurter.app/latest";
const FAWAZ_MIRROR_URL = "https://latest.currency-api.pages.dev/v1/currencies";
const REGIONAL_CURRENCIES = Object.freeze(["USD", "HKD", "CNY", "TWD", "SGD"]);
const FRANKFURTER_CURRENCIES = new Set(
  ALLOWED_CURRENCIES.filter((currency) => currency !== "TWD")
);

const PROVIDERS = Object.freeze({
  frankfurter: {
    id: "frankfurter",
    name: "Frankfurter",
    url: "https://frankfurter.dev/",
    role: "primary"
  },
  fawaz: {
    id: "fawaz-currency-api",
    name: "Fawaz Ahmed Currency API official mirror",
    url: "https://github.com/fawazahmed0/exchange-api",
    role: "fallback"
  }
});

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

  const requested = url.searchParams.get("symbols") ?? url.searchParams.get("to");
  const rawTargets = requested
    ? requested.split(",").map((value) => value.trim()).filter(Boolean)
    : REGIONAL_CURRENCIES.filter((currency) => currency !== baseCurrency);

  const targets = [];
  for (const rawTarget of rawTargets) {
    const target = normalizeCurrency(rawTarget);
    if (!target) {
      return {
        error: errorResponse({
          endpoint: ENDPOINT,
          code: "unsupported_symbol",
          message: `Symbols must use only: ${ALLOWED_CURRENCIES.join(", ")}.`,
          status: 400
        })
      };
    }
    if (target !== baseCurrency && !targets.includes(target)) targets.push(target);
  }

  if (targets.length === 0) {
    return {
      error: errorResponse({
        endpoint: ENDPOINT,
        code: "missing_symbols",
        message: "At least one target region different from the base is required.",
        status: 400
      })
    };
  }

  return { baseCurrency, targetCurrencies: targets };
}

function validRate(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

async function frankfurterRates(baseCurrency, targetCurrencies) {
  if (!FRANKFURTER_CURRENCIES.has(baseCurrency)) return null;

  const supportedTargets = targetCurrencies.filter((currency) =>
    FRANKFURTER_CURRENCIES.has(currency)
  );
  if (supportedTargets.length === 0) return null;

  const requestUrl = new URL(FRANKFURTER_URL);
  requestUrl.searchParams.set("from", baseCurrency);
  requestUrl.searchParams.set("to", supportedTargets.join(","));

  const payload = await fetchJsonWithTimeout(requestUrl);
  if (normalizeCurrency(payload.base) !== baseCurrency) {
    throw new Error("upstream_base_mismatch");
  }
  const rates = {};
  for (const currency of supportedTargets) {
    if (validRate(payload.rates?.[currency])) rates[currency] = payload.rates[currency];
  }

  return {
    date: typeof payload.date === "string" ? payload.date : null,
    rates
  };
}

async function fawazRates(baseCurrency, targetCurrencies) {
  const base = baseCurrency.toLowerCase();
  const requestUrl = `${FAWAZ_MIRROR_URL}/${base}.json`;
  const payload = await fetchJsonWithTimeout(requestUrl);
  const sourceRates = payload[base];
  const rates = {};

  if (!sourceRates || typeof sourceRates !== "object") {
    throw new Error("upstream_unavailable");
  }

  for (const currency of targetCurrencies) {
    const value = sourceRates[currency.toLowerCase()];
    if (validRate(value)) rates[currency] = value;
  }

  return {
    date: typeof payload.date === "string" ? payload.date : null,
    rates
  };
}

function commonAsOf(quotes) {
  const dates = [...new Set(quotes.map((quote) => quote.asOf).filter(Boolean))];
  return dates.length === 1 ? dates[0] : null;
}

export async function onRequest(context) {
  const guarded = guardReadOnly(context.request, ENDPOINT);
  if (guarded) return guarded;

  const parsed = parseRequest(new URL(context.request.url));
  if (parsed.error) return parsed.error;

  const { baseCurrency, targetCurrencies } = parsed;
  const collected = new Map();
  const usedProviders = new Set();

  try {
    const primary = await frankfurterRates(baseCurrency, targetCurrencies);
    if (primary) {
      for (const [currency, rate] of Object.entries(primary.rates)) {
        collected.set(currency, {
          rate,
          asOf: primary.date,
          provider: PROVIDERS.frankfurter.id
        });
      }
      if (Object.keys(primary.rates).length > 0) {
        usedProviders.add(PROVIDERS.frankfurter.id);
      }
    }
  } catch {
    // Missing primary data is handled by the public fallback below.
  }

  const missingCurrencies = targetCurrencies.filter(
    (currency) => !collected.has(currency)
  );

  if (missingCurrencies.length > 0) {
    try {
      const fallback = await fawazRates(baseCurrency, missingCurrencies);
      for (const [currency, rate] of Object.entries(fallback.rates)) {
        collected.set(currency, {
          rate,
          asOf: fallback.date,
          provider: PROVIDERS.fawaz.id
        });
      }
      if (Object.keys(fallback.rates).length > 0) {
        usedProviders.add(PROVIDERS.fawaz.id);
      }
    } catch {
      // The response below reports unavailable currencies without exposing internals.
    }
  }

  const quotes = targetCurrencies.flatMap((currency) => {
    const quote = collected.get(currency);
    if (!quote) return [];
    return [
      {
        region: regionForCurrency(currency),
        currency,
        rate: quote.rate,
        asOf: quote.asOf,
        provider: quote.provider
      }
    ];
  });
  const unavailable = targetCurrencies.filter((currency) => !collected.has(currency));

  if (quotes.length === 0) {
    return errorResponse({
      endpoint: ENDPOINT,
      code: "fx_upstream_unavailable",
      message: "FX reference rates are temporarily unavailable.",
      status: 503
    });
  }

  const sourceMode =
    unavailable.length > 0
      ? "partial-public-reference-rates"
      : "public-reference-rates";
  const sources = [...usedProviders].map((provider) =>
    provider === PROVIDERS.frankfurter.id
      ? PROVIDERS.frankfurter
      : PROVIDERS.fawaz
  );

  return successResponse({
    endpoint: ENDPOINT,
    cacheSeconds: CACHE_SECONDS.fx,
    sourceMode,
    asOf: commonAsOf(quotes),
    sources,
    data: {
      base: {
        region: regionForCurrency(baseCurrency),
        currency: baseCurrency,
        amount: 1
      },
      quotes,
      unavailable,
      rateType: "reference",
      disclaimer: "Reference rates are not executable trading quotes."
    }
  });
}
