import { apiError, apiSuccess } from "@/lib/api/json-response";
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
    const msg = e instanceof Error ? e.message : "Server misconfiguration.";
    return apiError(msg, 503);
  }

  const now = new Date().toISOString();
  const newStatus = body.action === "reject" ? "rejected" : "resubmit";

  const { data: pending, error: findErr } = await admin
    .from("verification_requests")
    .select("id")
    .eq("user_id", body.user_id)
    .eq("status", "pending")
    .maybeSingle();

  if (findErr) {
    return apiError(findErr.message, 500);
  }
  if (!pending?.id) {
    return apiError("No pending verification request for this member.", 400);
  }

  const { error: upVr } = await admin
    .from("verification_requests")
    .update({
      status: newStatus,
      reviewed_at: now,
      reviewed_by: gate.userId,
      student_message: body.student_message,
    })
    .eq("id", pending.id);

  if (upVr) {
    return apiError(upVr.message, 400);
  }

  const profileVerification = body.action === "reject" ? "rejected" : "resubmit";

  const { error: upProf } = await admin
    .from("profiles")
    .update({
      verification_status: profileVerification,
      verification_reviewed_at: now,
      verification_reviewed_by: gate.userId,
    })
    .eq("user_id", body.user_id);

  if (upProf) {
    return apiError(upProf.message, 400);
  }

  const label = newStatus === "rejected" ? "rejected" : "resubmit requested";
  return apiSuccess(`Verification ${label} for member.`, { status: newStatus });
}
