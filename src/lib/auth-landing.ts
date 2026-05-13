/** Post-auth routes — keep in sync with `proxy.ts` redirects. */
export const MEMBER_LANDING_PATH = "/";
export const STAFF_LANDING_PATH = "/dashboard";
/** Member-only pages (still allowed when signed in). */
export const MEMBER_ACCOUNT_PATH = "/dashboard/me/membership";
/** Seat, renewals, history, recover payment. */
export const MEMBER_MEMBERSHIP_PATH = "/dashboard/me/my-membership";

/** Safe internal path for `?next=` after login (same-origin relative only). */
export function sanitizeInternalNext(next: string | null | undefined): string | null {
  if (next == null) return null;
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("://")) return null;
  return t;
}
