import { createHmac, timingSafeEqual } from "crypto";

export function razorpayPaymentSignatureHex(orderId: string, paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  const expected = razorpayPaymentSignatureHex(orderId, paymentId, secret);
  const ba = Buffer.from(expected.toLowerCase(), "utf8");
  const bb = Buffer.from(signature.toLowerCase().trim(), "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
