import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { buildStudentMemberProfileBody } from "@/lib/members/student-member-profile-envelope";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Full member profile for apps (same facts as web dashboard “Your profile” + intake fields).
 */
export async function GET(request: Request) {
  const { data: authData, error: authErr } = await getAuthUserForApiRequest(request);
  if (authErr || !authData?.user) {
    return apiError("Sign in required.", 401);
  }
  const user = authData.user;

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not load profile.");
  }

  const built = await buildStudentMemberProfileBody(admin, user);
  if (!built.ok) {
    return apiError(built.message, built.status);
  }
  return apiSuccess("OK.", built.body);
}
