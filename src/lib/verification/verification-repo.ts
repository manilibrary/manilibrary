import type { SupabaseClient } from "@supabase/supabase-js";

export const KYC_DOC_TYPES = ["aadhaar_front", "aadhaar_back", "student_id"] as const;
export type KycDocType = (typeof KYC_DOC_TYPES)[number];
export type DocPhase = "checkout_pending" | "submitted";

export type VerificationDocItem = {
  doc_type: KycDocType;
  storage_bucket: string;
  storage_path: string;
  content_type: string;
  phase: DocPhase;
};

/** Parent KYC workflow row (`public.verification`). File rows live in `verification_documents`. */
export type VerificationRow = {
  id: string;
  user_id: string;
  status: string;
  submitted_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  student_message?: string | null;
  resubmit_count?: number;
};

const VERIFICATION_SELECT =
  "id, user_id, status, submitted_at, reviewed_at, reviewed_by, student_message, resubmit_count";

export function parseVerificationDocs(json: unknown): VerificationDocItem[] {
  if (!Array.isArray(json)) return [];
  const out: VerificationDocItem[] = [];
  for (const x of json) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const docType = o.doc_type;
    const phase = o.phase;
    if (
      typeof docType === "string" &&
      KYC_DOC_TYPES.includes(docType as KycDocType) &&
      (phase === "checkout_pending" || phase === "submitted") &&
      typeof o.storage_bucket === "string" &&
      typeof o.storage_path === "string" &&
      typeof o.content_type === "string"
    ) {
      out.push({
        doc_type: docType as KycDocType,
        storage_bucket: o.storage_bucket,
        storage_path: o.storage_path,
        content_type: o.content_type,
        phase,
      });
    }
  }
  return out;
}

export function hasSubmittedKycDocs(docs: VerificationDocItem[]): boolean {
  return docs.some((d) => d.phase === "submitted");
}

export function listDocTypesForPhase(docs: VerificationDocItem[], phase: DocPhase): KycDocType[] {
  return docs.filter((d) => d.phase === phase).map((d) => d.doc_type);
}

export function upsertDocInList(docs: VerificationDocItem[], item: VerificationDocItem): VerificationDocItem[] {
  const next = docs.filter((d) => !(d.doc_type === item.doc_type && d.phase === item.phase));
  next.push(item);
  return next;
}

export function removeDocsByDocTypeAndPhase(
  docs: VerificationDocItem[],
  docType: KycDocType,
  phase: DocPhase,
): VerificationDocItem[] {
  return docs.filter((d) => !(d.doc_type === docType && d.phase === phase));
}

/** Load active file rows for one verification id. */
export async function fetchDocumentsForVerification(
  admin: SupabaseClient,
  verificationId: string,
): Promise<VerificationDocItem[]> {
  const { data, error } = await admin
    .from("verification_documents")
    .select("doc_type, phase, storage_bucket, storage_path, content_type")
    .eq("verification_id", verificationId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const out: VerificationDocItem[] = [];
  for (const r of data ?? []) {
    const o = r as Record<string, unknown>;
    const docType = o.doc_type;
    const phase = o.phase;
    if (
      typeof docType === "string" &&
      KYC_DOC_TYPES.includes(docType as KycDocType) &&
      (phase === "checkout_pending" || phase === "submitted") &&
      typeof o.storage_bucket === "string" &&
      typeof o.storage_path === "string" &&
      typeof o.content_type === "string"
    ) {
      out.push({
        doc_type: docType as KycDocType,
        storage_bucket: o.storage_bucket,
        storage_path: o.storage_path,
        content_type: o.content_type,
        phase,
      });
    }
  }
  return out;
}

export async function fetchDocumentsForVerificationIds(
  admin: SupabaseClient,
  verificationIds: string[],
): Promise<Map<string, VerificationDocItem[]>> {
  const map = new Map<string, VerificationDocItem[]>();
  for (const id of verificationIds) map.set(id, []);
  const uniq = [...new Set(verificationIds.filter(Boolean))];
  if (uniq.length === 0) return map;
  const { data, error } = await admin
    .from("verification_documents")
    .select("verification_id, doc_type, phase, storage_bucket, storage_path, content_type")
    .in("verification_id", uniq)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    const o = r as Record<string, unknown>;
    const vid = String(o.verification_id ?? "");
    const docType = o.doc_type;
    const phase = o.phase;
    if (
      !vid ||
      typeof docType !== "string" ||
      !KYC_DOC_TYPES.includes(docType as KycDocType) ||
      (phase !== "checkout_pending" && phase !== "submitted") ||
      typeof o.storage_bucket !== "string" ||
      typeof o.storage_path !== "string" ||
      typeof o.content_type !== "string"
    ) {
      continue;
    }
    const item: VerificationDocItem = {
      doc_type: docType as KycDocType,
      storage_bucket: o.storage_bucket,
      storage_path: o.storage_path,
      content_type: o.content_type,
      phase,
    };
    const arr = map.get(vid) ?? [];
    arr.push(item);
    map.set(vid, arr);
  }
  return map;
}

/** Soft-delete active rows for (verification, doc_type, phase). */
export async function softDeleteVerificationDocumentSlot(
  admin: SupabaseClient,
  verificationId: string,
  docType: KycDocType,
  phase: DocPhase,
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("verification_documents")
    .update({ deleted_at: now, updated_at: now })
    .eq("verification_id", verificationId)
    .eq("doc_type", docType)
    .eq("phase", phase)
    .is("deleted_at", null);
  return { error: error ? new Error(error.message) : null };
}

export async function insertVerificationDocument(
  admin: SupabaseClient,
  o: {
    verification_id: string;
    user_id: string;
    item: VerificationDocItem;
  },
): Promise<{ error: Error | null }> {
  const { error } = await admin.from("verification_documents").insert({
    verification_id: o.verification_id,
    user_id: o.user_id,
    doc_type: o.item.doc_type,
    phase: o.item.phase,
    storage_bucket: o.item.storage_bucket,
    storage_path: o.item.storage_path,
    content_type: o.item.content_type,
  });
  return { error: error ? new Error(error.message) : null };
}

/** Replace one (doc_type × phase) slot: soft-delete existing active, then insert. */
export async function replaceVerificationDocumentSlot(
  admin: SupabaseClient,
  o: {
    verification_id: string;
    user_id: string;
    item: VerificationDocItem;
  },
): Promise<{ error: Error | null }> {
  const { error: d1 } = await softDeleteVerificationDocumentSlot(admin, o.verification_id, o.item.doc_type, o.item.phase);
  if (d1) return { error: d1 };
  return insertVerificationDocument(admin, o);
}

export async function fetchLatestVerification(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("verification")
    .select(VERIFICATION_SELECT)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as VerificationRow | null, error };
}

export async function fetchPendingVerification(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("verification")
    .select(VERIFICATION_SELECT)
    .eq("user_id", userId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .maybeSingle();
  return { data: data as VerificationRow | null, error };
}

export async function fetchOpenVerification(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("verification")
    .select(VERIFICATION_SELECT)
    .eq("user_id", userId)
    .in("status", ["pending", "resubmit"])
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as VerificationRow | null, error };
}

/**
 * UI string compatible with old `verification_status` on profiles.
 * Pass `docs` from `verification_documents` for the same workflow row as `row` (when row is non-null).
 */
export function deriveUiVerificationStatus(
  isVerified: boolean,
  row: Pick<VerificationRow, "status"> | null,
  docs: VerificationDocItem[] = [],
): string {
  if (!row) {
    return isVerified ? "approved" : "none";
  }
  if (row.status === "resubmit") return "resubmit";
  if (row.status === "rejected") return "rejected";
  if (row.status === "pending") {
    if (!hasSubmittedKycDocs(docs)) return "none";
    return "pending";
  }
  if (isVerified) return "approved";
  return "none";
}

export type VerificationWithDocs = { row: VerificationRow; docs: VerificationDocItem[] };

/** Latest verification row per user (`submitted_at` desc), with documents loaded. */
export async function mapLatestVerificationWithDocsByUserId(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, VerificationWithDocs | null>> {
  const out = new Map<string, VerificationWithDocs | null>();
  for (const u of userIds) out.set(u, null);
  const uniq = [...new Set(userIds.filter(Boolean))];
  const CHUNK = 80;
  const rowByUser = new Map<string, VerificationRow>();
  for (let i = 0; i < uniq.length; i += CHUNK) {
    const slice = uniq.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    const { data, error } = await admin
      .from("verification")
      .select(VERIFICATION_SELECT)
      .in("user_id", slice)
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const seen = new Set<string>();
    for (const row of (data ?? []) as VerificationRow[]) {
      const uid = row.user_id;
      if (seen.has(uid)) continue;
      seen.add(uid);
      rowByUser.set(uid, row);
    }
  }
  const vids = [...rowByUser.values()].map((r) => r.id);
  const docMap = await fetchDocumentsForVerificationIds(admin, vids);
  for (const uid of uniq) {
    const row = rowByUser.get(uid);
    if (!row) {
      out.set(uid, null);
      continue;
    }
    out.set(uid, { row, docs: docMap.get(row.id) ?? [] });
  }
  return out;
}

export async function ensurePendingVerification(admin: SupabaseClient, userId: string): Promise<VerificationRow> {
  const { data: ex, error: e1 } = await fetchPendingVerification(admin, userId);
  if (e1) throw new Error(e1.message);
  if (ex?.id) return ex;
  const { data: ins, error: e2 } = await admin
    .from("verification")
    .insert({ user_id: userId, status: "pending" })
    .select(VERIFICATION_SELECT)
    .single();
  if (e2 || !ins) throw new Error(e2?.message ?? "Could not create verification row.");
  return ins as VerificationRow;
}
