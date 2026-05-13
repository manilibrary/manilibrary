import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mark a payment row paid and activate linked membership (same as verify success path).
 * Caller must already have checked signature or Razorpay server-side payment state.
 */
export async function finalizeRazorpayPaymentRow(
  admin: SupabaseClient,
  input: { paymentId: string; expectedUserId: string; razorpay_payment_id: string },
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
  const nextMeta = { ...meta, razorpay_payment_id: input.razorpay_payment_id };

  const { error: upPay } = await admin
    .from("payments")
    .update({
      status: "paid",
      provider_payment_id: input.razorpay_payment_id,
      metadata: nextMeta,
    })
    .eq("id", input.paymentId);

  if (upPay) {
    return { ok: false, status: 500, error: upPay.message };
  }

  if (pay.membership_id) {
    const { data: memRow, error: memFetchErr } = await admin
      .from("memberships")
      .select("id")
      .eq("id", pay.membership_id)
      .maybeSingle();

    if (memFetchErr) {
      return { ok: false, status: 500, error: `Payment marked paid but could not load membership: ${memFetchErr.message}` };
    }
    if (!memRow) {
      return {
        ok: false,
        status: 500,
        error: "Payment marked paid but linked membership row was not found.",
      };
    }

    const { error: upMem } = await admin
      .from("memberships")
      .update({ status: "active", payment_id: input.paymentId })
      .eq("id", pay.membership_id);

    if (upMem) {
      return { ok: false, status: 500, error: `Payment marked paid but membership update failed: ${upMem.message}` };
    }
  }

  return { ok: true };
}
