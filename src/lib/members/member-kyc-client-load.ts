import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildMemberKycSlotSummaries,
  deriveUiVerificationStatus,
  mergeVerificationDocsForMember,
  type KycDocType,
  type MemberKycSlotSummary,
  type VerificationDocItem,
  type VerificationRow,
} from "@/lib/verification/verification-repo";

export type MemberKycClientLoad = {
  uploadedDocs: Record<string, boolean>;
  memberKycSlots: Record<KycDocType, MemberKycSlotSummary>;
  verificationUiStatus: string;
};

function pushParsedDoc(
  list: VerificationDocItem[],
  o: Record<string, unknown>,
): void {
  const docType = o.doc_type;
  const phase = o.phase;
  const ofn = o.original_filename;
  if (
    typeof docType === "string" &&
    (docType === "aadhaar_front" || docType === "aadhaar_back" || docType === "student_id") &&
    (phase === "checkout_pending" || phase === "submitted") &&
    typeof o.storage_bucket === "string" &&
    typeof o.storage_path === "string" &&
    typeof o.content_type === "string"
  ) {
    list.push({
      doc_type: docType as VerificationDocItem["doc_type"],
      storage_bucket: o.storage_bucket,
      storage_path: o.storage_path,
      content_type: o.content_type,
      phase,
      original_filename: typeof ofn === "string" && ofn.trim() ? ofn.trim().slice(0, 200) : null,
    });
  }
}

/** Browser Supabase: merged KYC docs + per-slot member labels (matches `member-profile` envelope). */
export async function loadMemberKycForDashboard(
  supabase: SupabaseClient,
  userId: string,
  isVerified: boolean,
): Promise<MemberKycClientLoad> {
  const emptySlots = buildMemberKycSlotSummaries(isVerified, "none", []);

  const [{ data: latestRow }, { data: openRow }] = await Promise.all([
    supabase
      .from("verification")
      .select("id, status")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("verification")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["pending", "resubmit"])
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const open = openRow as Pick<VerificationRow, "id" | "status"> | null;
  const latest = latestRow as Pick<VerificationRow, "id" | "status"> | null;
  const orderedIds = [
    ...new Set([open?.id, latest?.id].filter((x): x is string => typeof x === "string" && x.length > 0)),
  ];

  if (orderedIds.length === 0) {
    return {
      uploadedDocs: {},
      memberKycSlots: emptySlots,
      verificationUiStatus: deriveUiVerificationStatus(isVerified, null, []),
    };
  }

  const full = "verification_id, doc_type, phase, storage_bucket, storage_path, content_type, original_filename";
  const min = "verification_id, doc_type, phase, storage_bucket, storage_path, content_type";
  const rFull = await supabase.from("verification_documents").select(full).in("verification_id", orderedIds).is("deleted_at", null);
  let docRows: unknown[] | null = (rFull.data as unknown[] | null) ?? null;
  let error = rFull.error;
  if (error && /original_filename|does not exist/i.test(error.message)) {
    const rMin = await supabase.from("verification_documents").select(min).in("verification_id", orderedIds).is("deleted_at", null);
    docRows = (rMin.data as unknown[] | null) ?? null;
    error = rMin.error;
  }
  if (error || !docRows) {
    return {
      uploadedDocs: {},
      memberKycSlots: emptySlots,
      verificationUiStatus: deriveUiVerificationStatus(isVerified, null, []),
    };
  }

  const docMap = new Map<string, VerificationDocItem[]>();
  for (const id of orderedIds) docMap.set(id, []);

  for (const row of docRows) {
    const o = row as Record<string, unknown>;
    const vid = String(o.verification_id ?? "");
    const bucket = docMap.get(vid);
    if (!bucket) continue;
    pushParsedDoc(bucket, o);
  }

  const merged = mergeVerificationDocsForMember(orderedIds, docMap);
  const statusRow: Pick<VerificationRow, "status"> | null = (open ?? latest)
    ? { status: String((open ?? latest)?.status ?? "none") }
    : null;
  const verificationUiStatus = deriveUiVerificationStatus(isVerified, statusRow, merged);

  const uploadedDocs: Record<string, boolean> = {};
  if (open?.id) {
    for (const d of docMap.get(open.id) ?? []) {
      if (d.phase === "submitted") uploadedDocs[d.doc_type] = true;
    }
  }

  const memberKycSlots = buildMemberKycSlotSummaries(isVerified, verificationUiStatus, merged);

  return { uploadedDocs, memberKycSlots, verificationUiStatus };
}
