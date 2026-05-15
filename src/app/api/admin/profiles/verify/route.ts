import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { requireLibraryAdminOrSuperAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type Body = { user_id: string };

export async function POST(request: Request) {
  const gate = await requireLibraryAdminOrSuperAdmin(request);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  let body: Body;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (typeof raw.user_id !== "string" || raw.user_id.length < 10) {
      return apiError("user_id required.", 400);
    }
    body = { user_id: raw.user_id };
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const now = new Date().toISOString();

  const { data: pending } = await admin
    .from("verification")
    .select("id")
    .eq("user_id", body.user_id)
    .eq("status", "pending")
    .is("deleted_at", null)
    .maybeSingle();

  if (pending?.id) {
    const { error: upV } = await admin
      .from("verification")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: gate.userId,
        updated_at: now,
      })
      .eq("id", pending.id);
    if (upV) {
      return apiErrorSafe(upV, 400);
    }
  } else {
    const { error: pe } = await admin.from("profiles").update({ is_verified: true, updated_at: now }).eq("user_id", body.user_id);
    if (pe) {
      return apiErrorSafe(pe, 400);
    }
  }

  return apiSuccess("Member verification approved; profile is_verified synced from verification.");
}
