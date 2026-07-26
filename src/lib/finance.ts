export const FINANCE_REGIONS = ["us", "hk", "cn", "tw", "sg"] as const;
export const FINANCE_CURRENCIES = [
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
] as const;

export type FinanceRegion = (typeof FINANCE_REGIONS)[number];
export type FinanceCurrency = (typeof FINANCE_CURRENCIES)[number];
export type FinanceSourceMode =
  | "official-api"
  | "official-snapshot"
  | "institutional-feed"
  | "external-widget";
export type FinanceDataStatus =
  | "fresh"
  | "delayed"
  | "stale"
  | "cached"
  | "partial"
  | "unavailable";
export type FinanceFrequency =
  | "intraday"
  | "daily"
  | "business-daily"
  | "market-delayed"
  | "event-driven"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annual";

export interface FinanceDataItem {
  id: string;
  region: FinanceRegion | "global";
  category: "market" | "fx" | "rates" | "money" | "macro";
  label?: string;
  value: number | null;
  unit: string;
  asOf: string | null;
  fetchedAt: string;
  frequency: FinanceFrequency;
  status: FinanceDataStatus;
  sourceId: string;
  sourceUrl: string;
  sourceMode: FinanceSourceMode;
  previousValue?: number | null;
  change?: number | null;
  changePercent?: number | null;
}

export interface NormalizedRates {
  base: FinanceCurrency;
  rates: Partial<Record<FinanceCurrency, number>>;
  asOf: string | null;
  fetchedAt: string;
  sourceId: string;
}

export interface FxCostInput {
  amount: number;
  referenceRate: number;
  feePercent?: number;
  fixedFee?: number;
  quotedRate?: number | null;
}

export interface FxCostResult {
  sourceAmount: number;
  feeInSourceCurrency: number;
  netSourceAmount: number;
  referenceReceived: number;
  received: number;
  totalCostInQuoteCurrency: number;
  costPercent: number;
  effectiveRate: number;
}

export interface FinanceCacheEnvelope<T = unknown> {
  version: 1;
  key: string;
  storedAt: string;
  expiresAt: string;
  staleAt: string;
  data: T;
}

export type FinanceCacheRead<T> =
  | { state: "fresh" | "stale"; envelope: FinanceCacheEnvelope<T> }
  | { state: "expired" | "invalid"; envelope: null };

const DAILY = 24 * 60 * 60 * 1000;
const FRESHNESS_WINDOWS: Record<FinanceFrequency, { fresh: number; delayed: number }> = {
  intraday: { fresh: 30 * 60 * 1000, delayed: 6 * 60 * 60 * 1000 },
  daily: { fresh: 36 * 60 * 60 * 1000, delayed: 4 * DAILY },
  "business-daily": { fresh: 4 * DAILY, delayed: 10 * DAILY },
  "market-delayed": { fresh: 36 * 60 * 60 * 1000, delayed: 4 * DAILY },
  "event-driven": { fresh: 180 * DAILY, delayed: 400 * DAILY },
  weekly: { fresh: 10 * DAILY, delayed: 21 * DAILY },
  monthly: { fresh: 45 * DAILY, delayed: 75 * DAILY },
  quarterly: { fresh: 120 * DAILY, delayed: 180 * DAILY },
  annual: { fresh: 400 * DAILY, delayed: 550 * DAILY }
};

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value.replaceAll(",", "").trim()) : Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function normalizeCurrency(value: unknown, fallback?: FinanceCurrency): FinanceCurrency | null {
  const candidate = String(value || "")
    .trim()
    .toUpperCase();
  if ((FINANCE_CURRENCIES as readonly string[]).includes(candidate)) {
    return candidate as FinanceCurrency;
  }
  return fallback || null;
}

export function normalizeRegion(value: unknown): FinanceRegion | null {
  const candidate = String(value || "")
    .trim()
    .toLowerCase();
  return (FINANCE_REGIONS as readonly string[]).includes(candidate)
    ? (candidate as FinanceRegion)
    : null;
}

export function normalizeQuotes(value: unknown, base: FinanceCurrency): FinanceCurrency[] {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(raw.map((item) => normalizeCurrency(item)).filter(Boolean) as FinanceCurrency[])]
    .filter((code) => code !== base)
    .slice(0, FINANCE_CURRENCIES.length - 1);
}

export function calculateChange(value: unknown, previousValue: unknown) {
  const current = finiteNumber(value);
  const previous = finiteNumber(previousValue);
  if (current === null || previous === null) {
    return { change: null, changePercent: null };
  }
  const change = current - previous;
  return {
    change,
    changePercent: previous === 0 ? null : (change / Math.abs(previous)) * 100
  };
}

export function crossRate(
  rates: Partial<Record<FinanceCurrency, number>>,
  base: FinanceCurrency,
  quote: FinanceCurrency
) {
  if (base === quote) return 1;
  const baseRate = base === "USD" ? 1 : positiveNumber(rates[base]);
  const quoteRate = quote === "USD" ? 1 : positiveNumber(rates[quote]);
  if (baseRate === null || quoteRate === null) {
    throw new Error(`Missing a valid rate for ${base}/${quote}.`);
  }
  return quoteRate / baseRate;
}

export function convertCurrency(
  amount: unknown,
  rate: unknown,
  decimalPlaces = 4
): number {
  const normalizedAmount = finiteNumber(amount);
  const normalizedRate = positiveNumber(rate);
  if (normalizedAmount === null || normalizedAmount < 0) {
    throw new Error("Amount must be a finite, non-negative number.");
  }
  if (normalizedRate === null) {
    throw new Error("Rate must be a finite, positive number.");
  }
  const digits = Math.min(8, Math.max(0, Math.trunc(decimalPlaces)));
  const factor = 10 ** digits;
  return Math.round((normalizedAmount * normalizedRate + Number.EPSILON) * factor) / factor;
}

export function calculateFxCost(input: FxCostInput): FxCostResult {
  const amount = finiteNumber(input.amount);
  const referenceRate = positiveNumber(input.referenceRate);
  const feePercent = finiteNumber(input.feePercent ?? 0);
  const fixedFee = finiteNumber(input.fixedFee ?? 0);
  const quotedRate =
    input.quotedRate === null || input.quotedRate === undefined || input.quotedRate === 0
      ? referenceRate
      : positiveNumber(input.quotedRate);

  if (amount === null || amount < 0) throw new Error("Amount must be non-negative.");
  if (referenceRate === null || quotedRate === null) throw new Error("Rates must be positive.");
  if (feePercent === null || feePercent < 0 || feePercent > 100) {
    throw new Error("Percentage fee must be between 0 and 100.");
  }
  if (fixedFee === null || fixedFee < 0) throw new Error("Fixed fee must be non-negative.");

  const feeInSourceCurrency = amount * (feePercent / 100) + fixedFee;
  const netSourceAmount = Math.max(0, amount - feeInSourceCurrency);
  const referenceReceived = amount * referenceRate;
  const received = netSourceAmount * quotedRate;
  const totalCostInQuoteCurrency = Math.max(0, referenceReceived - received);

  return {
    sourceAmount: amount,
    feeInSourceCurrency,
    netSourceAmount,
    referenceReceived,
    received,
    totalCostInQuoteCurrency,
    costPercent: referenceReceived === 0 ? 0 : (totalCostInQuoteCurrency / referenceReceived) * 100,
    effectiveRate: amount === 0 ? 0 : received / amount
  };
}

export function freshnessStatus(
  asOf: string | null | undefined,
  frequency: FinanceFrequency,
  now = new Date()
): Extract<FinanceDataStatus, "fresh" | "delayed" | "stale" | "unavailable"> {
  if (!asOf) return "unavailable";
  const timestamp = Date.parse(asOf);
  if (!Number.isFinite(timestamp)) return "unavailable";
  const age = Math.max(0, now.getTime() - timestamp);
  const window = FRESHNESS_WINDOWS[frequency];
  if (age <= window.fresh) return "fresh";
  if (age <= window.delayed) return "delayed";
  return "stale";
}

export function normalizeRatesPayload(
  payload: unknown,
  requestedBase: FinanceCurrency,
  sourceId: string,
  fetchedAt = new Date().toISOString()
): NormalizedRates {
  const rates: Partial<Record<FinanceCurrency, number>> = { [requestedBase]: 1 };
  let asOf: string | null = null;

  if (Array.isArray(payload)) {
    for (const row of payload) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const base = normalizeCurrency(record.base, requestedBase);
      const quote = normalizeCurrency(record.quote);
      const rate = positiveNumber(record.rate);
      if (base !== requestedBase || !quote || rate === null) continue;
      rates[quote] = rate;
      asOf ||= isoDate(record.date);
    }
  } else if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const payloadBase = normalizeCurrency(record.base || record.base_code, requestedBase);
    if (payloadBase !== requestedBase) throw new Error("Rate payload base does not match the request.");
    asOf = isoDate(record.date || record.asOf || record.time_last_update_utc);

    const objectRates =
      record.rates && typeof record.rates === "object"
        ? (record.rates as Record<string, unknown>)
        : record[requestedBase.toLowerCase()] && typeof record[requestedBase.toLowerCase()] === "object"
          ? (record[requestedBase.toLowerCase()] as Record<string, unknown>)
          : null;

    for (const [rawCode, rawRate] of Object.entries(objectRates || {})) {
      const code = normalizeCurrency(rawCode);
      const rate = positiveNumber(rawRate);
      if (code && rate !== null) rates[code] = rate;
    }
  }

  if (Object.keys(rates).length < 2) {
    throw new Error("Rate payload did not contain any supported positive quote rates.");
  }

  return { base: requestedBase, rates, asOf, fetchedAt, sourceId };
}

export function normalizeFinanceItem(
  value: unknown,
  defaults: Pick<
    FinanceDataItem,
    "region" | "category" | "frequency" | "sourceId" | "sourceUrl" | "sourceMode"
  >,
  now = new Date()
): FinanceDataItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) return null;
  const numericValue = record.value === null ? null : finiteNumber(record.value);
  if (record.value !== null && numericValue === null) return null;
  const asOf = isoDate(record.asOf);
  const status =
    record.status && ["fresh", "delayed", "stale", "cached", "partial", "unavailable"].includes(String(record.status))
      ? (record.status as FinanceDataStatus)
      : freshnessStatus(asOf, defaults.frequency, now);
  const previousValue = record.previousValue === null ? null : finiteNumber(record.previousValue);
  const calculated = calculateChange(numericValue, previousValue);

  return {
    id,
    region: defaults.region,
    category: defaults.category,
    label: typeof record.label === "string" ? record.label : undefined,
    value: numericValue,
    unit: typeof record.unit === "string" ? record.unit.slice(0, 16) : "",
    asOf,
    fetchedAt: isoDate(record.fetchedAt) || now.toISOString(),
    frequency: defaults.frequency,
    status,
    sourceId: defaults.sourceId,
    sourceUrl: defaults.sourceUrl,
    sourceMode: defaults.sourceMode,
    previousValue,
    change: finiteNumber(record.change) ?? calculated.change,
    changePercent: finiteNumber(record.changePercent) ?? calculated.changePercent
  };
}

export function createFinanceCache<T>(
  key: string,
  data: T,
  options: { now?: Date; freshForMs?: number; staleForMs?: number } = {}
): FinanceCacheEnvelope<T> {
  const now = options.now || new Date();
  const freshForMs = Math.max(0, options.freshForMs ?? DAILY);
  const staleForMs = Math.max(freshForMs, options.staleForMs ?? 7 * DAILY);
  return {
    version: 1,
    key,
    storedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + freshForMs).toISOString(),
    staleAt: new Date(now.getTime() + staleForMs).toISOString(),
    data
  };
}

export function readFinanceCache<T>(
  value: unknown,
  expectedKey: string,
  now = new Date()
): FinanceCacheRead<T> {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { state: "invalid", envelope: null };
    }
  }
  if (!parsed || typeof parsed !== "object") return { state: "invalid", envelope: null };
  const record = parsed as Partial<FinanceCacheEnvelope<T>>;
  if (
    record.version !== 1 ||
    record.key !== expectedKey ||
    !record.storedAt ||
    !record.expiresAt ||
    !record.staleAt ||
    !("data" in record)
  ) {
    return { state: "invalid", envelope: null };
  }
  const storedAt = Date.parse(record.storedAt);
  const expiresAt = Date.parse(record.expiresAt);
  const staleAt = Date.parse(record.staleAt);
  if (![storedAt, expiresAt, staleAt].every(Number.isFinite) || storedAt > expiresAt || expiresAt > staleAt) {
    return { state: "invalid", envelope: null };
  }
  const envelope = record as FinanceCacheEnvelope<T>;
  if (now.getTime() > staleAt) return { state: "expired", envelope: null };
  return { state: now.getTime() > expiresAt ? "stale" : "fresh", envelope };
}
