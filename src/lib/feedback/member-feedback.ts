export const FEEDBACK_EDIT_WINDOW_DAYS = 30;
export const FEEDBACK_COMMENT_MAX = 1000;

export type MemberFeedbackRow = {
  user_feedback_rating: number | null;
  user_feedback_comment: string | null;
  user_feedback_submitted_at: string | null;
  user_feedback_approved: boolean;
};

export function hasMemberFeedback(row: MemberFeedbackRow): boolean {
  return row.user_feedback_rating != null && Boolean(row.user_feedback_comment?.trim());
}

/** ISO timestamp when edit/delete unlocks (submitted_at + 30 days). */
export function feedbackEditUnlocksAtIso(submittedAt: string | null): string | null {
  if (!submittedAt) return null;
  const ms = Date.parse(submittedAt);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + FEEDBACK_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Editable only after the 30-day cooling period from first submission. */
export function feedbackIsEditable(submittedAt: string | null, now = Date.now()): boolean {
  const unlocksAt = feedbackEditUnlocksAtIso(submittedAt);
  if (!unlocksAt) return false;
  return now >= Date.parse(unlocksAt);
}

export function canSubmitMemberFeedback(profile: {
  is_admin?: boolean | null;
  is_verified?: boolean | null;
}): boolean {
  return profile.is_admin !== true && profile.is_verified === true;
}

export function validateFeedbackInput(rating: unknown, comment: unknown):
  | { ok: true; rating: number; comment: string }
  | { ok: false; error: string } {
  const r = typeof rating === "number" ? rating : Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return { ok: false, error: "Rating must be an integer from 1 to 5." };
  }
  if (typeof comment !== "string") {
    return { ok: false, error: "Comment is required." };
  }
  const trimmed = comment.trim();
  if (!trimmed) {
    return { ok: false, error: "Comment is required." };
  }
  if (trimmed.length > FEEDBACK_COMMENT_MAX) {
    return { ok: false, error: `Comment must be ${FEEDBACK_COMMENT_MAX} characters or fewer.` };
  }
  return { ok: true, rating: r, comment: trimmed };
}
