import { randomBytes } from "crypto";

import { SITE_VISITOR_COOKIE, SITE_VISITOR_KEY_MIN_LEN } from "@/lib/site-visits/constants";

export function generateVisitorKey(): string {
  return randomBytes(16).toString("hex");
}

export function normalizeVisitorKey(raw: string | undefined | null): string | null {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (key.length < SITE_VISITOR_KEY_MIN_LEN) return null;
  if (key.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) return null;
  return key;
}

export function visitorKeyFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SITE_VISITOR_COOKIE) {
      return normalizeVisitorKey(decodeURIComponent(rest.join("=")));
    }
  }
  return null;
}
