import { apiError, apiErrorSafe, apiSuccess } from "@/lib/api/json-response";
import { createRazorpayServerClient } from "@/lib/payments/razorpay-server";
import { syncPendingRazorpayPaymentRow } from "@/lib/payments/sync-pending-razorpay-payment";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payment_id: string;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (typeof raw.payment_id !== "string" || !raw.payment_id.trim()) {
      return apiError("Body must include payment_id.", 400);
    }
    payment_id = raw.payment_id.trim();
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

  const rz = createRazorpayServerClient();
  if (!rz) {
    return apiError("Razorpay is not configured.", 503);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create Supabase admin client.");
  }

  const { data: pay, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, amount_rupees, metadata, membership_id, created_at")
    .eq("id", payment_id)
    .maybeSingle();

  if (payErr || !pay) {
    return apiError("Payment not found.", 404);
  }
  if (pay.user_id !== user.id) {
    return apiError("Forbidden.", 403);
  }

  const result = await syncPendingRazorpayPaymentRow(admin, rz, pay, {
    allowTimeoutFail: false,
  });

  return apiSuccess("Payment sync checked with Razorpay.", result);
}
