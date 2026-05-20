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
  /** Sanitized member-supplied name for UI; optional for legacy rows. */
  original_filename?: string | null;
};

/** Max 200 chars; strip ASCII control characters. */
export function sanitizeKycOriginalFilename(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200);
  return t.length ? t : null;
}

/** Label for UI: stored name, else storage path basename. */
export function kycDisplayFileName(d: Pick<VerificationDocItem, "original_filename" | "storage_path">): string {
  const raw = typeof d.original_filename === "string" ? d.original_filename.trim() : "";
  if (raw) return raw.slice(0, 200);
  const seg = d.storage_path.split("/").pop();
  return seg || "file";
}

export function kycOriginalNamesFromDocs(docs: VerificationDocItem[]) {
  const pick = (dt: KycDocType): string | null => {
    const d = docs.find(
      (x) => x.doc_type === dt && (x.phase === "checkout_pending" || x.phase === "submitted"),
    );
    return d ? kycDisplayFileName(d) : null;
  };
  return {
    aadhaarFront: pick("aadhaar_front"),
    aadhaarBack: pick("aadhaar_back"),
    studentId: pick("student_id"),
  };
}

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
      const ofn = o.original_filename;
      out.push({
        doc_type: docType as KycDocType,
        storage_bucket: o.storage_bucket,
        storage_path: o.storage_path,
        content_type: o.content_type,
        phase,
        original_filename: typeof ofn === "string" && ofn.trim() ? ofn.trim().slice(0, 200) : null,
      });
    }
  }
  return out;
}

export function hasSubmittedKycDocs(docs: VerificationDocItem[]): boolean {
  return docs.some((d) => d.phase === "submitted");
}

/** Union doc rows across workflow rows (open first, then latest) without duplicate (doc_type × phase). */
export function mergeVerificationDocsForMember(
  orderedVerificationIds: string[],
  docMap: Map<string, VerificationDocItem[]>,
): VerificationDocItem[] {
  const out: VerificationDocItem[] = [];
  const seen = new Set<string>();
  for (const vid of orderedVerificationIds) {
    for (const d of docMap.get(vid) ?? []) {
      const k = `${d.doc_type}:${d.phase}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(d);
    }
  }
  return out;
}

export type MemberKycSlotStatus = "not_uploaded" | "pending_review" | "verified" | "queued_checkout";

export type MemberKycSlotSummary = {
  fileName: string | null;
  memberStatus: MemberKycSlotStatus;
};

/** Per-slot labels for member dashboard / app (not staff review UI). */
export function buildMemberKycSlotSummaries(
  isVerifiedProfile: boolean,
  verificationUiStatus: string,
  mergedDocs: VerificationDocItem[],
): Record<KycDocType, MemberKycSlotSummary> {
  const v = (verificationUiStatus || "none").toLowerCase();
  const approvedLike = isVerifiedProfile || v === "approved";
  const out = {} as Record<KycDocType, MemberKycSlotSummary>;
  for (const dt of KYC_DOC_TYPES) {
    const sub = mergedDocs.find((d) => d.doc_type === dt && d.phase === "submitted");
    const chk = mergedDocs.find((d) => d.doc_type === dt && d.phase === "checkout_pending");
    const pick = sub ?? chk;
    const fileName = pick ? kycDisplayFileName(pick) : null;
    let memberStatus: MemberKycSlotStatus = "not_uploaded";
    if (approvedLike) {
      if (sub) memberStatus = "verified";
      else if (chk) memberStatus = "queued_checkout";
      else memberStatus = "verified";
    } else if (sub) memberStatus = "pending_review";
    else if (chk) memberStatus = "queued_checkout";
    out[dt] = { fileName, memberStatus };
  }
  return out;
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
  const full =
    "doc_type, phase, storage_bucket, storage_path, content_type, original_filename";
  const min = "doc_type, phase, storage_bucket, storage_path, content_type";
  const r1 = await admin
    .from("verification_documents")
    .select(full)
    .eq("verification_id", verificationId)
    .is("deleted_at", null);
  let data = r1.data as Record<string, unknown>[] | null;
  let error = r1.error;
  if (error && /original_filename|does not exist/i.test(error.message)) {
    const r2 = await admin
      .from("verification_documents")
      .select(min)
      .eq("verification_id", verificationId)
      .is("deleted_at", null);
    data = r2.data as Record<string, unknown>[] | null;
    error = r2.error;
  }
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
      const ofn = o.original_filename;
      out.push({
        doc_type: docType as KycDocType,
        storage_bucket: o.storage_bucket,
        storage_path: o.storage_path,
        content_type: o.content_type,
        phase,
        original_filename: typeof ofn === "string" && ofn.trim() ? ofn.trim().slice(0, 200) : null,
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
  const full =
    "verification_id, doc_type, phase, storage_bucket, storage_path, content_type, original_filename";
  const min = "verification_id, doc_type, phase, storage_bucket, storage_path, content_type";
  const r1 = await admin
    .from("verification_documents")
    .select(full)
    .in("verification_id", uniq)
    .is("deleted_at", null);
  let data = r1.data as Record<string, unknown>[] | null;
  let error = r1.error;
  if (error && /original_filename|does not exist/i.test(error.message)) {
    const r2 = await admin
      .from("verification_documents")
      .select(min)
      .in("verification_id", uniq)
      .is("deleted_at", null);
    data = r2.data as Record<string, unknown>[] | null;
    error = r2.error;
  }
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
    const ofn = o.original_filename;
    const item: VerificationDocItem = {
      doc_type: docType as KycDocType,
      storage_bucket: o.storage_bucket,
      storage_path: o.storage_path,
      content_type: o.content_type,
      phase,
      original_filename: typeof ofn === "string" && ofn.trim() ? ofn.trim().slice(0, 200) : null,
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
  const insertPayload: Record<string, unknown> = {
    verification_id: o.verification_id,
    user_id: o.user_id,
    doc_type: o.item.doc_type,
    phase: o.item.phase,
    storage_bucket: o.item.storage_bucket,
    storage_path: o.item.storage_path,
    content_type: o.item.content_type,
  };
  const label = sanitizeKycOriginalFilename(o.item.original_filename);
  if (label) insertPayload.original_filename = label;

  let { error } = await admin.from("verification_documents").insert(insertPayload);
  if (error && /original_filename|does not exist/i.test(error.message)) {
    delete insertPayload.original_filename;
    ({ error } = await admin.from("verification_documents").insert(insertPayload));
  }
  return { error: error ? new Error(error.message) : null };
}

export type ReplacedVerificationStorage = { bucket: string; path: string };

/**
 * One active row per (verification_id, doc_type, phase) (partial unique index).
 * Update in place when present so reuploads do not accumulate soft-deleted rows.
 */
export async function replaceVerificationDocumentSlot(
  admin: SupabaseClient,
  o: {
    verification_id: string;
    user_id: string;
    item: VerificationDocItem;
  },
): Promise<{ error: Error | null; replacedStorage: ReplacedVerificationStorage | null }> {
  const { data: existing, error: selErr } = await admin
    .from("verification_documents")
    .select("id, storage_bucket, storage_path")
    .eq("verification_id", o.verification_id)
    .eq("doc_type", o.item.doc_type)
    .eq("phase", o.item.phase)
    .is("deleted_at", null)
    .maybeSingle();
  if (selErr) return { error: new Error(selErr.message), replacedStorage: null };

  const label = sanitizeKycOriginalFilename(o.item.original_filename);
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    storage_bucket: o.item.storage_bucket,
    storage_path: o.item.storage_path,
    content_type: o.item.content_type,
    updated_at: now,
  };
  if (label) updatePayload.original_filename = label;
  else updatePayload.original_filename = null;

  const ex = existing as { id?: string; storage_bucket?: string; storage_path?: string } | null;
  if (ex?.id) {
    let { error } = await admin.from("verification_documents").update(updatePayload).eq("id", ex.id);
    if (error && /original_filename|does not exist/i.test(error.message)) {
      delete updatePayload.original_filename;
      ({ error } = await admin.from("verification_documents").update(updatePayload).eq("id", ex.id));
    }
    if (error) return { error: new Error(error.message), replacedStorage: null };
    const prevB = typeof ex.storage_bucket === "string" ? ex.storage_bucket : "";
    const prevP = typeof ex.storage_path === "string" ? ex.storage_path : "";
    if (
      prevB &&
      prevP &&
      (prevB !== o.item.storage_bucket || prevP !== o.item.storage_path)
    ) {
      return { error: null, replacedStorage: { bucket: prevB, path: prevP } };
    }
    return { error: null, replacedStorage: null };
  }

  const ins = await insertVerificationDocument(admin, o);
  if (ins.error) return { error: ins.error, replacedStorage: null };
  return { error: null, replacedStorage: null };
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
