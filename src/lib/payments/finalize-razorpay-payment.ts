import type { SupabaseClient } from "@supabase/supabase-js";

import { safeClientErrorMessage } from "@/lib/api/json-response";
import { PAYMENT_METADATA_COUPON_KEY } from "@/lib/coupons/library-coupons";
import {
  PAYMENT_METADATA_CREDITS_KEY,
  creditReferrerOnFirstPayment,
  redeemCreditsOnPayment,
} from "@/lib/referrals/library-referrals";
import {
  PAYMENT_METADATA_PLANNED_SEAT_KEY,
  isPendingMembershipSeatPlaceholder,
} from "@/lib/membership/seat-label";

/**
 * Mark a payment row paid and activate linked membership (same as verify success path).
 * Caller must already have checked signature or Razorpay server-side payment state.
 */
export async function finalizeRazorpayPaymentRow(
  admin: SupabaseClient,
  input: {
    paymentId: string;
    expectedUserId: string;
    razorpay_payment_id: string;
    razorpay_method?: string;
  },
): Promise<{ ok: true; alreadyPaid?: boolean } | { ok: false; status: number; error: string }> {
  const { data: pay, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, membership_id, status, metadata")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (payErr || !pay) {
    return { ok: false, status: 404, error: "Payment not found." };
  }
  if (pay.user_id !== input.expectedUserId) {
    return { ok: false, status: 403, error: "Forbidden." };
  }
  if (pay.status === "paid") {
    return { ok: true, alreadyPaid: true };
  }

  const meta = (pay.metadata ?? {}) as Record<string, unknown>;
  const method = input.razorpay_method?.trim();
  const nextMeta = {
    ...meta,
    razorpay_payment_id: input.razorpay_payment_id,
    ...(method ? { razorpay_method: method } : {}),
  };

  const { error: upPay } = await admin
    .from("payments")
    .update({
      status: "paid",
      provider_payment_id: input.razorpay_payment_id,
      metadata: nextMeta,
    })
    .eq("id", input.paymentId);

  if (upPay) {
    return {
      ok: false,
      status: 500,
      error: safeClientErrorMessage(upPay, "Could not update payment status."),
    };
  }

  if (pay.membership_id) {
    const { data: memRow, error: memFetchErr } = await admin
      .from("memberships")
      .select("id, seat_number")
      .eq("id", pay.membership_id)
      .maybeSingle();

    if (memFetchErr) {
      return {
        ok: false,
        status: 500,
        error: safeClientErrorMessage(
          memFetchErr,
          "Payment was recorded but membership details could not be loaded. Contact support.",
        ),
      };
    }
    if (!memRow) {
      return {
        ok: false,
        status: 500,
        error: "Payment marked paid but linked membership row was not found.",
      };
    }

    const metaBefore = (pay.metadata ?? {}) as Record<string, unknown>;
    const plannedRaw = metaBefore[PAYMENT_METADATA_PLANNED_SEAT_KEY];
    const planned =
      typeof plannedRaw === "string" && plannedRaw.trim().length > 0 ? plannedRaw.trim().replace(/\s/g, "") : null;
    const memSeat = memRow.seat_number as string | number | null;
    const fallback =
      memSeat != null &&
      String(memSeat).trim().length > 0 &&
      !isPendingMembershipSeatPlaceholder(memSeat)
        ? String(memSeat).trim().replace(/\s/g, "")
        : null;
    const seatToSet = planned ?? fallback;
    if (!seatToSet) {
      return {
        ok: false,
        status: 500,
        error:
          "Payment marked paid but no seat could be resolved (expected payments.metadata.planned_seat_token or a non-placeholder membership.seat_number).",
      };
    }

    const { error: upMem } = await admin
      .from("memberships")
      .update({ status: "active", payment_id: input.paymentId, seat_number: seatToSet })
      .eq("id", pay.membership_id);

    if (upMem) {
      return {
        ok: false,
        status: 500,
        error: safeClientErrorMessage(
          upMem,
          "Payment was recorded but activating your seat failed. Contact support.",
        ),
      };
    }
  }

  // Best-effort: redeem a coupon if one was attached at checkout (single use).
  const couponMeta = (pay.metadata ?? {}) as Record<string, unknown>;
  const coupon = couponMeta[PAYMENT_METADATA_COUPON_KEY] as { id?: unknown } | undefined;
  if (coupon && typeof coupon.id === "string") {
    await admin
      .from("library_coupons")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
        used_by_user_id: input.expectedUserId,
        membership_id: pay.membership_id ?? null,
      })
      .eq("id", coupon.id)
      .eq("status", "active");
  }

  const creditsMeta = couponMeta[PAYMENT_METADATA_CREDITS_KEY] as { amount?: unknown } | undefined;
  const creditsApplied =
    typeof creditsMeta?.amount === "number" && creditsMeta.amount > 0
      ? Math.round(creditsMeta.amount)
      : 0;
  if (creditsApplied > 0) {
    await redeemCreditsOnPayment(admin, input.expectedUserId, input.paymentId, creditsApplied);
  }

  await creditReferrerOnFirstPayment(
    admin,
    input.expectedUserId,
    input.paymentId,
    (pay.metadata ?? {}) as Record<string, unknown>,
  );

  return { ok: true };
}
