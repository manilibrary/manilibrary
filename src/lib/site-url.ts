const DEFAULT_PUBLIC_SITE = "https://www.manilibrary.com";

/** Canonical public site origin (no trailing slash). Prefers NEXT_PUBLIC_SITE_URL / SITE_URL. */
export function publicSiteOrigin(fallbackOrigin?: string): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (fallbackOrigin?.trim()) return fallbackOrigin.trim().replace(/\/$/, "");
  return DEFAULT_PUBLIC_SITE;
}

export function referralSignupUrl(referralCode: string, fallbackOrigin?: string): string {
  const base = publicSiteOrigin(fallbackOrigin);
  return `${base}/register?ref=${encodeURIComponent(referralCode)}`;
}
