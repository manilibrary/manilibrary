import { createClient } from "@/lib/supabase/client";

/** Fired after cookie/API login so client providers re-read session without a full reload. */
export const AUTH_SESSION_CHANGED_EVENT = "manilibrary:auth-changed";

export function notifyAuthSessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

/** Read HttpOnly session cookies into the Supabase browser client (server login does not fire onAuthStateChange). */
export async function syncBrowserAuthSession(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.getSession();
}
