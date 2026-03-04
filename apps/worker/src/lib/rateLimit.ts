/**
 * KV-based rate limiter for CF Workers.
 * Key format: rl:{ip}:{route}:{hour_bucket}
 * TTL: 2 hours (auto-cleanup)
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

const LIMITS: Record<string, { max: number; window: number }> = {
  analyze:    { max: 10,  window: 3600 },
  search_ai:  { max: 30,  window: 3600 },
  search_sql: { max: 100, window: 3600 },
  events:     { max: 1000, window: 3600 },
  reports:    { max: 1000, window: 3600 },
};

export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  route: string,
): Promise<RateLimitResult> {
  const config = LIMITS[route] ?? { max: 100, window: 3600 };
  const bucket = Math.floor(Date.now() / (config.window * 1000));
  const key = `rl:${ip}:${route}:${bucket}`;

  const current = parseInt(await kv.get(key) ?? '0', 10);

  if (current >= config.max) {
    return { allowed: false, remaining: 0, limit: config.max };
  }

  await kv.put(key, String(current + 1), { expirationTtl: config.window * 2 });

  return {
    allowed: true,
    remaining: config.max - current - 1,
    limit: config.max,
  };
}
