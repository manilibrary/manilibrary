/**
 * Human-readable line for staff payment tables (from `payments.metadata` + status).
 */
export function formatPaymentAdminDetail(status: string, metadata: unknown): string | null {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const cf = m.checkout_failure;
  if (cf && typeof cf === "object") {
    const o = cf as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.description === "string" && o.description.trim()) parts.push(o.description.trim());
    if (typeof o.code === "string" && o.code.trim()) parts.push(`code ${o.code.trim()}`);
    if (typeof o.source === "string" && o.source.trim()) parts.push(`source ${o.source}`);
    if (typeof o.step === "string" && o.step.trim()) parts.push(`step ${o.step}`);
    if (parts.length) return parts.join(" · ");
  }
  for (const k of ["last_failure_message", "failure_message", "error_description", "admin_note"] as const) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  if (status === "failed") return "No failure details on file.";
  return null;
}
