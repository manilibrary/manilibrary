import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { clearClientCache } from "@/lib/client-data-cache";
import { clearAllUxPreferenceCookies } from "@/lib/ux-cookies";

import { clearStaleSupabaseSession, isStaleRefreshTokenError } from "./stale-session";

let browserClient: SupabaseClient | undefined;
let recoveryAttached = false;
let clearingStaleSession = false;

function attachStaleSessionRecovery(supabase: SupabaseClient) {
  if (recoveryAttached || typeof window === "undefined") return;
  recoveryAttached = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (clearingStaleSession) return;
    if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !session)) {
      clearClientCache();
    }
  });
}

/** One browser client — avoids duplicate auto-refresh races (Supabase SSR guidance). */
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    attachStaleSessionRecovery(browserClient);
  }
  return browserClient;
}

/** getUser + silent recovery when refresh token in cookies is invalid. */
export async function getBrowserUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error) return user;

  if (!isStaleRefreshTokenError(error)) return null;

  if (!clearingStaleSession) {
    clearingStaleSession = true;
    try {
      await clearStaleSupabaseSession(supabase);
      clearAllUxPreferenceCookies();
      clearClientCache();
    } finally {
      clearingStaleSession = false;
    }
  }
  return null;
}
