/**
 * Non-sensitive UX preferences only (namespaced `ml_ux_*`).
 * Do not store auth tokens, PII, payment data, or admin flags here.
 *
 * Cookies auto-expire after {@link UX_COOKIE_MAX_AGE_SECONDS} (1 week).
 * {@link clearAllUxPreferenceCookies} removes them immediately (e.g. sign-out).
 */

export const UX_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 1 week

const PREFIX = "ml_ux_";

export const UX_PREFERENCE_COOKIE_NAMES = ["dash_sidebar", "site_nav_drawer"] as const;
export type UxPreferenceCookieName = (typeof UX_PREFERENCE_COOKIE_NAMES)[number];

type DrawerState = "open" | "closed";

const ALLOWED: Record<UxPreferenceCookieName, readonly DrawerState[]> = {
  dash_sidebar: ["open", "closed"],
  site_nav_drawer: ["open", "closed"],
};

function parseBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const needle = `${name}=`;
  const parts = document.cookie.split("; ");
  for (const part of parts) {
    if (!part.startsWith(needle)) continue;
    return decodeURIComponent(part.slice(needle.length));
  }
  return null;
}

export function getUxPreferenceCookie(name: UxPreferenceCookieName): DrawerState | null {
  const raw = parseBrowserCookie(`${PREFIX}${name}`);
  if (raw === "open" || raw === "closed") {
    const allowed = ALLOWED[name];
    return allowed.includes(raw as DrawerState) ? raw : null;
  }
  return null;
}

export function setUxPreferenceCookie(name: UxPreferenceCookieName, value: DrawerState): void {
  if (typeof document === "undefined") return;
  if (!ALLOWED[name].includes(value)) return;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  const segments = [
    `${PREFIX}${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${UX_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) segments.push("Secure");
  document.cookie = segments.join("; ");
}

/** Expire all known UX preference cookies (e.g. shared device after sign-out). */
export function clearAllUxPreferenceCookies(): void {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  for (const name of UX_PREFERENCE_COOKIE_NAMES) {
    const segments = [`${PREFIX}${name}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
    if (secure) segments.push("Secure");
    document.cookie = segments.join("; ");
  }
}
