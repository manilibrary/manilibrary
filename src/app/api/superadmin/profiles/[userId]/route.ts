import { apiError, apiErrorSafe, apiSuccess, safeClientErrorMessage } from "@/lib/api/json-response";
import { extrasToDisplayFields } from "@/lib/profiles/profile-extras";
import { requireLibrarySuperAdmin } from "@/lib/supabase/require-library-super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { purgeLibraryUserCompletely } from "@/lib/superadmin/purge-user-data";
import {
  deriveUiVerificationStatus,
  fetchDocumentsForVerification,
  fetchLatestVerification,
  type VerificationDocItem,
  type VerificationRow,
} from "@/lib/verification/verification-repo";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_SELECT =
  "user_id, full_name, device_user_id, email, phone, is_admin, is_superadmin, created_at, updated_at, is_verified, is_active, profile_extras";

function flattenProfileResponse(
  profile: Record<string, unknown>,
  latestVer: VerificationRow | null,
  latestDocs: VerificationDocItem[],
) {
  const x = extrasToDisplayFields(profile.profile_extras);
  const isVerified = profile.is_verified === true;
  return {
    ...profile,
    aadhaar_last_four: x.aadhaar_last_four,
    student_roll_number: x.student_roll_number,
    institution_type: x.institution_type,
    preparing_for: x.preparing_for,
    verification_status: deriveUiVerificationStatus(isVerified, latestVer, latestDocs),
  };
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const gate = await requireLibrarySuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { userId } = await ctx.params;
  if (!UUID_RE.test(userId)) {
    return apiError("Invalid user id.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server configuration error.");
  }

  const { data: profile, error } = await admin.from("profiles").select(PROFILE_SELECT).eq("user_id", userId).maybeSingle();

  if (error) {
    return apiErrorSafe(error, 500, "Could not load profile.");
  }
  if (!profile) {
    return apiError("Profile not found.", 404);
  }

  const { data: latestVer } = await fetchLatestVerification(admin, userId);
  const latestDocs = latestVer?.id ? await fetchDocumentsForVerification(admin, latestVer.id) : [];

  return apiSuccess("Profile loaded.", {
    profile: flattenProfileResponse(profile as Record<string, unknown>, latestVer, latestDocs),
    note: "Member number shown in the app cannot be changed here. To change it, contact library support.",
  });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const gate = await requireLibrarySuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { userId } = await ctx.params;
  if (!UUID_RE.test(userId)) {
    return apiError("Invalid user id.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const b = body as Record<string, unknown>;
  const patch: { is_admin?: boolean; is_superadmin?: boolean } = {};
  if (typeof b.is_admin === "boolean") patch.is_admin = b.is_admin;
  if (typeof b.is_superadmin === "boolean") patch.is_superadmin = b.is_superadmin;

  if (Object.keys(patch).length === 0) {
    return apiError("Send is_admin and/or is_superadmin booleans.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server configuration error.");
  }

  const { data, error } = await admin
    .from("profiles")
    .update(patch)
    .eq("user_id", userId)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    return apiErrorSafe(error, 500, "Could not update profile.");
  }
  if (!data) {
    return apiError("Profile not found.", 404);
  }

  const { data: latestVer } = await fetchLatestVerification(admin, userId);
  const latestDocs = latestVer?.id ? await fetchDocumentsForVerification(admin, latestVer.id) : [];

  return apiSuccess("Profile updated.", { profile: flattenProfileResponse(data as Record<string, unknown>, latestVer, latestDocs) });
}

/**
 * Permanently deletes the Auth user and all linked library data (memberships, payments,
 * verification, membership_events, library export audit, attendance processor refs on
 * archived days, KYC storage objects, etc.).
 * Cannot delete yourself or the only remaining superadmin.
 */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const gate = await requireLibrarySuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { userId } = await ctx.params;
  if (!UUID_RE.test(userId)) {
    return apiError("Invalid user id.", 400);
  }
  if (userId === gate.userId) {
    return apiError("You cannot delete your own account from this panel.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server configuration error.");
  }

  const result = await purgeLibraryUserCompletely(admin, userId);
  if (!result.ok) {
    return apiError(safeClientErrorMessage(result, "Could not complete delete."), 400);
  }

  return apiSuccess("User and linked library data were permanently deleted.", { user_id: userId });
}
