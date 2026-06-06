import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  LIBRARY_COUPONS_SELECT,
  generateCouponCode,
  isCouponPlanCode,
  isValidCouponDiscount,
  rowToLibraryCoupon,
  type LibraryCouponRow,
} from "@/lib/coupons/library-coupons";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data, error } = await admin
    .from("library_coupons")
    .select(LIBRARY_COUPONS_SELECT)
    .order("created_at", { ascending: false });

  if (error) return apiErrorSafe(error, 500);

  const coupons = (data ?? []).map((r) => rowToLibraryCoupon(r as LibraryCouponRow));
  return apiSuccess("OK.", { coupons });
}

export async function POST(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const discountRaw = body.discountPercent;
  const discountPercent = typeof discountRaw === "number" ? discountRaw : Number(discountRaw);
  if (!isValidCouponDiscount(discountPercent)) {
    return apiError("Discount must be a whole number between 10 and 90.", 400);
  }

  const planCode = typeof body.planCode === "string" ? body.planCode.trim() : "";
  if (!isCouponPlanCode(planCode)) {
    return apiError("Choose a valid plan for this coupon.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  // Retry on the (rare) chance the random code collides with an existing one.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCouponCode();
    const { data, error } = await admin
      .from("library_coupons")
      .insert({
        code,
        discount_percent: discountPercent,
        plan_code: planCode,
        created_by: gate.userId,
      })
      .select(LIBRARY_COUPONS_SELECT)
      .single();

    if (!error && data) {
      return apiSuccess("Coupon generated.", {
        coupon: rowToLibraryCoupon(data as LibraryCouponRow),
      });
    }
    if (error && error.code !== "23505") {
      return apiErrorSafe(error, 400);
    }
  }

  return apiError("Could not generate a unique coupon code. Try again.", 503);
}
