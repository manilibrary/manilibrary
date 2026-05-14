/**
 * Short-lived session cache for admin attendance UI (sessionStorage).
 *
 * Safe to store: last successful attendance API payloads (names, times, seat labels).
 * Do NOT store: passwords, refresh tokens, API keys, or raw session cookies.
 *
 * sessionStorage (vs cookies): not sent on HTTP requests, tab-scoped, cleared when the
 * tab closes — smaller blast radius than putting PII in cookies.
 */

const SCHEMA_VERSION = 1 as const;
/** Stale-while-revalidate: show cached rows briefly while the server/eTime catches up. */
export const ADMIN_ATTENDANCE_SESSION_TTL_MS = 180_000;

const MAX_STORE_CHARS = 750_000;

type Envelope<T> = { v: typeof SCHEMA_VERSION; savedAt: number; payload: T };

function parseEnvelope<T>(raw: string): Envelope<T> | null {
  if (raw.length > MAX_STORE_CHARS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.v !== SCHEMA_VERSION || typeof o.savedAt !== "number") return null;
  return o as Envelope<T>;
}

export function readAdminAttendanceSessionCache<T>(key: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw == null) return null;
    const env = parseEnvelope<T>(raw);
    if (!env) return null;
    if (Date.now() - env.savedAt > ttlMs) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return env.payload;
  } catch {
    return null;
  }
}

export function writeAdminAttendanceSessionCache<T>(key: string, payload: T): void {
  if (typeof window === "undefined") return;
  try {
    const env: Envelope<T> = { v: SCHEMA_VERSION, savedAt: Date.now(), payload };
    const raw = JSON.stringify(env);
    if (raw.length > MAX_STORE_CHARS) return;
    window.sessionStorage.setItem(key, raw);
  } catch {
    // QuotaExceeded or private mode — ignore.
  }
}

export function adminAttendancePanelDailyKey(fromIso: string, toIso: string, empcode: string): string {
  return `ml:admAtt:panel:daily:v1:${fromIso}:${toIso}:${encodeURIComponent(empcode.trim())}`;
}

export function adminAttendancePanelPunchesKey(fromIso: string, toIso: string): string {
  return `ml:admAtt:panel:punch:v1:${fromIso}:${toIso}`;
}

export const adminAttendanceOverviewDailyKey = "ml:admAtt:overview:daily:v1";
export const adminAttendanceOverviewPunchesKey = "ml:admAtt:overview:punch:v1";
