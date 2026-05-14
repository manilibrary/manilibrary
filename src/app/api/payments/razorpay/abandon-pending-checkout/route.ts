import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { cancelPendingPaymentMembership } from "@/lib/payments/cancel-pending-checkout-membership";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * User closed Razorpay without paying. Cancels the draft membership only if this payment is still pending,
 * so a late verify (success) that already flipped the row is not clobbered.
 */
export async function POST(request: Request) {
  let paymentId: string;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (typeof raw.payment_id !== "string" || !raw.payment_id.trim()) {
      return apiError("Body must include payment_id.", 400);
    }
    paymentId = raw.payment_id.trim();
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create Supabase admin client.");
  }

  const { data: pay, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, membership_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (payErr || !pay) {
    return apiError("Payment not found.", 404);
  }
  if (pay.user_id !== user.id) {
    return apiError("Forbidden.", 403);
  }
  if (pay.status !== "pending") {
    return apiSuccess("Checkout already completed or closed; no draft membership to cancel.", { skipped: true });
  }

  await cancelPendingPaymentMembership(admin, pay.membership_id as string | null | undefined);

  return apiSuccess("Pending checkout membership cancelled.", { paymentId: pay.id });
}
