import type { SupabaseClient } from "@supabase/supabase-js";

import { displayPersonName } from "@/lib/format-person-name";
import { profilePhoneFromDb } from "@/lib/profile-phone";
import { extrasToDisplayFields } from "@/lib/profiles/profile-extras";
import {
  buildMemberKycSlotSummaries,
  deriveUiVerificationStatus,
  fetchDocumentsForVerificationIds,
  fetchLatestVerification,
  fetchOpenVerification,
  kycOriginalNamesFromDocs,
  mergeVerificationDocsForMember,
  type KycDocType,
  type VerificationDocItem,
  type VerificationRow,
} from "@/lib/verification/verification-repo";

function kycDocUploadedSlots(docs: VerificationDocItem[]) {
  const has = (dt: KycDocType) =>
    docs.some((d) => d.doc_type === dt && (d.phase === "checkout_pending" || d.phase === "submitted"));
  return {
    aadhaarFront: has("aadhaar_front"),
    aadhaarBack: has("aadhaar_back"),
    studentId: has("student_id"),
  };
}

export type StudentMemberProfileBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; message: string };

function parseDeviceUserId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = Number(raw.trim());
    if (Number.isFinite(n) && n >= 0) return Math.trunc(n);
  }
  return null;
}

/**
 * JSON body for `GET /api/me/member-profile` and (subset use) enriched `GET /api/auth/me` —
 * same shape the Expo app expects via `pickMemberProfile`.
 * Includes `kycDocUploaded` + `kycDocOriginalNames` for per-document UI (filenames, re-upload).
 */
export async function buildStudentMemberProfileBody(
  admin: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<StudentMemberProfileBodyResult> {
  const { data: prof, error: pe } = await admin
    .from("profiles")
    .select(
      "full_name, device_user_id, phone, email, is_verified, profile_extras, avatar_url, is_admin, is_superadmin",
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (pe) {
    return { ok: false, status: 500, message: pe.message };
  }
  if (!prof) {
    return { ok: false, status: 403, message: "No library profile for this account." };
  }

  const [{ data: openRow }, { data: latestRow }] = await Promise.all([
    fetchOpenVerification(admin, user.id),
    fetchLatestVerification(admin, user.id),
  ]);

  const open = openRow as Pick<VerificationRow, "id" | "status"> | null;
  const latest = latestRow as Pick<VerificationRow, "id" | "status"> | null;
  const orderedIds = [...new Set([open?.id, latest?.id].filter((x): x is string => typeof x === "string" && x.length > 0))];
  const docMap =
    orderedIds.length > 0 ? await fetchDocumentsForVerificationIds(admin, orderedIds) : new Map<string, VerificationDocItem[]>();
  const mergedDocs = mergeVerificationDocsForMember(orderedIds, docMap);

  const x = extrasToDisplayFields((prof as { profile_extras?: unknown }).profile_extras);
  const statusRow: Pick<VerificationRow, "status"> | null = (open ?? latest) ? { status: String((open ?? latest)?.status ?? "none") } : null;
  const verificationStatus = deriveUiVerificationStatus(
    (prof as { is_verified?: boolean }).is_verified === true,
    statusRow,
    mergedDocs,
  );

  const isVerifiedProf = (prof as { is_verified?: boolean }).is_verified === true;
  const slotSummaries = buildMemberKycSlotSummaries(isVerifiedProf, verificationStatus, mergedDocs);

  const isStaff =
    (prof as { is_admin?: boolean }).is_admin === true ||
    (prof as { is_superadmin?: boolean }).is_superadmin === true;
  const role = isStaff ? "admin" : "student";
  const deviceUserId = parseDeviceUserId((prof as { device_user_id?: unknown }).device_user_id);
  const libraryNumber = deviceUserId !== null ? String(deviceUserId).padStart(4, "0") : "—";

  return {
    ok: true,
    body: {
      id: user.id,
      role,
      name: displayPersonName((prof as { full_name?: string }).full_name, "Member"),
      email: ((prof as { email?: string | null }).email as string | null) ?? user.email ?? undefined,
      phone: profilePhoneFromDb((prof as { phone?: unknown }).phone),
      deviceUserId,
      libraryNumber,
      avatarUrl: ((prof as { avatar_url?: string | null }).avatar_url as string | null) ?? null,
      verificationStatus,
      kycDocUploaded: kycDocUploadedSlots(mergedDocs),
      kycDocOriginalNames: kycOriginalNamesFromDocs(mergedDocs),
      memberKycSlots: slotSummaries,
      aadhaarLastFour: x.aadhaar_last_four,
      studentRollNumber: x.student_roll_number,
      institutionType: x.institution_type,
      preparingFor: x.preparing_for,
    },
  };
}
