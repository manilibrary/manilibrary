import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { fetchActiveCouponForPlan, isCouponPlanCode } from "@/lib/coupons/library-coupons";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const {
    data: { user },
  } = await getAuthUserForApiRequest(request);
  if (!user) return apiError("Sign in required.", 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const code = typeof body.code === "string" ? body.code : "";
  const planCode = typeof body.planCode === "string" ? body.planCode.trim() : "";
  if (!isCouponPlanCode(planCode)) {
    return apiError("Choose a valid plan.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const check = await fetchActiveCouponForPlan(admin, code, planCode);
  if (!check.ok) return apiError(check.error, 400);

  return apiSuccess("Coupon applied.", {
    code: check.coupon.code,
    discountPercent: check.coupon.discount_percent,
  });
}
