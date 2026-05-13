/**
 * PostgREST often returns PGRST205 or a message mentioning "schema cache" when the
 * table exists in Postgres but was never applied to this project, or the API schema cache is stale.
 */
export function isCheckoutKycStagingTableUnavailable(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  if (err.code === "PGRST205") return true;
  if (m.includes("kyc_checkout_pending_documents")) return true;
  if (m.includes("schema cache") && (m.includes("could not find") || m.includes("does not exist"))) return true;
  return false;
}

export const CHECKOUT_KYC_STAGING_SETUP =
  "Open Supabase → SQL Editor, run the file `supabase/kyc-checkout-pending-documents.sql` from this repo, then refresh the page (or wait a minute for the API schema cache to refresh).";
