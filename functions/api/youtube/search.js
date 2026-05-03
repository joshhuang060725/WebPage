import { claimYoutubeUnits, quotaFailure } from "../../_lib/quota-guard.js";

const SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const CACHE_SECONDS = 3600;
const MAX_QUERY_LENGTH = 80;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? `public, max-age=${CACHE_SECONDS}` : "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function normalizeLanguage(value) {
  if (value === "zh-Hant" || value === "zh-TW") return "zh-Hant";
  if (value === "zh-Hans" || value === "zh-CN") return "zh-Hans";
  return "en";
}

function normalizeRegion(value) {
  const region = String(value || "TW")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  return region || "TW";
}

function normalizeItem(item) {
  const videoId = item?.id?.videoId;
  const snippet = item?.snippet;
  if (!videoId || !snippet?.title) return null;

  return {
    id: videoId,
    title: snippet.title,
    channelTitle: snippet.channelTitle || "",
    thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "",
    publishedAt: snippet.publishedAt || ""
  };
}

function errorBody(code, message) {
  return {
    error: { code, message },
    items: [],
    cached: false
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, MAX_QUERY_LENGTH);
  const lang = normalizeLanguage(url.searchParams.get("lang"));
  const region = normalizeRegion(url.searchParams.get("region"));

  if (!q) {
    return json(errorBody("missing_query", "Query is required."), 400);
  }

  if (!env.YOUTUBE_API_KEY) {
    return json(errorBody("missing_api_key", "YOUTUBE_API_KEY is not configured."), 500);
  }

  const cacheUrl = new URL(request.url);
  cacheUrl.search = new URLSearchParams({
    q: q.toLowerCase(),
    lang,
    region
  }).toString();
  const cacheKey = new Request(cacheUrl.toString(), request);

  if (typeof caches !== "undefined") {
    const cachedResponse = await caches.default.match(cacheKey);
    if (cachedResponse) {
      const cachedPayload = await cachedResponse.json();
      return json({ ...cachedPayload, cached: true }, 200, { "X-Cache": "HIT" });
    }
  }

  const youtubeQuota = await claimYoutubeUnits(env, 100);
  if (!youtubeQuota.ok) return quotaFailure(youtubeQuota);

  const apiUrl = new URL(SEARCH_ENDPOINT);
  apiUrl.searchParams.set("part", "snippet");
  apiUrl.searchParams.set("type", "video");
  apiUrl.searchParams.set("maxResults", "8");
  apiUrl.searchParams.set("safeSearch", "moderate");
  apiUrl.searchParams.set("videoEmbeddable", "true");
  apiUrl.searchParams.set("q", q);
  apiUrl.searchParams.set("regionCode", region);
  apiUrl.searchParams.set("relevanceLanguage", lang);
  apiUrl.searchParams.set("key", env.YOUTUBE_API_KEY);

  const apiResponse = await fetch(apiUrl, {
    headers: { Accept: "application/json" }
  });
  const payload = await apiResponse.json().catch(() => ({}));

  if (!apiResponse.ok) {
    const reason = payload?.error?.errors?.[0]?.reason || "youtube_api_error";
    const message = payload?.error?.message || "YouTube API request failed.";
    return json(errorBody(reason, message), apiResponse.status >= 500 ? 502 : apiResponse.status);
  }

  const responsePayload = {
    items: (payload.items || []).map(normalizeItem).filter(Boolean),
    cached: false
  };
  const response = json(responsePayload);

  if (typeof caches !== "undefined" && context.waitUntil) {
    context.waitUntil(caches.default.put(cacheKey, response.clone()));
  }

  return response;
}
