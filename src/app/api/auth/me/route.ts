import { apiError, apiSuccess } from "@/lib/api/json-response";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";

/**
 * Current user for native apps (Bearer access token) or browser (cookies).
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { data: authData, error: authErr } = await getAuthUserForApiRequest(request);
  if (authErr || !authData?.user) {
    return apiError("Sign in required.", 401);
  }
  const user = authData.user;

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("full_name, phone, email, is_admin, is_superadmin")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (profErr) {
    return apiError(profErr.message, 500);
  }
  if (!profile) {
    return apiError("No library profile for this account.", 403);
  }

  const isStaff = profile.is_admin === true || profile.is_superadmin === true;
  const role = isStaff ? "admin" : "student";

  return apiSuccess("OK.", {
    id: user.id,
    role,
    name: (profile.full_name as string) ?? "Member",
    email: (profile.email as string | null) ?? user.email ?? undefined,
    phone: (profile.phone as string | null) ?? undefined,
  });
}
