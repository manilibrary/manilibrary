import Razorpay from "razorpay";

import { apiError, apiErrorSafe, apiSuccess } from "@/lib/api/json-response";
import { finalizeRazorpayPaymentRow } from "@/lib/payments/finalize-razorpay-payment";
import { promoteCheckoutKycStaging } from "@/lib/kyc/promote-checkout-kyc-staging";
import { rupeesToRazorpayPaise } from "@/lib/payments/pricing";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RazorpayRemotePayment = {
  id: string;
  status: string;
  order_id?: string;
  amount?: number;
};

export async function POST(request: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return apiError("Razorpay is not configured.", 503);
  }

  let razorpay_payment_id: string;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (typeof raw.razorpay_payment_id !== "string" || !raw.razorpay_payment_id.startsWith("pay_")) {
      return apiError("Body must include razorpay_payment_id (e.g. pay_SoN4…).", 400);
    }
    razorpay_payment_id = raw.razorpay_payment_id.trim();
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
    return apiErrorSafe(e, 503, "Could not create Supabase admin client.", {
      hint: "Edit manilibrary/.env.local, then stop and restart `npm run dev` so the server reloads environment variables.",
    });
  }

  let remote: RazorpayRemotePayment;
  try {
    const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
    remote = (await rz.payments.fetch(razorpay_payment_id)) as RazorpayRemotePayment;
  } catch {
    return apiError("Could not load this payment from Razorpay.", 502);
  }

  const okStatuses = ["captured", "authorized"];
  if (!okStatuses.includes(remote.status)) {
    return apiError(
      `Razorpay reports status "${remote.status}". Only ${okStatuses.join(", ")} can be reconciled.`,
      400,
    );
  }

  const orderId = remote.order_id;
  if (!orderId || typeof orderId !== "string") {
    return apiError("Razorpay payment has no order_id.", 400);
  }

  const { data: pendingRows, error: qe } = await admin
    .from("payments")
    .select("id, user_id, status, amount_rupees, metadata")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (qe) {
    return apiErrorSafe(qe, 500);
  }

  const match = (pendingRows ?? []).find((r) => {
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    return m.razorpay_order_id === orderId;
  });

  if (!match) {
    return apiError(
      "No pending payment for your account matches this Razorpay order. If you started checkout more than once, the receipt may belong to a different attempt — try the latest pending row or pay again.",
      404,
    );
  }

  if (
    remote.amount != null &&
    Number(remote.amount) !== rupeesToRazorpayPaise(Number(match.amount_rupees))
  ) {
    return apiError("Amount mismatch between Razorpay and our row; reconciliation blocked.", 400);
  }

  const fin = await finalizeRazorpayPaymentRow(admin, {
    paymentId: match.id,
    expectedUserId: user.id,
    razorpay_payment_id,
  });

  if (!fin.ok) {
    return apiErrorSafe(fin.error, fin.status, "Could not complete payment.");
  }

  const prom = await promoteCheckoutKycStaging(admin, user.id);
  const kycPromoteWarning = prom.ok ? undefined : prom.error;

  return apiSuccess("Payment reconciled with Razorpay and membership updated if applicable.", {
    paymentId: match.id,
    alreadyPaid: fin.alreadyPaid === true,
    ...(prom.ok ? { kycPromoted: prom.promoted } : {}),
    ...(kycPromoteWarning ? { kycPromoteWarning } : {}),
  });
}
