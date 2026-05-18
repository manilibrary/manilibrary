import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { finalizeRazorpayPaymentRow } from "@/lib/payments/finalize-razorpay-payment";
import { promoteCheckoutKycStaging } from "@/lib/kyc/promote-checkout-kyc-staging";
import { verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay-hmac";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Demo checkout signature check. If `payment_id` is sent and the user is signed in,
 * also finalizes the membership payment row (same as `/api/payments/razorpay/verify`).
 */
export async function POST(request: Request) {
  const demoAllowed =
    process.env.ALLOW_VERIFY_PAYMENT_DEMO === "true" || process.env.NODE_ENV !== "production";
  if (!demoAllowed) {
    return apiError(
      "Demo signature check is disabled in production. Set ALLOW_VERIFY_PAYMENT_DEMO=true only on staging if you need it.",
      404,
    );
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return apiError("RAZORPAY_KEY_SECRET is not set.", 503);
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const orderId = raw.razorpay_order_id;
  const paymentIdRzp = raw.razorpay_payment_id;
  const signature = raw.razorpay_signature;
  const payment_id = typeof raw.payment_id === "string" ? raw.payment_id.trim() : "";

  if (typeof orderId !== "string" || typeof paymentIdRzp !== "string" || typeof signature !== "string") {
    return apiError("Missing or invalid fields: razorpay_order_id, razorpay_payment_id, razorpay_signature.", 400);
  }

  if (!verifyRazorpayPaymentSignature(orderId, paymentIdRzp, signature, secret)) {
    return apiError("Signature mismatch.", 400);
  }

  if (!payment_id) {
    return apiSuccess("Payment signature verified (demo checkout — no payment_id to update DB).");
  }

  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) {
    return apiError("Sign in required when payment_id is provided.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create admin client.");
  }

  const { data: pay, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, metadata")
    .eq("id", payment_id)
    .maybeSingle();

  if (payErr || !pay) {
    return apiError("Payment not found.", 404);
  }
  if (pay.user_id !== user.id) {
    return apiError("Forbidden.", 403);
  }

  const meta = (pay.metadata ?? {}) as Record<string, unknown>;
  if (meta.razorpay_order_id !== orderId) {
    return apiError("Order id does not match payment record.", 400);
  }

  if (pay.status === "paid") {
    return apiSuccess("Payment was already recorded.", { alreadyPaid: true, payment_id });
  }

  const fin = await finalizeRazorpayPaymentRow(admin, {
    paymentId: payment_id,
    expectedUserId: user.id,
    razorpay_payment_id: paymentIdRzp,
  });
  if (!fin.ok) {
    return apiErrorSafe(fin.error, fin.status, "Could not complete payment.");
  }

  await promoteCheckoutKycStaging(admin, user.id);

  return apiSuccess("Payment verified and membership activated.", {
    payment_id,
    alreadyPaid: fin.alreadyPaid === true,
  });
}
