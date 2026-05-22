import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

/** True when cookies hold a refresh token Supabase no longer accepts. */
export function isStaleRefreshTokenError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg =
    "message" in err && typeof (err as AuthError).message === "string"
      ? (err as AuthError).message.toLowerCase()
      : "";
  const code =
    "code" in err && typeof (err as AuthError).code === "string"
      ? String((err as AuthError).code).toLowerCase()
      : "";
  return (
    msg.includes("refresh token") ||
    msg.includes("invalid refresh") ||
    code === "refresh_token_not_found" ||
    code === "invalid_refresh_token"
  );
}

/** Drop broken auth cookies so the client stops retrying refresh. */
export async function clearStaleSupabaseSession(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Already cleared or network blip — safe to ignore.
  }
}
