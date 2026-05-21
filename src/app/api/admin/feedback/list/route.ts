import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { displayPersonName } from "@/lib/format-person-name";
import { hasMemberFeedback } from "@/lib/feedback/member-feedback";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data, error } = await admin
    .from("profiles")
    .select(
      "user_id, full_name, email, avatar_url, device_user_id, user_feedback_rating, user_feedback_comment, user_feedback_submitted_at, user_feedback_approved",
    )
    .is("deleted_at", null)
    .not("user_feedback_rating", "is", null)
    .not("user_feedback_comment", "is", null)
    .order("user_feedback_submitted_at", { ascending: false });

  if (error) return apiErrorSafe(error, 500);

  const rows = (data ?? [])
    .filter(hasMemberFeedback)
    .map((r) => ({
      userId: r.user_id,
      fullName: displayPersonName(r.full_name, "Member"),
      email: r.email ?? null,
      avatarUrl: r.avatar_url ?? null,
      deviceUserId: r.device_user_id,
      rating: r.user_feedback_rating,
      comment: r.user_feedback_comment,
      submittedAt: r.user_feedback_submitted_at,
      approved: r.user_feedback_approved === true,
    }));

  return apiSuccess("OK.", { feedbacks: rows });
}
