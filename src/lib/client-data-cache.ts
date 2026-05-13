/**
 * In-memory cache plus sessionStorage mirror for the same browser tab.
 * Speeds repeat navigations and full reloads; cleared on sign-out.
 * Do not store secrets — only data already returned from APIs under the user session.
 */

export const CLIENT_DATA_CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes
/** Seat maps change quickly; keep occupancy fresher than profile-style data. */
export const CLIENT_SEAT_OCC_CACHE_TTL_MS = 90 * 1000;

type Entry = { data: unknown; expiresAt: number };

const store = new Map<string, Entry>();

const SESSION_SCOPE = "ml_ddc_ss:v1:";

function sessionKey(logicalKey: string): string {
  return SESSION_SCOPE + encodeURIComponent(logicalKey);
}

function readSessionEntry(logicalKey: string): Entry | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(logicalKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry;
    if (typeof parsed?.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionEntry(logicalKey: string, entry: Entry): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(sessionKey(logicalKey), JSON.stringify(entry));
  } catch {
    // private mode / quota
  }
}

function deleteSessionEntry(logicalKey: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(sessionKey(logicalKey));
  } catch {
    /* ignore */
  }
}

function clearAllSessionScope(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(SESSION_SCOPE)) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

function logicalKeyFromSessionStorageKey(storageKey: string): string | null {
  if (!storageKey.startsWith(SESSION_SCOPE)) return null;
  try {
    return decodeURIComponent(storageKey.slice(SESSION_SCOPE.length));
  } catch {
    return null;
  }
}

export function getClientCache<T>(key: string): T | null {
  const mem = store.get(key);
  if (mem && Date.now() <= mem.expiresAt) {
    return mem.data as T;
  }
  if (mem) store.delete(key);

  const disk = readSessionEntry(key);
  if (!disk || Date.now() > disk.expiresAt) {
    if (disk) deleteSessionEntry(key);
    return null;
  }
  store.set(key, disk);
  return disk.data as T;
}

export function setClientCache(key: string, data: unknown, ttlMs = CLIENT_DATA_CACHE_TTL_MS): void {
  const entry: Entry = { data, expiresAt: Date.now() + ttlMs };
  store.set(key, entry);
  writeSessionEntry(key, entry);
}

export function invalidateClientCachePrefix(prefix: string): void {
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) {
      store.delete(k);
      deleteSessionEntry(k);
    }
  }
  if (typeof sessionStorage === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const sk = sessionStorage.key(i);
      if (!sk?.startsWith(SESSION_SCOPE)) continue;
      const logical = logicalKeyFromSessionStorageKey(sk);
      if (logical?.startsWith(prefix)) keys.push(sk);
    }
    for (const sk of keys) sessionStorage.removeItem(sk);
  } catch {
    /* ignore */
  }
}

/** Call on sign-out so the next user on a shared device does not see cached rows. */
export function clearClientCache(): void {
  store.clear();
  clearAllSessionScope();
}

/** Namespaced keys for dashboard client fetches */
export const ddcKey = {
  profileNav: (userId: string) => `ml_ddc:profile_nav:${userId}`,
  profileMemberHome: (userId: string) => `ml_ddc:profile_memberhome:${userId}`,
  memberships: (userId: string) => `ml_ddc:memberships:${userId}`,
  verifDocs: (userId: string) => `ml_ddc:verif_docs:${userId}`,
  meActive: (userId: string) => `ml_ddc:me_active:${userId}`,
  meActiveGuest: () => `ml_ddc:me_active:guest`,
  seatOccupancy: (planKind: string, startDate: string, durationKey: string) =>
    `ml_ddc:seat_occ:${planKind}:${startDate}:${durationKey}`,
  memberPayments: (userId: string) => `ml_ddc:member_payments:${userId}`,
} as const;
