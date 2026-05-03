import { claimR2ClassB, quotaFailure } from "../../_lib/quota-guard.js";

function cleanKey(value) {
  const parts = Array.isArray(value) ? value : [value];
  return parts
    .join("/")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.+/g, "")
    .replace(/\/{2,}/g, "/");
}

export async function onRequestGet({ env, params }) {
  if (!env.ASSETS_BUCKET) {
    return new Response("ASSETS_BUCKET R2 binding is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const key = cleanKey(params.path);
  if (!key) {
    return new Response("Asset key is required.", {
      status: 400,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const quota = await claimR2ClassB(env);
  if (!quota.ok) return quotaFailure(quota);

  const object = await env.ASSETS_BUCKET.get(key);
  if (!object) {
    return new Response("Asset not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("X-Quota-Guard", quota.enforced ? "enforced" : "disabled");
  headers.set("X-Storage-Provider", "r2");

  return new Response(object.body, { headers });
}
