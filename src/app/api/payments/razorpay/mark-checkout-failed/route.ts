import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { cancelPendingPaymentMembership } from "@/lib/payments/cancel-pending-checkout-membership";
import { sanitizeCheckoutFailurePayload } from "@/lib/payments/sanitize-checkout-failure";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type Body = {
  payment_id: string;
  error?: { description?: string; code?: string; source?: string; step?: string };
};

export async function POST(request: Request) {
  let body: Body;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (typeof raw.payment_id !== "string" || !raw.payment_id.trim()) {
      return apiError("Body must include payment_id.", 400);
    }
    const errRaw = raw.error;
    const error =
      errRaw && typeof errRaw === "object"
        ? (errRaw as { description?: string; code?: string; source?: string; step?: string })
        : undefined;
    body = { payment_id: raw.payment_id.trim(), error };
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create Supabase admin client.");
  }

  const { data: pay, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, metadata, membership_id")
    .eq("id", body.payment_id)
    .maybeSingle();

  if (payErr || !pay) {
    return apiError("Payment not found.", 404);
  }
  if (pay.user_id !== user.id) {
    return apiError("Forbidden.", 403);
  }
  if (pay.status !== "pending") {
    return apiSuccess("Payment was already finalized; nothing to record.", { skipped: true });
  }

  const prev = (pay.metadata ?? {}) as Record<string, unknown>;
  const safe = sanitizeCheckoutFailurePayload(body.error);
  const nextMeta = {
    ...prev,
    checkout_failure: {
      ...safe,
      recorded_at: new Date().toISOString(),
    },
  };

  const { error: upErr } = await admin
    .from("payments")
    .update({ status: "failed", metadata: nextMeta })
    .eq("id", pay.id)
    .eq("status", "pending");

  if (upErr) {
    return apiErrorSafe(upErr, 500);
  }

  await cancelPendingPaymentMembership(admin, pay.membership_id as string | null | undefined);

  return apiSuccess("Checkout failure recorded on this payment row.", { paymentId: pay.id });
}
