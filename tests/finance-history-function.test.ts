import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../functions/api/finance/history.js";

function context(query: string, method = "GET") {
  return {
    request: new Request(
      `https://jats.example/api/finance/history${query}`,
      { method }
    )
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dailyRates(start: string, end: string, symbol: string) {
  const rates: Record<string, Record<string, number>> = {};
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  let index = 0;

  while (cursor <= last) {
    rates[isoDate(cursor)] = { [symbol]: 1 + index / 1000 };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    index += 1;
  }

  return rates;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("FX history finance function", () => {
  it("uses Frankfurter ranges and bounds a one-year response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T08:00:00.000Z"));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.origin).toBe("https://api.frankfurter.app");
      expect(url.pathname).toBe("/2025-07-27..2026-07-27");
      expect(url.searchParams.get("from")).toBe("USD");
      expect(url.searchParams.get("to")).toBe("EUR");

      return Response.json({
        base: "USD",
        start_date: "2025-07-27",
        end_date: "2026-07-27",
        rates: dailyRates("2025-07-27", "2026-07-27", "EUR")
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(
      context("?base=USD&symbol=EUR&range=1Y") as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=21600");
    expect(payload.data.pair).toBe("USD/EUR");
    expect(payload.data.points).toHaveLength(64);
    expect(payload.data.points[0].date).toBe("2025-07-27");
    expect(payload.data.points.at(-1).date).toBe("2026-07-27");
    expect(payload.data.unavailable).toEqual([]);
    expect(payload.data.sampling).toEqual({
      mode: "bounded-observed-days",
      observedPoints: 366,
      returnedPoints: 64,
      maximumPoints: 64
    });
    expect(payload.meta.asOf).toBe("2026-07-27");
    expect(payload.meta.sources).toEqual([
      expect.objectContaining({ id: "frankfurter", role: "primary" })
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses a bounded set of dated Fawaz observations for TWD", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T08:00:00.000Z"));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const date = url.hostname.split(".")[0];
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(url.pathname).toBe("/v1/currencies/usd.json");

      return Response.json({
        date,
        usd: { twd: 30 + fetchMock.mock.calls.length / 100 }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(
      context("?base=USD&symbol=TWD&range=1Y") as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(16);
    expect(payload.data.points).toHaveLength(16);
    expect(payload.data.sampling).toEqual({
      mode: "date-sampled",
      observedPoints: 16,
      returnedPoints: 16,
      maximumPoints: 64
    });
    expect(payload.meta.sourceMode).toBe(
      "date-sampled-public-reference-rate-history"
    );
    expect(payload.meta.sources).toEqual([
      expect.objectContaining({ id: "fawaz-currency-api", role: "fallback" })
    ]);
    expect(payload.meta.asOf).toBe("2026-07-27");
  });

  it("falls back to dated Fawaz observations when Frankfurter fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T08:00:00.000Z"));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "api.frankfurter.app") {
        return new Response(null, { status: 503 });
      }

      const date = url.hostname.split(".")[0];
      return Response.json({
        date,
        usd: { eur: 0.85 }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(
      context("?base=USD&symbol=EUR&range=7D") as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(payload.data.points).toHaveLength(8);
    expect(payload.meta.sources[0].id).toBe("fawaz-currency-api");
  });

  it("rejects unsupported parameters and mutating methods before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const cases = [
      ["?base=BTC&symbol=USD", "unsupported_base"],
      ["?base=USD", "missing_symbol"],
      ["?base=USD&symbol=BTC", "unsupported_symbol"],
      ["?base=USD&symbol=USD", "same_currency"],
      ["?base=USD&symbol=EUR&range=5Y", "unsupported_range"]
    ];

    for (const [query, code] of cases) {
      const response = await onRequest(context(query) as never);
      const payload = await response.json();
      expect(response.status).toBe(400);
      expect(payload.error.code).toBe(code);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }

    const post = await onRequest(
      context("?base=USD&symbol=EUR", "POST") as never
    );
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD, OPTIONS");

    const options = await onRequest(context("", "OPTIONS") as never);
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-methods")).toBe(
      "GET, HEAD, OPTIONS"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an uncached 503 when both public providers fail", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T08:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 }))
    );

    const response = await onRequest(
      context("?base=USD&symbol=EUR&range=1M") as never
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.error.code).toBe("fx_history_upstream_unavailable");
    expect(payload.data).toBeNull();
  });

  it("returns header-only success for HEAD", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T08:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          base: "USD",
          rates: {
            "2026-07-24": { EUR: 0.85 },
            "2026-07-27": { EUR: 0.86 }
          }
        })
      )
    );

    const response = await onRequest(
      context("?base=USD&symbol=EUR&range=7D", "HEAD") as never
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=21600");
    expect(await response.text()).toBe("");
  });
});
