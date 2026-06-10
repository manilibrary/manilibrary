import { createClient } from "@/lib/supabase/client";
import { clearClientCache } from "@/lib/client-data-cache";
import { clearStaleSupabaseSession, isStaleRefreshTokenError } from "@/lib/supabase/stale-session";
import { clearAllUxPreferenceCookies } from "@/lib/ux-cookies";

/** Fired after cookie/API login so client providers re-read session without a full reload. */
export const AUTH_SESSION_CHANGED_EVENT = "manilibrary:auth-changed";

export function notifyAuthSessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

async function recoverStaleBrowserSession(): Promise<void> {
  const supabase = createClient();
  await clearStaleSupabaseSession(supabase);
  clearAllUxPreferenceCookies();
  clearClientCache();
}

/** Sync browser auth and silently drop invalid refresh tokens (e.g. after DB reset). */
export async function syncBrowserAuthSession(): Promise<void> {
  const supabase = createClient();
  try {
    const { error } = await supabase.auth.getUser();
    if (error && isStaleRefreshTokenError(error)) {
      await recoverStaleBrowserSession();
    }
  } catch (e) {
    if (isStaleRefreshTokenError(e)) {
      await recoverStaleBrowserSession();
    }
  }
}
