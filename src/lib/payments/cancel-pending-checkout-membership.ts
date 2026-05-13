import type { SupabaseClient } from "@supabase/supabase-js";

/** Cancels a checkout draft membership so it does not look like an unpaid booking after the user leaves Razorpay. */
export async function cancelPendingPaymentMembership(
  admin: SupabaseClient,
  membershipId: string | null | undefined,
): Promise<void> {
  if (!membershipId) return;
  await admin
    .from("memberships")
    .update({ status: "cancelled" })
    .eq("id", membershipId)
    .eq("status", "pending_payment");
}
