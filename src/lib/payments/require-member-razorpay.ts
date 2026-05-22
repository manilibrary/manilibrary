import { safeClientErrorMessage } from "@/lib/api/json-response";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const STAFF_RAZORPAY_BLOCKED_MESSAGE =
  "Staff and admin accounts cannot use online checkout. Use Dashboard → Members to assign a seat and record payment (cash, UPI, etc.).";

export type MemberRazorpayGate =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 503; message: string };

/** Member self-checkout only — blocks `profiles.is_admin` and `is_superadmin`. */
export async function requireMemberNotStaffForRazorpay(request: Request): Promise<MemberRazorpayGate> {
  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) {
    return { ok: false, status: 401, message: "Sign in required." };
  }

  let svc;
  try {
    svc = createSupabaseServiceRoleClient();
  } catch (e) {
    return { ok: false, status: 503, message: safeClientErrorMessage(e, "Could not verify account.") };
  }

  const { data: profile, error } = await svc
    .from("profiles")
    .select("is_admin, is_superadmin")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 403, message: safeClientErrorMessage(error, "Could not verify account.") };
  }

  if (profile?.is_admin === true || profile?.is_superadmin === true) {
    return { ok: false, status: 403, message: STAFF_RAZORPAY_BLOCKED_MESSAGE };
  }

  return { ok: true, userId: user.id };
}
