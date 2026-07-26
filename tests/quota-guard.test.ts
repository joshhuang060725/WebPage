import { describe, expect, it, vi } from "vitest";
import { quotaFailure } from "../functions/_lib/quota-guard.js";
import { onRequest } from "../functions/api/_middleware.js";

describe("public API quota boundary", () => {
  it("does not charge or inspect quota storage for preflight requests", async () => {
    const next = vi.fn(async () => new Response(null, { status: 204 }));
    const get = vi.fn();
    const put = vi.fn();

    const response = await onRequest({
      request: new Request("https://jats.example/api/finance/fx", {
        method: "OPTIONS"
      }),
      env: {
        ENFORCE_QUOTA_GUARD: "true",
        USAGE_KV: { get, put }
      },
      next
    } as never);

    expect(response.status).toBe(204);
    expect(next).toHaveBeenCalledOnce();
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("returns a CORS-safe envelope without internal keys, limits, or binding details", async () => {
    const response = quotaFailure({
      code: "quota_exceeded",
      message: "internal quota details",
      status: 429,
      key: "daily:secret:api_requests",
      limit: 1,
      reset: "secret"
    });
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(429);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        data: null,
        error: {
          code: "public_api_quota_exhausted",
          message: "The public API quota is temporarily exhausted."
        }
      })
    );
    expect(serialized).not.toContain("daily:secret");
    expect(serialized).not.toContain("limit");
    expect(serialized).not.toContain("reset");
    expect(serialized).not.toContain("binding");
  });
});
