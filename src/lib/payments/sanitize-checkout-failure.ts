const MAX_DESCRIPTION = 500;
const MAX_CODE = 80;
const MAX_SOURCE = 80;
const MAX_STEP = 80;

/** Strip control characters; trim; cap length (admin-visible Razorpay client payload). */
function clipField(s: string, max: number): string {
  const t = s.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

export type CheckoutFailureSanitized = {
  description: string;
  code?: string;
  source?: string;
  step?: string;
};

export function sanitizeCheckoutFailurePayload(
  error: { description?: string; code?: string; source?: string; step?: string } | undefined,
): CheckoutFailureSanitized {
  const rawDesc =
    typeof error?.description === "string" && error.description.trim()
      ? error.description
      : "Payment failed.";
  const description = clipField(rawDesc, MAX_DESCRIPTION) || "Payment failed.";
  const code =
    typeof error?.code === "string" && error.code.trim() ? clipField(error.code, MAX_CODE) : undefined;
  const source =
    typeof error?.source === "string" && error.source.trim() ? clipField(error.source, MAX_SOURCE) : undefined;
  const step =
    typeof error?.step === "string" && error.step.trim() ? clipField(error.step, MAX_STEP) : undefined;
  const out: CheckoutFailureSanitized = { description };
  if (code) out.code = code;
  if (source) out.source = source;
  if (step) out.step = step;
  return out;
}
