import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  canSubmitMemberFeedback,
  feedbackEditUnlocksAtIso,
  feedbackIsEditable,
  hasMemberFeedback,
  validateFeedbackInput,
} from "@/lib/feedback/member-feedback";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

async function gateVerifiedMember(
  admin: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
) {
  const { data, error } = await admin
    .from("profiles")
    .select("is_admin, is_verified")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false as const, response: apiErrorSafe(error, 500) };
  if (!data || !canSubmitMemberFeedback(data)) {
    return {
      ok: false as const,
      response: apiError("Feedback is only available for verified members.", 403),
    };
  }
  return { ok: true as const };
}

function feedbackPayload(row: {
  user_feedback_rating: number | null;
  user_feedback_comment: string | null;
  user_feedback_submitted_at: string | null;
  user_feedback_approved: boolean;
}) {
  const submittedAt = row.user_feedback_submitted_at;
  const editable = feedbackIsEditable(submittedAt);
  return {
    rating: row.user_feedback_rating,
    comment: row.user_feedback_comment,
    submittedAt,
    approved: row.user_feedback_approved === true,
    editable,
    editAvailableFrom: feedbackEditUnlocksAtIso(submittedAt),
  };
}

export async function GET(request: Request) {
  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) return apiError("Sign in required.", 401);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const gate = await gateVerifiedMember(admin, user.id);
  if (!gate.ok) return gate.response;

  const { data, error } = await admin
    .from("profiles")
    .select(
      "user_feedback_rating, user_feedback_comment, user_feedback_submitted_at, user_feedback_approved",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return apiErrorSafe(error, 500);
  if (!data || !hasMemberFeedback(data)) {
    return apiSuccess("No feedback yet.", { feedback: null });
  }
  return apiSuccess("OK.", { feedback: feedbackPayload(data) });
}

export async function POST(request: Request) {
  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) return apiError("Sign in required.", 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const validated = validateFeedbackInput(body.rating, body.comment);
  if (!validated.ok) return apiError(validated.error, 400);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const gate = await gateVerifiedMember(admin, user.id);
  if (!gate.ok) return gate.response;

  const { data: existing, error: exErr } = await admin
    .from("profiles")
    .select(
      "user_feedback_rating, user_feedback_comment, user_feedback_submitted_at, user_feedback_approved",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (exErr) return apiErrorSafe(exErr, 500);

  const hadFeedback = existing ? hasMemberFeedback(existing) : false;
  if (hadFeedback && !feedbackIsEditable(existing?.user_feedback_submitted_at ?? null)) {
    return apiError("Feedback can only be edited after 30 days from posting.", 403);
  }

  const now = new Date().toISOString();
  const submittedAt = hadFeedback ? existing!.user_feedback_submitted_at ?? now : now;

  const { data: updated, error: upErr } = await admin
    .from("profiles")
    .update({
      user_feedback_rating: validated.rating,
      user_feedback_comment: validated.comment,
      user_feedback_submitted_at: submittedAt,
      user_feedback_approved: false,
      updated_at: now,
    })
    .eq("user_id", user.id)
    .select(
      "user_feedback_rating, user_feedback_comment, user_feedback_submitted_at, user_feedback_approved",
    )
    .maybeSingle();

  if (upErr) return apiErrorSafe(upErr, 400);
  if (!updated) return apiError("Profile not found.", 404);

  return apiSuccess(hadFeedback ? "Feedback updated." : "Feedback submitted.", {
    feedback: feedbackPayload(updated),
  });
}

export async function DELETE(request: Request) {
  const {
    data: { user },
    error: authErr,
  } = await getAuthUserForApiRequest(request);
  if (authErr || !user) return apiError("Sign in required.", 401);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const gate = await gateVerifiedMember(admin, user.id);
  if (!gate.ok) return gate.response;

  const { data: existing, error: exErr } = await admin
    .from("profiles")
    .select("user_feedback_submitted_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (exErr) return apiErrorSafe(exErr, 500);
  if (!existing?.user_feedback_submitted_at) {
    return apiError("No feedback to delete.", 404);
  }
  if (!feedbackIsEditable(existing.user_feedback_submitted_at)) {
    return apiError("Feedback can only be deleted after 30 days from posting.", 403);
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("profiles")
    .update({
      user_feedback_rating: null,
      user_feedback_comment: null,
      user_feedback_submitted_at: null,
      user_feedback_approved: false,
      updated_at: now,
    })
    .eq("user_id", user.id);

  if (upErr) return apiErrorSafe(upErr, 400);
  return apiSuccess("Feedback deleted.");
}
