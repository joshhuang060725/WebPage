import { describe, expect, it } from "vitest";
import {
  calculateChange,
  calculateFxCost,
  convertCurrency,
  createFinanceCache,
  crossRate,
  freshnessStatus,
  normalizeCurrency,
  normalizeFinanceItem,
  normalizeQuotes,
  normalizeRatesPayload,
  normalizeRegion,
  readFinanceCache
} from "../src/lib/finance";

describe("finance input allowlists", () => {
  it("normalizes supported region and currency codes", () => {
    expect(normalizeCurrency(" twd ")).toBe("TWD");
    expect(normalizeCurrency("BTC")).toBeNull();
    expect(normalizeRegion("HK")).toBe("hk");
    expect(normalizeRegion("../us")).toBeNull();
  });

  it("deduplicates and bounds quote currencies", () => {
    expect(normalizeQuotes("TWD,HKD,TWD,BTC,USD", "USD")).toEqual(["TWD", "HKD"]);
  });
});

describe("exchange-rate normalization and calculations", () => {
  it("normalizes Frankfurter v2 rows", () => {
    const normalized = normalizeRatesPayload(
      [
        { date: "2026-07-24", base: "USD", quote: "TWD", rate: 32.8 },
        { date: "2026-07-24", base: "USD", quote: "HKD", rate: 7.8 },
        { date: "2026-07-24", base: "USD", quote: "BTC", rate: 0.00001 }
      ],
      "USD",
      "frankfurter",
      "2026-07-26T00:00:00.000Z"
    );
    expect(normalized.rates).toEqual({ USD: 1, TWD: 32.8, HKD: 7.8 });
    expect(normalized.asOf).toBe("2026-07-24T00:00:00.000Z");
  });

  it("normalizes object and Fawaz payloads and rejects invalid values", () => {
    expect(
      normalizeRatesPayload(
        { base: "USD", date: "2026-07-24", rates: { TWD: "32.8", HKD: -1 } },
        "USD",
        "object"
      ).rates
    ).toEqual({ USD: 1, TWD: 32.8 });

    expect(
      normalizeRatesPayload(
        { date: "2026-07-24", usd: { twd: 32.8, hkd: 7.8 } },
        "USD",
        "fawaz"
      ).rates
    ).toEqual({ USD: 1, TWD: 32.8, HKD: 7.8 });

    expect(() =>
      normalizeRatesPayload({ base: "EUR", rates: { TWD: 32.8 } }, "USD", "bad")
    ).toThrow(/base/i);
  });

  it("keeps cross-rates and inverse rates consistent", () => {
    const rates = { TWD: 32, HKD: 8 };
    expect(crossRate(rates, "USD", "TWD")).toBe(32);
    expect(crossRate(rates, "TWD", "HKD")).toBe(0.25);
    expect(crossRate(rates, "TWD", "HKD") * crossRate(rates, "HKD", "TWD")).toBeCloseTo(1);
    expect(crossRate(rates, "USD", "USD")).toBe(1);
  });

  it("converts non-negative amounts with bounded precision", () => {
    expect(convertCurrency(100, 1.23456, 2)).toBe(123.46);
    expect(convertCurrency(0, 1.2, 8)).toBe(0);
    expect(() => convertCurrency(-1, 1.2)).toThrow(/non-negative/i);
    expect(() => convertCurrency(10, 0)).toThrow(/positive/i);
  });
});

describe("cost and movement calculations", () => {
  it("separates user-entered fees and quoted spread from the reference rate", () => {
    const result = calculateFxCost({
      amount: 1000,
      referenceRate: 32,
      feePercent: 1,
      fixedFee: 10,
      quotedRate: 31.5
    });
    expect(result.feeInSourceCurrency).toBe(20);
    expect(result.netSourceAmount).toBe(980);
    expect(result.referenceReceived).toBe(32000);
    expect(result.received).toBe(30870);
    expect(result.totalCostInQuoteCurrency).toBe(1130);
    expect(result.effectiveRate).toBe(30.87);
  });

  it("handles zero denominators without invalid percentages", () => {
    expect(calculateChange(10, 0)).toEqual({ change: 10, changePercent: null });
    expect(calculateFxCost({ amount: 0, referenceRate: 32 }).costPercent).toBe(0);
  });
});

describe("freshness and local cache", () => {
  const now = new Date("2026-07-26T00:00:00.000Z");

  it("uses cadence-aware freshness states", () => {
    expect(freshnessStatus("2026-07-25T00:00:00.000Z", "daily", now)).toBe("fresh");
    expect(freshnessStatus("2026-07-23T00:00:00.000Z", "daily", now)).toBe("delayed");
    expect(freshnessStatus("2026-07-23T00:00:00.000Z", "business-daily", now)).toBe("fresh");
    expect(freshnessStatus("2026-06-01T00:00:00.000Z", "daily", now)).toBe("stale");
    expect(freshnessStatus(null, "monthly", now)).toBe("unavailable");
  });

  it("returns fresh, stale, expired, and invalid cache states", () => {
    const envelope = createFinanceCache("fx:USD", { rates: { TWD: 32 } }, {
      now,
      freshForMs: 1000,
      staleForMs: 5000
    });
    expect(readFinanceCache(envelope, "fx:USD", new Date(now.getTime() + 500)).state).toBe("fresh");
    expect(readFinanceCache(JSON.stringify(envelope), "fx:USD", new Date(now.getTime() + 2000)).state).toBe("stale");
    expect(readFinanceCache(envelope, "fx:USD", new Date(now.getTime() + 6000)).state).toBe("expired");
    expect(readFinanceCache(envelope, "fx:EUR", now).state).toBe("invalid");
    expect(readFinanceCache("{", "fx:USD", now).state).toBe("invalid");
  });
});

describe("finance item normalization", () => {
  it("normalizes one reviewed data item and calculates movement", () => {
    const item = normalizeFinanceItem(
      {
        id: "us-10y",
        value: "4.25",
        previousValue: "4.20",
        unit: "%",
        asOf: "2026-07-25",
        fetchedAt: "2026-07-26T00:00:00Z"
      },
      {
        region: "us",
        category: "rates",
        frequency: "daily",
        sourceId: "us-treasury",
        sourceUrl: "https://home.treasury.gov/",
        sourceMode: "official-api"
      },
      new Date("2026-07-26T00:00:00Z")
    );
    expect(item?.status).toBe("fresh");
    expect(item?.change).toBeCloseTo(0.05);
    expect(item?.changePercent).toBeCloseTo(1.190476);
  });

  it("rejects invalid IDs and non-numeric values", () => {
    const defaults = {
      region: "us" as const,
      category: "rates" as const,
      frequency: "daily" as const,
      sourceId: "us-treasury",
      sourceUrl: "https://home.treasury.gov/",
      sourceMode: "official-api" as const
    };
    expect(normalizeFinanceItem({ id: "../bad", value: 1 }, defaults)).toBeNull();
    expect(normalizeFinanceItem({ id: "good-id", value: "NaN" }, defaults)).toBeNull();
  });
});
