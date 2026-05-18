/** Browser checkout page for app / external clients (completes pending Razorpay order). */
export function membershipHostedCheckoutUrl(paymentId: string, request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  const origin =
    fromEnv ||
    (request ? new URL(request.url).origin : "") ||
    "https://www.manilibrary.com";
  const base = origin.replace(/\/$/, "");
  return `${base}/membership/resume-payment?payment_id=${encodeURIComponent(paymentId)}`;
}
