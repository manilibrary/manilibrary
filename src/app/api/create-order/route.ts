import Razorpay from "razorpay";

import { apiError, apiErrorSafe, apiSuccess } from "@/lib/api/json-response";

export const runtime = "nodejs";

type RazorpaySdkError = {
  statusCode?: number;
  error?: { code?: string; description?: string };
  message?: string;
};

function mapRazorpaySdkError(e: unknown) {
  const err = e as RazorpaySdkError;
  const code = err?.statusCode;
  if (code === 401) {
    return apiError("Razorpay authentication failed (check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).", 401);
  }
  return apiErrorSafe(e, 500, "Could not create order with the payment provider.");
}

export async function POST(request: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return apiError("Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET).", 503);
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const amount = typeof raw.amount === "number" ? raw.amount : Number(raw.amount);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 100) {
    return apiError("amount must be an integer in paise and at least 100.", 400);
  }

  const currency = typeof raw.currency === "string" && raw.currency.length > 0 ? String(raw.currency).toUpperCase() : "INR";
  const receiptRaw = typeof raw.receipt === "string" && raw.receipt.length > 0 ? raw.receipt : `rcpt_${Date.now()}`;
  const receipt = receiptRaw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);

  try {
    const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = (await rz.orders.create({
      amount,
      currency,
      receipt,
    })) as { id: string; amount: number; currency: string };

    return apiSuccess("Razorpay order created (demo checkout).", {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (e) {
    return mapRazorpaySdkError(e);
  }
}
