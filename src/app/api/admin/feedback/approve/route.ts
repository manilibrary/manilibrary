import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type Body = {
  user_id: string;
  approved: boolean;
};

export async function POST(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let body: Body;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    if (typeof raw.user_id !== "string" || raw.user_id.length < 10) {
      return apiError("user_id required.", 400);
    }
    if (typeof raw.approved !== "boolean") {
      return apiError("approved must be true or false.", 400);
    }
    body = { user_id: raw.user_id, approved: raw.approved };
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data: row, error: findErr } = await admin
    .from("profiles")
    .select("user_feedback_rating, user_feedback_comment")
    .eq("user_id", body.user_id)
    .maybeSingle();

  if (findErr) return apiErrorSafe(findErr, 500);
  if (!row?.user_feedback_rating || !row.user_feedback_comment?.trim()) {
    return apiError("This member has not submitted feedback.", 404);
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("profiles")
    .update({
      user_feedback_approved: body.approved,
      updated_at: now,
    })
    .eq("user_id", body.user_id);

  if (upErr) return apiErrorSafe(upErr, 400);

  return apiSuccess(body.approved ? "Feedback approved for testimonials." : "Feedback removed from testimonials.");
}
