import { quotaJson, readQuotaStatus } from "../../_lib/quota-guard.js";

export async function onRequestGet({ env }) {
  return quotaJson(await readQuotaStatus(env));
}
