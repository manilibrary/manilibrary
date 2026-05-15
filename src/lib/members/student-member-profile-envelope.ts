import type { SupabaseClient } from "@supabase/supabase-js";

import { displayPersonName } from "@/lib/format-person-name";
import { extrasToDisplayFields } from "@/lib/profiles/profile-extras";
import {
  deriveUiVerificationStatus,
  type VerificationDocItem,
  type VerificationRow,
} from "@/lib/verification/verification-repo";

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

  const { data: latestRow } = await admin
    .from("verification")
    .select("id, status")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDocs: VerificationDocItem[] = [];
  const row = latestRow as Pick<VerificationRow, "id" | "status"> | null;
  if (row?.id) {
    const { data: docRows } = await admin
      .from("verification_documents")
      .select("doc_type, phase, storage_bucket, storage_path, content_type")
      .eq("verification_id", row.id)
      .is("deleted_at", null);
    for (const r of docRows ?? []) {
      const o = r as Record<string, unknown>;
      const docType = o.doc_type;
      const phase = o.phase;
      if (
        typeof docType === "string" &&
        (docType === "aadhaar_front" || docType === "aadhaar_back" || docType === "student_id") &&
        (phase === "checkout_pending" || phase === "submitted") &&
        typeof o.storage_bucket === "string" &&
        typeof o.storage_path === "string" &&
        typeof o.content_type === "string"
      ) {
        latestDocs.push({
          doc_type: docType as VerificationDocItem["doc_type"],
          storage_bucket: o.storage_bucket,
          storage_path: o.storage_path,
          content_type: o.content_type,
          phase,
        });
      }
    }
  }

  const x = extrasToDisplayFields((prof as { profile_extras?: unknown }).profile_extras);
  const rowForUi: Pick<VerificationRow, "status"> | null = row ? { status: String(row.status ?? "none") } : null;
  const verificationStatus = deriveUiVerificationStatus(
    (prof as { is_verified?: boolean }).is_verified === true,
    rowForUi,
    latestDocs,
  );

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
      phone: ((prof as { phone?: string | null }).phone as string | null) ?? undefined,
      deviceUserId,
      libraryNumber,
      avatarUrl: ((prof as { avatar_url?: string | null }).avatar_url as string | null) ?? null,
      verificationStatus,
      aadhaarLastFour: x.aadhaar_last_four,
      studentRollNumber: x.student_roll_number,
      institutionType: x.institution_type,
      preparingFor: x.preparing_for,
    },
  };
}
