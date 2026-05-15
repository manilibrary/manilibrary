export const SITE_VISITOR_COOKIE = "ml_visitor_id";

/** Matches `site_visits_visitor_key_len` in Postgres. */
export const SITE_VISITOR_KEY_MIN_LEN = 8;

/** Same browser (visitor_key) is not counted again within this window, regardless of page. */
export const SITE_VISIT_DEDUPE_MS = 20 * 60 * 1000;

export const SITE_VISITOR_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;
