type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const PRUNE_EVERY_MS = 5 * 60 * 1000;
let lastPrune = Date.now();

function prune(now: number) {
  if (now - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = now;
  for (const [key, bucket] of store) {
    if (now >= bucket.resetAt) store.delete(key);
  }
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);
  const existing = store.get(key);
  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (existing.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { allowed: true };
}

export const RATE_WINDOWS = {
  authIp: { limit: 30, windowMs: 15 * 60 * 1000 },
  authEmail: { limit: 10, windowMs: 15 * 60 * 1000 },
  apiIp: { limit: 120, windowMs: 60 * 1000 },
  uploadIp: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const;
