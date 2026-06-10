import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { getMemberReferralSummary, getRefereePendingReferral } from "@/lib/referrals/library-referrals";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Sign in required.", 401);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  try {
    const [summary, signupReferral] = await Promise.all([
      getMemberReferralSummary(admin, user.id),
      getRefereePendingReferral(admin, user.id),
    ]);
    return apiSuccess("OK.", { referral: summary, signupReferral });
  } catch (e) {
    return apiErrorSafe(e, 500);
  }
}
