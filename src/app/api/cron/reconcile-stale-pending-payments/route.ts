import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { createRazorpayServerClient } from "@/lib/payments/razorpay-server";
import { syncPendingRazorpayPaymentRow } from "@/lib/payments/sync-pending-razorpay-payment";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const STALE_MS = 5 * 60 * 1000;
const BATCH_LIMIT = 40;

/**
 * Vercel Cron (daily on Hobby) / external scheduler: reconcile pending Razorpay checkouts older than 5 minutes.
 * Authorization: `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return apiError("CRON_SECRET is not configured.", 503);
  }
  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized.", 401);
  }

  const rz = createRazorpayServerClient();
  if (!rz) {
    return apiError("Razorpay is not configured.", 503);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create admin client.");
  }

  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  const { data: rows, error } = await admin
    .from("payments")
    .select("id, user_id, status, amount_rupees, metadata, membership_id, created_at")
    .eq("status", "pending")
    .eq("provider", "razorpay")
    .is("deleted_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    return apiErrorSafe(error, 500);
  }

  const summary = { paid: 0, failed: 0, still_pending: 0, skipped: 0 };

  for (const pay of rows ?? []) {
    const result = await syncPendingRazorpayPaymentRow(admin, rz, pay, {
      allowTimeoutFail: true,
      minAgeMs: STALE_MS,
    });
    if (result.outcome === "paid") summary.paid += 1;
    else if (result.outcome === "failed") summary.failed += 1;
    else if (result.outcome === "still_pending") summary.still_pending += 1;
    else summary.skipped += 1;
  }

  return apiSuccess("Stale pending payments processed.", {
    scanned: (rows ?? []).length,
    cutoff,
    ...summary,
  });
}
