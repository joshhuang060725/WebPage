import { claimApiRequest, quotaFailure } from "../_lib/quota-guard.js";

export async function onRequest(context) {
  const result = await claimApiRequest(context.env);
  if (!result.ok) return quotaFailure(result);

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("X-Quota-Guard", result.enforced ? "enforced" : "disabled");
  headers.set("X-Quota-Key", result.key);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
