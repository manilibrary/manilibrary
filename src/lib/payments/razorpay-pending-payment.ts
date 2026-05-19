import type { SupabaseClient } from "@supabase/supabase-js";

import { cancelPendingPaymentMembership } from "@/lib/payments/cancel-pending-checkout-membership";
import { sanitizeCheckoutFailurePayload } from "@/lib/payments/sanitize-checkout-failure";

export type PendingPaymentRow = {
  id: string;
  user_id: string;
  status: string;
  metadata: unknown;
  membership_id: string | null;
};

/** Match `metadata.razorpay_order_id` on a pending payment row. */
export async function findPendingPaymentByRazorpayOrderId(
  admin: SupabaseClient,
  razorpay_order_id: string,
): Promise<PendingPaymentRow | null> {
  const { data: pendingRows, error } = await admin
    .from("payments")
    .select("id, user_id, status, metadata, membership_id")
    .eq("status", "pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (
    (pendingRows ?? []).find((row) => {
      const m = (row.metadata ?? {}) as Record<string, unknown>;
      return m.razorpay_order_id === razorpay_order_id;
    }) ?? null
  );
}

/** Webhook / server: mark pending Razorpay checkout failed and cancel draft membership. */
export async function failRazorpayPaymentRow(
  admin: SupabaseClient,
  input: {
    paymentId: string;
    membershipId?: string | null;
    failure?: { description?: string; code?: string; source?: string; step?: string };
    source: "webhook" | "client" | "cron";
  },
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const { data: pay, error: payErr } = await admin
    .from("payments")
    .select("id, status, metadata, membership_id")
    .eq("id", input.paymentId)
    .maybeSingle();

  if (payErr || !pay) {
    return { ok: false, error: "Payment not found." };
  }
  if (pay.status !== "pending") {
    return { ok: true, skipped: true };
  }

  const prev = (pay.metadata ?? {}) as Record<string, unknown>;
  const safe = sanitizeCheckoutFailurePayload(input.failure);
  const nextMeta = {
    ...prev,
    checkout_failure: {
      ...safe,
      recorded_at: new Date().toISOString(),
      recorded_via: input.source,
    },
  };

  const { error: upErr } = await admin
    .from("payments")
    .update({ status: "failed", metadata: nextMeta })
    .eq("id", input.paymentId)
    .eq("status", "pending");

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const membershipId = input.membershipId ?? (pay.membership_id as string | null | undefined);
  await cancelPendingPaymentMembership(admin, membershipId);

  return { ok: true };
}
