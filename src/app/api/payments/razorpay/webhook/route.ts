import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { finalizeRazorpayPaymentRow } from "@/lib/payments/finalize-razorpay-payment";
import { promoteCheckoutKycStaging } from "@/lib/kyc/promote-checkout-kyc-staging";
import {
  failRazorpayPaymentRow,
  findPendingPaymentByRazorpayOrderId,
} from "@/lib/payments/razorpay-pending-payment";
import {
  recordPaymentDisputeWebhook,
  recordPaymentPendingWebhook,
  recordPaymentRefundedWebhook,
} from "@/lib/payments/razorpay-webhook-side-effects";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/razorpay-webhook";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { JSON_BODY_MAX_BYTES } from "@/lib/security/field-limits";

export const runtime = "nodejs";

type WebhookPaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
};

type WebhookRefundEntity = {
  id?: string;
  payment_id?: string;
  amount?: number;
  status?: string;
};

type WebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: WebhookPaymentEntity };
    refund?: { entity?: WebhookRefundEntity };
  };
};

const SUCCESS_EVENTS = new Set(["payment.captured", "payment.authorized"]);

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
  const entity = payload.payload?.payment?.entity;
  const razorpay_payment_id = entity?.id?.trim();
  const razorpay_order_id = entity?.order_id?.trim();

  if (event === "payment.pending") {
    if (!razorpay_order_id) {
      return apiError("Webhook missing order id.", 400);
    }
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch (e) {
      return apiErrorSafe(e, 503, "Server misconfiguration.");
    }
    const pending = await recordPaymentPendingWebhook(admin, {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_status: entity?.status ?? "pending",
    });
    if (!pending.ok) {
      return apiError(pending.error, 500);
    }
    return apiSuccess("Payment pending noted.", { event, payment_id: pending.payment_id, skipped: pending.skipped });
  }

  if (event === "refund.processed" || event === "refund.created") {
    const refundEntity = payload.payload?.refund?.entity;
    const payId =
      typeof refundEntity?.payment_id === "string" ? refundEntity.payment_id.trim() : razorpay_payment_id;
    if (!payId?.startsWith("pay_")) {
      return apiSuccess("Refund ignored (no payment id).", { event });
    }
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch (e) {
      return apiErrorSafe(e, 503, "Server misconfiguration.");
    }
    const refunded = await recordPaymentRefundedWebhook(admin, {
      razorpay_payment_id: payId,
      refund_id: refundEntity?.id,
      amount_paise: typeof refundEntity?.amount === "number" ? refundEntity.amount : undefined,
    });
    if (!refunded.ok) {
      return apiError(refunded.error, 500);
    }
    return apiSuccess("Refund recorded.", {
      event,
      payment_id: refunded.payment_id,
      skipped: refunded.skipped,
    });
  }

  if (event.startsWith("payment.dispute.")) {
    if (!razorpay_payment_id?.startsWith("pay_")) {
      return apiSuccess("Dispute ignored (no payment id).", { event });
    }
    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch (e) {
      return apiErrorSafe(e, 503, "Server misconfiguration.");
    }
    const dispute = await recordPaymentDisputeWebhook(admin, {
      razorpay_payment_id,
      dispute_id: entity?.id,
      dispute_status: entity?.status,
      event,
    });
    if (!dispute.ok) {
      return apiError(dispute.error, 500);
    }
    return apiSuccess("Dispute recorded.", { event, payment_id: dispute.payment_id, skipped: dispute.skipped });
  }

  if (event === "payment.failed") {
    if (!razorpay_order_id) {
      return apiError("Webhook missing order id.", 400);
    }

    let admin;
    try {
      admin = createSupabaseServiceRoleClient();
    } catch (e) {
      return apiErrorSafe(e, 503, "Server misconfiguration.");
    }

    let pay;
    try {
      pay = await findPendingPaymentByRazorpayOrderId(admin, razorpay_order_id);
    } catch (e) {
      return apiErrorSafe(e, 500);
    }

    if (!pay) {
      return apiSuccess("No pending payment for this order.", { event, razorpay_order_id });
    }

    const failed = await failRazorpayPaymentRow(admin, {
      paymentId: pay.id,
      membershipId: pay.membership_id,
      source: "webhook",
      failure: {
        description: entity?.error_description,
        code: entity?.error_code,
        source: entity?.error_source,
        step: entity?.error_step,
      },
    });

    if (!failed.ok) {
      return apiError(failed.error, 500);
    }

    return apiSuccess("Payment failure recorded.", {
      event,
      payment_id: pay.id,
      skipped: failed.skipped === true,
    });
  }

  if (!SUCCESS_EVENTS.has(event)) {
    return apiSuccess("Event ignored.", { event });
  }

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
    return apiSuccess("Payment already processed.", { payment_id: existingPaid.id, event });
  }

  let pay;
  try {
    pay = await findPendingPaymentByRazorpayOrderId(admin, razorpay_order_id);
  } catch (e) {
    return apiErrorSafe(e, 500);
  }

  if (!pay) {
    return apiSuccess("No pending payment for this order.", { razorpay_order_id, event });
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
    event,
    payment_id: pay.id,
    alreadyPaid: finalized.alreadyPaid === true,
  });
}
