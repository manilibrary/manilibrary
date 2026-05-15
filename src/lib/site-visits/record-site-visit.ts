import type { SupabaseClient } from "@supabase/supabase-js";

import { SITE_VISIT_DEDUPE_MS } from "@/lib/site-visits/constants";

export type RecordSiteVisitInput = {
  visitorKey: string;
  path: string;
  referrer: string | null;
  userId: string | null;
};

export async function recordSiteVisit(
  admin: SupabaseClient,
  input: RecordSiteVisitInput,
): Promise<{ recorded: boolean }> {
  const path = input.path.slice(0, 512) || "/";
  const referrer = input.referrer ? input.referrer.slice(0, 1024) : null;
  const dedupeSince = new Date(Date.now() - SITE_VISIT_DEDUPE_MS).toISOString();

  // One counted page view per browser per 20 minutes (any path). Different visitors always count separately.
  const { data: recent } = await admin
    .from("site_visits")
    .select("id")
    .eq("visitor_key", input.visitorKey)
    .gte("visited_at", dedupeSince)
    .limit(1);

  if (recent && recent.length > 0) {
    return { recorded: false };
  }

  const { error } = await admin.from("site_visits").insert({
    visitor_key: input.visitorKey,
    path,
    referrer,
    user_id: input.userId,
    metadata: {},
  });

  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      return { recorded: false };
    }
    throw error;
  }

  return { recorded: true };
}
