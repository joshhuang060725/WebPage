const DEFAULTS = {
  apiDailyRequests: 90000,
  youtubeDailyUnits: 9000,
  r2MonthlyClassB: 9000000
};

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function enabled(env) {
  return String(env.ENFORCE_QUOTA_GUARD || "").toLowerCase() === "true";
}

function limits(env) {
  return {
    apiDailyRequests: numberFromEnv(env.LIMIT_API_DAILY_REQUESTS, DEFAULTS.apiDailyRequests),
    youtubeDailyUnits: numberFromEnv(env.LIMIT_YOUTUBE_DAILY_UNITS, DEFAULTS.youtubeDailyUnits),
    r2MonthlyClassB: numberFromEnv(env.LIMIT_R2_MONTHLY_CLASS_B, DEFAULTS.r2MonthlyClassB)
  };
}

function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthStamp(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function readCounter(kv, key) {
  const raw = await kv.get(key);
  const value = Number(raw || 0);
  return Number.isFinite(value) ? value : 0;
}

async function claim(env, key, amount, limit, reset, label) {
  if (!enabled(env)) {
    return { ok: true, enforced: false, key, amount, limit, reset, label };
  }

  if (!env.USAGE_KV) {
    return {
      ok: false,
      status: 503,
      code: "quota_guard_not_configured",
      message: "Quota guard is enabled, but USAGE_KV is not bound.",
      key,
      amount,
      limit,
      reset,
      label
    };
  }

  const current = await readCounter(env.USAGE_KV, key);
  const next = current + amount;

  if (next > limit) {
    return {
      ok: false,
      status: 429,
      code: "quota_exceeded",
      message: `${label} quota exceeded. This endpoint is disabled until ${reset}.`,
      key,
      current,
      requested: amount,
      limit,
      reset,
      label
    };
  }

  await env.USAGE_KV.put(key, String(next));
  return { ok: true, enforced: true, key, current: next, amount, limit, reset, label };
}

export function quotaJson(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function quotaFailure(result) {
  return quotaJson(
    {
      error: {
        code: result.code,
        message: result.message
      },
      quota: {
        key: result.key,
        current: result.current,
        requested: result.requested,
        limit: result.limit,
        reset: result.reset,
        label: result.label
      }
    },
    result.status || 429
  );
}

export async function claimApiRequest(env, amount = 1) {
  const day = dayStamp();
  return claim(
    env,
    `daily:${day}:api_requests`,
    amount,
    limits(env).apiDailyRequests,
    `${day} 24:00 UTC`,
    "API daily requests"
  );
}

export async function claimYoutubeUnits(env, units = 100) {
  const day = dayStamp();
  return claim(
    env,
    `daily:${day}:youtube_units`,
    units,
    limits(env).youtubeDailyUnits,
    `${day} 24:00 UTC`,
    "YouTube daily API units"
  );
}

export async function claimR2ClassB(env, amount = 1) {
  const month = monthStamp();
  return claim(
    env,
    `monthly:${month}:r2_class_b`,
    amount,
    limits(env).r2MonthlyClassB,
    `${month}-01 of next month UTC`,
    "R2 monthly Class B operations"
  );
}

export async function readQuotaStatus(env) {
  const day = dayStamp();
  const month = monthStamp();
  const configured = Boolean(env.USAGE_KV);
  const currentLimits = limits(env);

  async function get(key) {
    if (!configured) return null;
    return readCounter(env.USAGE_KV, key);
  }

  return {
    enforced: enabled(env),
    configured,
    periods: {
      day,
      month
    },
    limits: currentLimits,
    usage: {
      apiDailyRequests: await get(`daily:${day}:api_requests`),
      youtubeDailyUnits: await get(`daily:${day}:youtube_units`),
      r2MonthlyClassB: await get(`monthly:${month}:r2_class_b`)
    }
  };
}
