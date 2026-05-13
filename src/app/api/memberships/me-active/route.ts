import { apiError, apiSuccess } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("Sign in required.", 401, { signedIn: false });
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load membership.";
    return apiError(msg, 503);
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("memberships")
    .select("id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until")
    .eq("user_id", user.id)
    .eq("status", "active")
    .or(
      `and(plan_kind.eq.long_term,valid_until.gte.${today}),and(plan_kind.eq.short_term,ends_at.gte.${now.toISOString()})`,
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return apiError(error.message, 500);
  }

  const has = data != null;
  return apiSuccess(
    has ? "Active membership found for your account." : "Signed in; no active membership in the current window.",
    { signedIn: true, membership: data ?? null },
  );
}
