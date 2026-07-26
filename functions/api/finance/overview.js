import {
  CACHE_SECONDS,
  REGION_DEFINITIONS,
  guardReadOnly,
  publicRegionSummary,
  successResponse
} from "./_shared.js";

const ENDPOINT = "/api/finance/overview";

export async function onRequest(context) {
  const guarded = guardReadOnly(context.request, ENDPOINT);
  if (guarded) return guarded;

  return successResponse({
    endpoint: ENDPOINT,
    cacheSeconds: CACHE_SECONDS.snapshot,
    sourceMode: "unavailable",
    sources: [],
    data: {
      sourceMode: "unavailable",
      status: "unavailable",
      snapshot: null,
      reason: "No redistribution-safe official market quote feed is configured.",
      fxHref: "/api/finance/fx",
      regions: Object.values(REGION_DEFINITIONS).map(publicRegionSummary)
    }
  });
}
