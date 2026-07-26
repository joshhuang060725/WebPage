import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest as onFxRequest } from "../functions/api/finance/fx.js";
import { onRequest } from "../functions/api/finance/regions/[region].js";

function singStatPayload(columns: Array<{ key: string; value: string | number }>) {
  return {
    Data: {
      row: [{ columns }]
    }
  };
}

function context(region: string, method = "GET") {
  return {
    request: new Request(`https://jats.example/api/finance/regions/${region}`, { method }),
    params: { region }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("regional finance function", () => {
  it("normalizes the reviewed SingStat CPI, GDP, and unemployment series", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      let payload;
      if (url.includes("M213751")) {
        payload = singStatPayload([
          { key: "2026 Jun", value: "102.858" },
          { key: "2026 May", value: "102.814" }
        ]);
      } else if (url.includes("M015631")) {
        payload = singStatPayload([
          { key: "2026 1Q", value: "6.0" },
          { key: "2025 4Q", value: "5.7" }
        ]);
      } else if (url.includes("M182342")) {
        payload = singStatPayload([
          { key: "2026 1Q", value: "2.0" },
          { key: "2025 4Q", value: "2.0" }
        ]);
      } else {
        return new Response(null, { status: 404 });
      }
      return Response.json(payload);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("sg") as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe("partial");
    expect(payload.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sg-consumer-price-index",
          value: 102.858,
          unit: "index-2024-100",
          asOf: "2026-06-01",
          sourceId: "sg-singstat"
        }),
        expect.objectContaining({
          id: "sg-real-gdp-growth",
          value: 6,
          asOf: "2026-03-31"
        }),
        expect.objectContaining({
          id: "sg-unemployment-rate",
          value: 2,
          asOf: "2026-03-31"
        })
      ])
    );
    expect(payload.meta.sources).toEqual([
      expect.objectContaining({ id: "sg-singstat", integrationMode: "official-api" })
    ]);
    expect(payload.meta.asOf).toBeNull();
    expect(payload.data.asOfRange).toEqual({
      earliest: "2026-03-31",
      latest: "2026-06-01"
    });
    expect(
      fetchMock.mock.calls.some(
        ([input]) =>
          String(input).includes("M182342") &&
          String(input).includes("seriesNoORrowNo=2")
      )
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps Mainland China explicitly unavailable without requesting an unreviewed feed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await onRequest(context("cn") as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe("unavailable");
    expect(payload.data.items).toEqual([]);
    expect(payload.data.reason).toMatch(/No reviewed/);
    expect(payload.meta.sources.map((source: { id: string }) => source.id)).toEqual([
      "cn-sse",
      "cn-szse",
      "cn-pbc",
      "cn-nbs"
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported regions and mutating methods with safe envelopes", async () => {
    const unknown = await onRequest(context("xx") as never);
    const unknownPayload = await unknown.json();
    expect(unknown.status).toBe(404);
    expect(unknownPayload.error.code).toBe("region_not_found");

    const post = await onRequest(context("sg", "POST") as never);
    const postPayload = await post.json();
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(postPayload.error.code).toBe("method_not_allowed");
  });

  it("does not turn empty or failed official payloads into cached zero values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          singStatPayload([
            { key: "2026 Jun", value: "" },
            { key: "2026 May", value: "" }
          ])
        )
      )
    );

    const empty = await onRequest(context("sg") as never);
    const emptyPayload = await empty.json();
    expect(empty.status).toBe(503);
    expect(empty.headers.get("cache-control")).toBe("no-store");
    expect(emptyPayload.error.code).toBe("region_upstream_unavailable");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const failed = await onRequest(context("us") as never);
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toBe("no-store");
  });
});

describe("FX finance function", () => {
  it("supports the full registered currency set and discloses mixed providers", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("frankfurter")) {
        return Response.json({
          base: "EUR",
          date: "2026-07-24",
          rates: { JPY: 170 }
        });
      }
      if (url.includes("/eur.json")) {
        return Response.json({
          date: "2026-07-25",
          eur: { twd: 38 }
        });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await onFxRequest({
      request: new Request(
        "https://jats.example/api/finance/fx?base=EUR&symbols=JPY,TWD"
      )
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.base).toEqual({ region: null, currency: "EUR", amount: 1 });
    expect(payload.data.quotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: "JPY",
          provider: "frankfurter",
          asOf: "2026-07-24"
        }),
        expect.objectContaining({
          currency: "TWD",
          provider: "fawaz-currency-api",
          asOf: "2026-07-25"
        })
      ])
    );
    expect(payload.meta.asOf).toBeNull();
    expect(payload.meta.sources.map((source: { id: string }) => source.id)).toEqual([
      "frankfurter",
      "fawaz-currency-api"
    ]);
  });

  it("rejects a mismatched Frankfurter base instead of relabeling its rates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("frankfurter")) {
          return Response.json({
            base: "USD",
            date: "2026-07-24",
            rates: { JPY: 150 }
          });
        }
        return new Response(null, { status: 503 });
      })
    );

    const response = await onFxRequest({
      request: new Request("https://jats.example/api/finance/fx?base=EUR&symbols=JPY")
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("fx_upstream_unavailable");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
