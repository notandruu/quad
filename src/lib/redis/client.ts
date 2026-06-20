import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * Lazily construct the Upstash Redis REST client. Returns null when env vars
 * are missing so callers can degrade gracefully in local/dev without Redis.
 */
export function getRedis(): Redis | null {
  if (client) return client;

  const url = process.env.KALI_REDIS_REST_URL;
  const token = process.env.KALI_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  client = new Redis({ url, token });
  return client;
}

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.KALI_REDIS_REST_URL && process.env.KALI_REDIS_REST_TOKEN
  );
}

export function eventTtlSeconds(): number {
  const raw = process.env.KALI_AUDIT_EVENT_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : 86_400;
}
