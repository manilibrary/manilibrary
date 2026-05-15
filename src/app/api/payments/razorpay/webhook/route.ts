import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { finalizeRazorpayPaymentRow } from "@/lib/payments/finalize-razorpay-payment";
import { promoteCheckoutKycStaging } from "@/lib/kyc/promote-checkout-kyc-staging";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay-webhook";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { JSON_BODY_MAX_BYTES } from "@/lib/security/field-limits";

export const runtime = "nodejs";

type WebhookPaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
};

type WebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: WebhookPaymentEntity };
  };
};

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return apiError("RAZORPAY_WEBHOOK_SECRET is not configured.", 503);
  }

  const signature = request.headers.get("x-razorpay-signature")?.trim() ?? "";
  if (!signature) {
    return apiError("Missing Razorpay signature.", 400);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return apiError("Could not read webhook body.", 400);
  }

  if (rawBody.length > JSON_BODY_MAX_BYTES) {
    return apiError("Webhook body too large.", 413);
  }

  if (!verifyRazorpayWebhookSignature(rawBody, signature, secret)) {
    return apiError("Invalid webhook signature.", 401);
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return apiError("Invalid webhook JSON.", 400);
  }

  const event = payload.event ?? "";
  if (event !== "payment.captured" && event !== "payment.authorized") {
    return apiSuccess("Event ignored.", { event });
  }

  const entity = payload.payload?.payment?.entity;
  const razorpay_payment_id = entity?.id?.trim();
  const razorpay_order_id = entity?.order_id?.trim();
  if (!razorpay_payment_id || !razorpay_order_id) {
    return apiError("Webhook missing payment id or order id.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data: existingPaid } = await admin
    .from("payments")
    .select("id")
    .eq("provider_payment_id", razorpay_payment_id)
    .eq("status", "paid")
    .maybeSingle();

  if (existingPaid?.id) {
    return apiSuccess("Payment already processed.", { payment_id: existingPaid.id });
  }

  const { data: pendingRows, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, metadata")
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (payErr) {
    return apiErrorSafe(payErr, 500);
  }

  const pay = (pendingRows ?? []).find((row) => {
    const m = (row.metadata ?? {}) as Record<string, unknown>;
    return m.razorpay_order_id === razorpay_order_id;
  });

  if (!pay) {
    return apiSuccess("No pending payment for this order.", { razorpay_order_id });
  }

  const finalized = await finalizeRazorpayPaymentRow(admin, {
    paymentId: pay.id,
    expectedUserId: pay.user_id,
    razorpay_payment_id,
  });

  if (!finalized.ok) {
    return apiError(finalized.error, finalized.status);
  }

  await promoteCheckoutKycStaging(admin, pay.user_id);

  return apiSuccess("Payment recorded.", {
    payment_id: pay.id,
    alreadyPaid: finalized.alreadyPaid === true,
  });
}
