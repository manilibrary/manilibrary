import { apiError, apiSuccess } from "@/lib/api/json-response";
import { requireLibraryAdminOrSuperAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type Body = { user_id: string };

export async function POST(request: Request) {
  const gate = await requireLibraryAdminOrSuperAdmin();
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
    const msg = e instanceof Error ? e.message : "Server misconfiguration.";
    return apiError(msg, 503);
  }

  const now = new Date().toISOString();

  const { data: pending } = await admin
    .from("verification_requests")
    .select("id")
    .eq("user_id", body.user_id)
    .eq("status", "pending")
    .maybeSingle();

  if (pending?.id) {
    await admin
      .from("verification_requests")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: gate.userId,
      })
      .eq("id", pending.id);
  }

  const { error: pe } = await admin
    .from("profiles")
    .update({
      verification_status: "approved",
      verification_reviewed_at: now,
      verification_reviewed_by: gate.userId,
    })
    .eq("user_id", body.user_id);

  if (pe) {
    return apiError(pe.message, 400);
  }

  return apiSuccess("Member verification approved and profile marked verified.");
}
