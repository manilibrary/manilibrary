import { apiError, apiSuccess } from "@/lib/api/json-response";
import { finalizeRazorpayPaymentRow } from "@/lib/payments/finalize-razorpay-payment";
import { verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay-hmac";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type Body = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  payment_id: string;
};

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return apiError("RAZORPAY_KEY_SECRET is not set.", 503);
  }

  let body: Body;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (
      typeof raw.razorpay_order_id !== "string" ||
      typeof raw.razorpay_payment_id !== "string" ||
      typeof raw.razorpay_signature !== "string" ||
      typeof raw.payment_id !== "string"
    ) {
      return apiError("Invalid body.", 400);
    }
    body = {
      razorpay_order_id: raw.razorpay_order_id,
      razorpay_payment_id: raw.razorpay_payment_id,
      razorpay_signature: raw.razorpay_signature,
      payment_id: raw.payment_id,
    };
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  if (!verifyRazorpayPaymentSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature, secret)) {
    return apiError("Invalid payment signature.", 400);
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
    const msg = e instanceof Error ? e.message : "Could not create Supabase admin client.";
    return apiError(msg, 503, {
      hint: "Edit manilibrary/.env.local, then stop and restart `npm run dev` so the server reloads environment variables.",
    });
  }

  const { data: pay, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, membership_id, status, metadata")
    .eq("id", body.payment_id)
    .maybeSingle();

  if (payErr || !pay) {
    return apiError("Payment not found.", 404);
  }
  if (pay.user_id !== user.id) {
    return apiError("Forbidden.", 403);
  }

  const meta = (pay.metadata ?? {}) as Record<string, unknown>;
  if (meta.razorpay_order_id !== body.razorpay_order_id) {
    return apiError("Order id does not match payment record.", 400);
  }

  if (pay.status === "paid") {
    return apiSuccess("Payment was already recorded; membership should already be active.", { alreadyPaid: true });
  }

  const fin = await finalizeRazorpayPaymentRow(admin, {
    paymentId: body.payment_id,
    expectedUserId: user.id,
    razorpay_payment_id: body.razorpay_payment_id,
  });
  if (!fin.ok) {
    return apiError(fin.error, fin.status);
  }

  return apiSuccess("Payment verified and membership activated.", { alreadyPaid: fin.alreadyPaid === true });
}
