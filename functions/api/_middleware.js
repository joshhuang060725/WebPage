import { claimApiRequest, quotaFailure } from "../_lib/quota-guard.js";

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return context.next();

  const result = await claimApiRequest(context.env);
  if (!result.ok) return quotaFailure(result);
  return context.next();
}
