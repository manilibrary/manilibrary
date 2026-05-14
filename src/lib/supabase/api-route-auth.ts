import "server-only";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

const BEARER_RE = /^Bearer\s+(\S+)/i;

/** Reads `Authorization: Bearer <jwt>` from a Route Handler `Request` (case-insensitive header name). */
export function getBearerAccessToken(request: Request): string | null {
  const raw =
    request.headers.get("Authorization")?.trim() ?? request.headers.get("authorization")?.trim() ?? "";
  const m = raw.match(BEARER_RE);
  return m?.[1] ?? null;
}

/**
 * Resolves the signed-in user for App Router `/api` routes.
 * - **Browser:** Supabase session cookies (Next.js + `@supabase/ssr`).
 * - **Native / Postman:** `Authorization: Bearer <access_token>` from `signInWithPassword` (or refreshed session).
 */
export async function getAuthUserForApiRequest(request: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const jwt = getBearerAccessToken(request);
  if (jwt) {
    return supabase.auth.getUser(jwt);
  }
  return supabase.auth.getUser();
}
