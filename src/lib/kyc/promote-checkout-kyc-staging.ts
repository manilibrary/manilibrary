import type { SupabaseClient } from "@supabase/supabase-js";

import { isCheckoutKycStagingTableUnavailable } from "@/lib/kyc/checkout-staging-errors";

function kycBucket(): string {
  return process.env.KYC_STORAGE_BUCKET?.trim() || "kyc-private";
}

async function getOrCreatePendingVerificationId(admin: SupabaseClient, userId: string): Promise<string> {
  const { data: ex, error: e1 } = await admin
    .from("verification_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (ex?.id) return ex.id;
  const { data: ins, error: e2 } = await admin
    .from("verification_requests")
    .insert({ user_id: userId, status: "pending" })
    .select("id")
    .single();
  if (e2 || !ins) throw new Error(e2?.message ?? "Could not create verification request.");
  return ins.id;
}

export type PromoteCheckoutKycResult = { ok: true; promoted: number } | { ok: false; error: string };

/**
 * Moves checkout-staged KYC files into verification_documents after payment succeeds.
 * Drops staging rows for approved/rejected profiles (cleanup only).
 */
export async function promoteCheckoutKycStaging(admin: SupabaseClient, userId: string): Promise<PromoteCheckoutKycResult> {
  const { data: rows, error: qe } = await admin
    .from("kyc_checkout_pending_documents")
    .select("user_id, doc_type, storage_bucket, storage_path, content_type")
    .eq("user_id", userId);
  if (qe) {
    if (isCheckoutKycStagingTableUnavailable(qe)) {
      return { ok: true, promoted: 0 };
    }
    return { ok: false, error: qe.message };
  }
  if (!rows?.length) return { ok: true, promoted: 0 };

  const { data: prof, error: pe } = await admin
    .from("profiles")
    .select("verification_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (pe) return { ok: false, error: pe.message };
  const v = (prof?.verification_status ?? "none").toLowerCase();

  if (v === "approved" || v === "rejected") {
    for (const r of rows) {
      const buck = r.storage_bucket || kycBucket();
      await admin.storage.from(buck).remove([r.storage_path]);
    }
    await admin.from("kyc_checkout_pending_documents").delete().eq("user_id", userId);
    return { ok: true, promoted: 0 };
  }

  let verificationId: string;
  try {
    verificationId = await getOrCreatePendingVerificationId(admin, userId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const now = new Date().toISOString();
  let promoted = 0;

  for (const s of rows) {
    const buck = s.storage_bucket || kycBucket();
    const { data: existingDoc } = await admin
      .from("verification_documents")
      .select("id, storage_bucket, storage_path")
      .eq("verification_id", verificationId)
      .eq("doc_type", s.doc_type)
      .maybeSingle();

    if (existingDoc?.id) {
      const ob = existingDoc.storage_bucket || kycBucket();
      await admin.storage.from(ob).remove([existingDoc.storage_path]);
      const { error: delE } = await admin.from("verification_documents").delete().eq("id", existingDoc.id);
      if (delE) return { ok: false, error: delE.message };
    }

    const { error: insE } = await admin.from("verification_documents").insert({
      verification_id: verificationId,
      doc_type: s.doc_type,
      storage_bucket: buck,
      storage_path: s.storage_path,
      content_type: s.content_type,
    });
    if (insE) return { ok: false, error: insE.message };

    const { error: delSt } = await admin
      .from("kyc_checkout_pending_documents")
      .delete()
      .eq("user_id", userId)
      .eq("doc_type", s.doc_type);
    if (delSt) return { ok: false, error: delSt.message };
    promoted++;
  }

  if (promoted > 0) {
    const { error: up } = await admin
      .from("profiles")
      .update({ verification_status: "pending", verification_submitted_at: now })
      .eq("user_id", userId);
    if (up) return { ok: false, error: up.message };
  }

  return { ok: true, promoted };
}
