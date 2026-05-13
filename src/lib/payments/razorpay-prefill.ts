/**
 * Razorpay Standard Checkout `prefill.contact` expects +{country}{digits}, e.g. +919876543210.
 * @see https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
 */
export function formatPhoneForRazorpayPrefill(input: string | null | undefined): string | undefined {
  if (input == null) return undefined;
  const t = String(input).trim();
  if (t.length === 0) return undefined;
  if (t.startsWith("+")) {
    const rest = t.slice(1).replace(/\D/g, "");
    return rest.length >= 10 ? `+${rest}` : undefined;
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return undefined;
}
