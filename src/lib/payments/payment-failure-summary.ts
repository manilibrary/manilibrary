/**
 * Map Razorpay / checkout error text + code to a short staff-facing note for DB + UI.
 */
export function summarizePaymentFailureNote(rawDescription: string, code?: string): string {
  const d = rawDescription.toLowerCase().replace(/\s+/g, " ").trim();
  const c = (code ?? "").toUpperCase();

  if (d.includes("card number is invalid") || d.includes("invalid card") || d.includes("incorrect card number")) {
    return "Invalid card";
  }
  if (d.includes("invalid cvv") || d.includes("incorrect cvv")) {
    return "Invalid CVV";
  }
  if (d.includes("expired card") || d.includes("card has expired")) {
    return "Card expired";
  }
  if (d.includes("insufficient fund")) {
    return "Insufficient funds";
  }
  if (d.includes("authentication failed") || d.includes("3ds") || d.includes("3-d secure")) {
    return "Authentication failed";
  }
  if (d.includes("cancelled") || d.includes("canceled") || d.includes("user cancelled")) {
    return "Payment cancelled";
  }
  if (d.includes("timeout") || d.includes("timed out")) {
    return "Timeout";
  }
  if (d.includes("network") && (d.includes("error") || d.includes("fail"))) {
    return "Network error";
  }
  if (c.includes("GATEWAY") || c === "SERVER_ERROR" || (d.includes("server") && d.includes("error"))) {
    return "Server error";
  }
  if (d.includes("upi") && (d.includes("invalid") || d.includes("incorrect"))) {
    return "Invalid UPI";
  }
  if (d.includes("declined")) {
    return "Payment declined";
  }
  if (d.includes("international cards") || d.includes("international card")) {
    return "Card type not supported";
  }
  if (c === "BAD_REQUEST_ERROR") {
    return "Invalid payment details";
  }
  if (d.length <= 90) {
    return rawDescription.trim().slice(0, 90);
  }
  const sentence = rawDescription.split(/[.!?]/)[0]?.trim() ?? rawDescription.trim();
  if (sentence.length <= 90) return sentence;
  return `${sentence.slice(0, 87)}…`;
}
