import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { failRazorpayPaymentRow } from "@/lib/payments/razorpay-pending-payment";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
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

  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) {
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

  const failed = await failRazorpayPaymentRow(admin, {
    paymentId: pay.id,
    membershipId: pay.membership_id as string | null | undefined,
    failure: body.error,
    source: "client",
  });

  if (!failed.ok) {
    return apiErrorSafe(failed.error, 500);
  }

  return apiSuccess("Checkout failure recorded on this payment row.", {
    paymentId: pay.id,
    skipped: failed.skipped === true,
  });
}
