/**
 * In-memory cache for recent Supabase reads (same browser tab / SPA session).
 * Speeds repeat dashboard navigations; cleared on full reload and on sign-out.
 * Do not store secrets — only data already returned from Supabase under the user session.
 */

export const CLIENT_DATA_CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes

type Entry = { data: unknown; expiresAt: number };

const store = new Map<string, Entry>();

export function getClientCache<T>(key: string): T | null {
  const e = store.get(key);
  if (!e || Date.now() > e.expiresAt) {
    if (e) store.delete(key);
    return null;
  }
  return e.data as T;
}

export function setClientCache(key: string, data: unknown, ttlMs = CLIENT_DATA_CACHE_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateClientCachePrefix(prefix: string): void {
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

/** Call on sign-out so the next user on a shared device does not see cached rows. */
export function clearClientCache(): void {
  store.clear();
}

/** Namespaced keys for dashboard client fetches */
export const ddcKey = {
  profileNav: (userId: string) => `ml_ddc:profile_nav:${userId}`,
  profileMemberHome: (userId: string) => `ml_ddc:profile_memberhome:${userId}`,
  memberships: (userId: string) => `ml_ddc:memberships:${userId}`,
  verifDocs: (userId: string) => `ml_ddc:verif_docs:${userId}`,
} as const;
