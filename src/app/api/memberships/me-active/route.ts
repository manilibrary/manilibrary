import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const {
    data: { user },
  } = await getAuthUserForApiRequest(request);
  if (!user) {
    return apiError("Sign in required.", 401, { signedIn: false });
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not load membership.");
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
    return apiErrorSafe(error, 500);
  }

  const has = data != null;
  return apiSuccess(
    has ? "Active membership found for your account." : "Signed in; no active membership in the current window.",
    { signedIn: true, membership: data ?? null },
  );
}
