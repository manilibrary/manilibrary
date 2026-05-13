import { apiError, apiSuccess } from "@/lib/api/json-response";
import { requireLibrarySuperAdmin } from "@/lib/supabase/require-library-super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const msg = e instanceof Error ? e.message : "Server configuration error.";
    return apiError(msg, 503);
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "user_id, full_name, device_user_id, email, phone, is_admin, is_superadmin, created_at, device_enrolled_at, verification_status, aadhaar_last_four, student_roll_number, institution_type, preparing_for",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return apiError(error.message, 500);
  }
  if (!profile) {
    return apiError("Profile not found.", 404);
  }

  return apiSuccess("Profile loaded.", {
    profile,
    note: "device_user_id is enforced immutable by database trigger; change Empcode via a migration or support playbook.",
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
    const msg = e instanceof Error ? e.message : "Server configuration error.";
    return apiError(msg, 503);
  }

  const { data, error } = await admin
    .from("profiles")
    .update(patch)
    .eq("user_id", userId)
    .select(
      "user_id, full_name, device_user_id, email, phone, is_admin, is_superadmin, created_at, device_enrolled_at, verification_status, aadhaar_last_four, student_roll_number, institution_type, preparing_for",
    )
    .maybeSingle();

  if (error) {
    return apiError(error.message, 500);
  }
  if (!data) {
    return apiError("Profile not found.", 404);
  }

  return apiSuccess("Profile updated.", { profile: data });
}
