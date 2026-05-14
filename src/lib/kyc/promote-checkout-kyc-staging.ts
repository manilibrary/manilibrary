import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchPendingVerification,
  KYC_DOC_TYPES,
  softDeleteVerificationDocumentSlot,
  type KycDocType,
} from "@/lib/verification/verification-repo";

function kycBucket(): string {
  return process.env.KYC_STORAGE_BUCKET?.trim() || "kyc-private";
}

export type PromoteCheckoutKycResult = { ok: true; promoted: number } | { ok: false; error: string };

type DocRow = {
  id: string;
  doc_type: string;
  phase: string;
  storage_bucket: string | null;
  storage_path: string;
  content_type: string | null;
};

/**
 * After payment: moves `verification_documents` rows with phase `checkout_pending` to `submitted`
 * on the pending verification row.
 */
export async function promoteCheckoutKycStaging(admin: SupabaseClient, userId: string): Promise<PromoteCheckoutKycResult> {
  const { data: prof, error: pe } = await admin.from("profiles").select("is_verified").eq("user_id", userId).maybeSingle();
  if (pe) return { ok: false, error: pe.message };

  const { data: pending, error: pendErr } = await fetchPendingVerification(admin, userId);
  if (pendErr) return { ok: false, error: pendErr.message };
  if (!pending?.id) return { ok: true, promoted: 0 };

  const { data: docRows, error: de } = await admin
    .from("verification_documents")
    .select("id, doc_type, phase, storage_bucket, storage_path, content_type")
    .eq("verification_id", pending.id)
    .is("deleted_at", null);
  if (de) return { ok: false, error: de.message };

  const rows = (docRows ?? []) as DocRow[];
  const checkoutOnly = rows.filter(
    (r) => r.phase === "checkout_pending" && KYC_DOC_TYPES.includes(r.doc_type as KycDocType),
  );
  if (checkoutOnly.length === 0) return { ok: true, promoted: 0 };

  if (prof?.is_verified === true || pending.status === "rejected") {
    const now = new Date().toISOString();
    for (const r of checkoutOnly) {
      const buck = r.storage_bucket?.trim() || kycBucket();
      await admin.storage.from(buck).remove([r.storage_path]);
      await admin
        .from("verification_documents")
        .update({ deleted_at: now, updated_at: now })
        .eq("id", r.id);
    }
    return { ok: true, promoted: 0 };
  }

  const now = new Date().toISOString();
  for (const r of checkoutOnly) {
    const dt = r.doc_type as KycDocType;
    const { error: sd } = await softDeleteVerificationDocumentSlot(admin, pending.id, dt, "submitted");
    if (sd) return { ok: false, error: sd.message };
    const { error: up } = await admin
      .from("verification_documents")
      .update({ phase: "submitted", updated_at: now })
      .eq("id", r.id);
    if (up) return { ok: false, error: up.message };
  }

  await admin
    .from("verification")
    .update({ status: "pending", updated_at: now })
    .eq("id", pending.id);

  return { ok: true, promoted: checkoutOnly.length };
}
