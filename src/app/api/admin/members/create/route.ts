import { apiError, apiErrorSafe, apiSuccess } from "@/lib/api/json-response";
import { createMemberAccount, isValidMemberEmail, normalizeMemberEmail } from "@/lib/admin/create-member-account";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireLibraryAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  let body: { full_name?: unknown; email?: unknown; phone?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? normalizeMemberEmail(body.email) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const passwordRaw = typeof body.password === "string" ? body.password : "";

  if (!fullName || fullName.length > 200) {
    return apiError("full_name is required (max 200 characters).", 400);
  }
  if (!email || !isValidMemberEmail(email)) {
    return apiError("A valid email is required.", 400);
  }

  const password = passwordRaw.trim();

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server configuration error.");
  }

  const acc = await createMemberAccount(admin, {
    full_name: fullName,
    email,
    ...(phone ? { phone } : {}),
    ...(password.length > 0 ? { password } : {}),
  });

  if (!acc.ok) {
    return apiError(acc.message, 400);
  }

  const { data: profile, error: pe } = await admin
    .from("profiles")
    .select("user_id, device_user_id, full_name, email, phone")
    .eq("user_id", acc.user_id)
    .maybeSingle();

  if (pe || !profile) {
    await admin.auth.admin.deleteUser(acc.user_id);
    return apiErrorSafe(pe ?? new Error("profile_missing"), 500, "Account was created but profile setup failed. Try again.");
  }

  return apiSuccess("Member account created. Library number is assigned automatically.", {
    user_id: profile.user_id,
    device_user_id: profile.device_user_id,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    ...(acc.temporary_password ? { temporary_password: acc.temporary_password } : {}),
  });
}
