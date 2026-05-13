import { apiError, apiSuccess } from "@/lib/api/json-response";
import { verifyRazorpayPaymentSignature } from "@/lib/payments/razorpay-hmac";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return apiError("RAZORPAY_KEY_SECRET is not set.", 503);
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const orderId = raw.razorpay_order_id;
  const paymentId = raw.razorpay_payment_id;
  const signature = raw.razorpay_signature;

  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string") {
    return apiError("Missing or invalid fields: razorpay_order_id, razorpay_payment_id, razorpay_signature.", 400);
  }

  if (!verifyRazorpayPaymentSignature(orderId, paymentId, signature, secret)) {
    return apiError("Signature mismatch.", 400);
  }

  return apiSuccess("Payment signature verified (demo checkout).");
}
