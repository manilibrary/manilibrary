/** Post-auth routes — keep in sync with `proxy.ts` redirects. */
export const MEMBER_LANDING_PATH = "/";
export const STAFF_LANDING_PATH = "/dashboard";
/** Member-only pages (still allowed when signed in). */
export const MEMBER_ACCOUNT_PATH = "/dashboard/me/membership";
/** Seat, renewals, history, recover payment. */
export const MEMBER_MEMBERSHIP_PATH = "/dashboard/me/my-membership";
