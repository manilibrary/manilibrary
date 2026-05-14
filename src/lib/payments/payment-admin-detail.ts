import { summarizePaymentFailureNote } from "@/lib/payments/payment-failure-summary";

/**
 * Human-readable line for staff payment tables (from `payments.metadata` + status).
 */
export function formatPaymentAdminDetail(status: string, metadata: unknown): string | null {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const cf = m.checkout_failure;
  if (cf && typeof cf === "object") {
    const o = cf as Record<string, unknown>;
    const desc = typeof o.description === "string" ? o.description.trim() : "";
    if (desc) {
      if (desc.length > 96) {
        const codeStr = typeof o.code === "string" ? o.code.trim() : undefined;
        return summarizePaymentFailureNote(desc, codeStr);
      }
      return desc;
    }
  }
  for (const k of ["last_failure_message", "failure_message", "error_description", "admin_note"] as const) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) {
      const t = v.trim();
      return t.length > 96 ? summarizePaymentFailureNote(t) : t;
    }
  }
  if (status === "failed") return "No failure details on file.";
  return null;
}
