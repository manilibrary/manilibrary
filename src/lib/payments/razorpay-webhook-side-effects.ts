import type { SupabaseClient } from "@supabase/supabase-js";

import { findPendingPaymentByRazorpayOrderId } from "@/lib/payments/razorpay-pending-payment";

export async function recordPaymentPendingWebhook(
  admin: SupabaseClient,
  input: { razorpay_order_id: string; razorpay_payment_id?: string; razorpay_status?: string },
): Promise<{ ok: true; payment_id?: string; skipped?: boolean } | { ok: false; error: string }> {
  let pay;
  try {
    pay = await findPendingPaymentByRazorpayOrderId(admin, input.razorpay_order_id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lookup failed." };
  }
  if (!pay) {
    return { ok: true, skipped: true };
  }

  const prev = (pay.metadata ?? {}) as Record<string, unknown>;
  const nextMeta = {
    ...prev,
    razorpay_payment_id: input.razorpay_payment_id ?? prev.razorpay_payment_id,
    razorpay_status: input.razorpay_status ?? "pending",
    razorpay_pending_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("payments")
    .update({ metadata: nextMeta })
    .eq("id", pay.id)
    .eq("status", "pending");

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, payment_id: pay.id };
}

export async function recordPaymentRefundedWebhook(
  admin: SupabaseClient,
  input: { razorpay_payment_id: string; refund_id?: string; amount_paise?: number },
): Promise<{ ok: true; payment_id?: string; skipped?: boolean } | { ok: false; error: string }> {
  const { data: pay, error } = await admin
    .from("payments")
    .select("id, status, membership_id, metadata")
    .eq("provider_payment_id", input.razorpay_payment_id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!pay) {
    const { data: pendingRows } = await admin
      .from("payments")
      .select("id, status, membership_id, metadata")
      .eq("status", "paid")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80);

    const byMeta = (pendingRows ?? []).find((row) => {
      const m = (row.metadata ?? {}) as Record<string, unknown>;
      return m.razorpay_payment_id === input.razorpay_payment_id;
    });
    if (!byMeta) {
      return { ok: true, skipped: true };
    }
    return applyRefund(admin, byMeta.id, byMeta.membership_id as string | null, byMeta.metadata, input);
  }

  return applyRefund(admin, pay.id, pay.membership_id as string | null, pay.metadata, input);
}

async function applyRefund(
  admin: SupabaseClient,
  paymentId: string,
  membershipId: string | null,
  metadata: unknown,
  input: { razorpay_payment_id: string; refund_id?: string; amount_paise?: number },
): Promise<{ ok: true; payment_id: string; skipped?: boolean } | { ok: false; error: string }> {
  const prev = (metadata ?? {}) as Record<string, unknown>;
  const nextMeta = {
    ...prev,
    refund: {
      razorpay_payment_id: input.razorpay_payment_id,
      refund_id: input.refund_id ?? null,
      amount_paise: input.amount_paise ?? null,
      recorded_at: new Date().toISOString(),
    },
  };

  const { error: upErr } = await admin
    .from("payments")
    .update({ status: "refunded", metadata: nextMeta })
    .eq("id", paymentId)
    .in("status", ["paid", "pending"]);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  if (membershipId) {
    await admin
      .from("memberships")
      .update({ status: "cancelled" })
      .eq("id", membershipId)
      .in("status", ["active", "pending_payment", "expiring_soon"]);
  }

  return { ok: true, payment_id: paymentId };
}

export async function recordPaymentDisputeWebhook(
  admin: SupabaseClient,
  input: {
    razorpay_payment_id: string;
    dispute_id?: string;
    dispute_status?: string;
    event: string;
  },
): Promise<{ ok: true; payment_id?: string; skipped?: boolean } | { ok: false; error: string }> {
  const { data: pay, error } = await admin
    .from("payments")
    .select("id, metadata")
    .eq("provider_payment_id", input.razorpay_payment_id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!pay) {
    return { ok: true, skipped: true };
  }

  const prev = (pay.metadata ?? {}) as Record<string, unknown>;
  const nextMeta = {
    ...prev,
    dispute: {
      id: input.dispute_id ?? null,
      status: input.dispute_status ?? input.event,
      event: input.event,
      updated_at: new Date().toISOString(),
    },
  };

  const { error: upErr } = await admin.from("payments").update({ metadata: nextMeta }).eq("id", pay.id);

  if (upErr) {
    return { ok: false, error: upErr.message };
  }
  return { ok: true, payment_id: pay.id };
}
