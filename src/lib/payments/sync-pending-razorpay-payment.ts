import type Razorpay from "razorpay";
import type { SupabaseClient } from "@supabase/supabase-js";

import { finalizeRazorpayPaymentRow } from "@/lib/payments/finalize-razorpay-payment";
import { promoteCheckoutKycStaging } from "@/lib/kyc/promote-checkout-kyc-staging";
import { rupeesToRazorpayPaise } from "@/lib/payments/pricing";
import { failRazorpayPaymentRow } from "@/lib/payments/razorpay-pending-payment";

export type PaymentRowForSync = {
  id: string;
  user_id: string;
  status: string;
  amount_rupees: number | null;
  metadata: unknown;
  membership_id: string | null;
  created_at: string;
};

type RazorpayOrderPayment = {
  id?: string;
  status?: string;
  order_id?: string;
  amount?: number;
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
};

export type SyncPendingResult =
  | { outcome: "paid"; paymentId: string; alreadyPaid?: boolean }
  | { outcome: "failed"; paymentId: string }
  | { outcome: "still_pending"; paymentId: string }
  | { outcome: "skipped"; paymentId: string; reason: string };

const SUCCESS_STATUSES = new Set(["captured", "authorized"]);

function orderIdFromMeta(metadata: unknown): string | null {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const id = typeof m.razorpay_order_id === "string" ? m.razorpay_order_id.trim() : "";
  return id || null;
}

function pickSuccessPayment(items: RazorpayOrderPayment[]): RazorpayOrderPayment | null {
  const captured = items.find((p) => p.status === "captured" && p.id?.startsWith("pay_"));
  if (captured) return captured;
  const authorized = items.find((p) => p.status === "authorized" && p.id?.startsWith("pay_"));
  return authorized ?? null;
}

function pickFailedPayment(items: RazorpayOrderPayment[]): RazorpayOrderPayment | null {
  return items.find((p) => p.status === "failed" && p.id?.startsWith("pay_")) ?? null;
}

/** Query Razorpay for this checkout order and align our pending row (web + app + cron). */
export async function syncPendingRazorpayPaymentRow(
  admin: SupabaseClient,
  rz: Razorpay,
  pay: PaymentRowForSync,
  opts?: { allowTimeoutFail?: boolean; minAgeMs?: number },
): Promise<SyncPendingResult> {
  if (pay.status === "paid") {
    return { outcome: "skipped", paymentId: pay.id, reason: "already_paid" };
  }
  if (pay.status === "failed") {
    return { outcome: "skipped", paymentId: pay.id, reason: "already_failed" };
  }
  if (pay.status !== "pending") {
    return { outcome: "skipped", paymentId: pay.id, reason: `status_${pay.status}` };
  }

  const orderId = orderIdFromMeta(pay.metadata);
  if (!orderId) {
    return { outcome: "skipped", paymentId: pay.id, reason: "no_razorpay_order_id" };
  }

  let items: RazorpayOrderPayment[] = [];
  try {
    const remote = (await rz.orders.fetchPayments(orderId)) as { items?: RazorpayOrderPayment[] };
    items = Array.isArray(remote.items) ? remote.items : [];
  } catch {
    return { outcome: "still_pending", paymentId: pay.id };
  }

  const success = pickSuccessPayment(items);
  if (success?.id) {
    if (
      success.amount != null &&
      pay.amount_rupees != null &&
      Number(success.amount) !== rupeesToRazorpayPaise(Number(pay.amount_rupees))
    ) {
      return { outcome: "still_pending", paymentId: pay.id };
    }

    const fin = await finalizeRazorpayPaymentRow(admin, {
      paymentId: pay.id,
      expectedUserId: pay.user_id,
      razorpay_payment_id: success.id,
    });
    if (!fin.ok) {
      return { outcome: "still_pending", paymentId: pay.id };
    }
    await promoteCheckoutKycStaging(admin, pay.user_id);
    return { outcome: "paid", paymentId: pay.id, alreadyPaid: fin.alreadyPaid === true };
  }

  const failed = pickFailedPayment(items);
  if (failed && !success) {
    const res = await failRazorpayPaymentRow(admin, {
      paymentId: pay.id,
      membershipId: pay.membership_id,
      source: "cron",
      failure: {
        description: failed.error_description,
        code: failed.error_code,
        source: failed.error_source,
        step: failed.error_step,
      },
    });
    if (!res.ok) {
      return { outcome: "still_pending", paymentId: pay.id };
    }
    return { outcome: "failed", paymentId: pay.id };
  }

  const minAgeMs = opts?.minAgeMs ?? 5 * 60 * 1000;
  const ageMs = Date.now() - Date.parse(pay.created_at);
  const timedOut = opts?.allowTimeoutFail === true && Number.isFinite(ageMs) && ageMs >= minAgeMs;

  if (timedOut && items.length === 0) {
    await failRazorpayPaymentRow(admin, {
      paymentId: pay.id,
      membershipId: pay.membership_id,
      source: "cron",
      failure: { description: "Checkout timed out with no payment on Razorpay." },
    });
    return { outcome: "failed", paymentId: pay.id };
  }

  if (timedOut && !success) {
    const onlyCreated = items.length > 0 && items.every((p) => p.status === "created");
    if (items.length === 0 || onlyCreated) {
      await failRazorpayPaymentRow(admin, {
        paymentId: pay.id,
        membershipId: pay.membership_id,
        source: "cron",
        failure: { description: "Checkout timed out before payment completed." },
      });
      return { outcome: "failed", paymentId: pay.id };
    }
  }

  return { outcome: "still_pending", paymentId: pay.id };
}
