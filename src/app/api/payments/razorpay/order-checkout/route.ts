import { apiError, apiErrorSafe, apiSuccess } from "@/lib/api/json-response";
import { rupeesToRazorpayPaise } from "@/lib/payments/pricing";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/** Resume Razorpay modal for an existing pending payment (app browser / resume-payment page). */
export async function GET(request: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  if (!keyId) {
    return apiError("Razorpay is not configured.", 503);
  }

  const paymentId = new URL(request.url).searchParams.get("payment_id")?.trim();
  if (!paymentId) {
    return apiError("Query payment_id is required.", 400);
  }

  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create admin client.");
  }

  const { data: pay, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, amount_rupees, currency, metadata")
    .eq("id", paymentId)
    .maybeSingle();

  if (payErr || !pay) {
    return apiError("Payment not found.", 404);
  }
  if (pay.user_id !== user.id) {
    return apiError("Forbidden.", 403);
  }
  if (pay.status !== "pending") {
    return apiError(`Payment is already ${pay.status}.`, 400);
  }

  const meta = (pay.metadata ?? {}) as Record<string, unknown>;
  const orderId = typeof meta.razorpay_order_id === "string" ? meta.razorpay_order_id.trim() : "";
  if (!orderId) {
    return apiError("This payment has no Razorpay order id.", 400);
  }

  return apiSuccess("Checkout parameters for pending payment.", {
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? keyId,
    orderId,
    amount: rupeesToRazorpayPaise(Number(pay.amount_rupees)),
    currency: pay.currency ?? "INR",
    paymentId: pay.id,
  });
}
