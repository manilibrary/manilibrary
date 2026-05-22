import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, setClientCache } from "@/lib/client-data-cache";
import { createClient } from "@/lib/supabase/client";

type MeActiveCachePayload = {
  signedIn: boolean;
  membership: unknown;
  error: string | null;
};

/** After login: prime tab cache so home + dashboard show membership without a cold wait. */
export async function warmMemberClientCache(userId: string): Promise<void> {
  const supabase = createClient();

  const memP = supabase
    .from("memberships")
    .select("id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(32);

  const meActiveP = fetch("/api/memberships/me-active", { cache: "no-store" });

  const [memRes, meActiveRes] = await Promise.all([memP, meActiveP]);

  if (!memRes.error && memRes.data) {
    setClientCache(ddcKey.memberships(userId), memRes.data, CLIENT_DATA_CACHE_TTL_MS);
  }

  try {
    if (meActiveRes.ok) {
      const j = (await meActiveRes.json()) as {
        ok?: boolean;
        signedIn?: boolean;
        membership?: unknown;
        error?: string;
      };
      if (j.ok !== false) {
        const payload: MeActiveCachePayload = {
          signedIn: j.signedIn ?? true,
          membership: j.membership ?? null,
          error: null,
        };
        setClientCache(ddcKey.meActive(userId), payload, CLIENT_DATA_CACHE_TTL_MS);
      }
    }
  } catch {
    /* network — ActiveMembershipProvider will refetch */
  }
}
