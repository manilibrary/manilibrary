import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { requireLibraryAdminOrSuperAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type Action = "reject" | "request_resubmit";

type Body = {
  user_id: string;
  action: Action;
  student_message?: string | null;
};

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
    const action = raw.action;
    if (action !== "reject" && action !== "request_resubmit") {
      return apiError("action must be reject or request_resubmit.", 400);
    }
    const msg =
      typeof raw.student_message === "string" ? raw.student_message.trim().slice(0, 2000) : "";
    body = {
      user_id: raw.user_id,
      action,
      student_message: msg.length ? msg : null,
    };
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
  const newStatus = body.action === "reject" ? "rejected" : "resubmit";

  const { data: pending, error: findErr } = await admin
    .from("verification")
    .select("id")
    .eq("user_id", body.user_id)
    .eq("status", "pending")
    .is("deleted_at", null)
    .maybeSingle();

  if (findErr) {
    return apiErrorSafe(findErr, 500);
  }
  if (!pending?.id) {
    return apiError("No pending verification request for this member.", 400);
  }

  const { error: upVr } = await admin
    .from("verification")
    .update({
      status: newStatus,
      reviewed_at: now,
      reviewed_by: gate.userId,
      student_message: body.student_message,
      updated_at: now,
    })
    .eq("id", pending.id);

  if (upVr) {
    return apiErrorSafe(upVr, 400);
  }

  const label = newStatus === "rejected" ? "rejected" : "resubmit requested";
  return apiSuccess(`Verification ${label} for member.`, { status: newStatus });
}
