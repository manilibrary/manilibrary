/**
 * Membership checkout defers profile/KYC field PATCH until payment succeeds.
 * Draft lives in sessionStorage (browser only) until flushed after Razorpay verify.
 */

const STORAGE_KEY = "ml_mship_intake_draft_v1";

export type MembershipIntakeDraftFields = {
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
};

export type MembershipIntakeDraftEnvelope = MembershipIntakeDraftFields & {
  userId: string;
};

function parse(raw: string): MembershipIntakeDraftEnvelope | null {
  try {
    const j = JSON.parse(raw) as MembershipIntakeDraftEnvelope;
    if (!j || typeof j.userId !== "string") return null;
    return j;
  } catch {
    return null;
  }
}

export function readMembershipIntakeDraft(userId: string): MembershipIntakeDraftFields | null {
  if (typeof window === "undefined") return null;
  const env = parse(sessionStorage.getItem(STORAGE_KEY) ?? "");
  if (!env || env.userId !== userId) return null;
  return {
    aadhaar_last_four: env.aadhaar_last_four,
    student_roll_number: env.student_roll_number,
    institution_type: env.institution_type,
    preparing_for: env.preparing_for,
  };
}

export function writeMembershipIntakeDraft(envelope: MembershipIntakeDraftEnvelope): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

export function clearMembershipIntakeDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Sends deferred profile fields to the server after successful payment. No-ops if nothing queued. */
export async function flushMembershipIntakeDraftAfterPayment(): Promise<void> {
  if (typeof window === "undefined") return;
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const env = parse(sessionStorage.getItem(STORAGE_KEY) ?? "");
  if (!env || env.userId !== user.id) return;

  const body: Record<string, unknown> = {};
  if (env.aadhaar_last_four != null && env.aadhaar_last_four !== "") {
    const digits = String(env.aadhaar_last_four).replace(/\D/g, "").slice(0, 4);
    if (digits.length === 4) body.aadhaar_last_four = digits;
  }
  if (env.student_roll_number !== undefined) {
    body.student_roll_number = env.student_roll_number?.trim() ? env.student_roll_number.trim().slice(0, 120) : null;
  }
  if (env.institution_type !== undefined) {
    body.institution_type = env.institution_type && env.institution_type !== "" ? env.institution_type : null;
  }
  if (env.preparing_for !== undefined) {
    body.preparing_for = env.preparing_for?.trim() ? env.preparing_for.trim().slice(0, 200) : null;
  }

  if (Object.keys(body).length === 0) {
    return;
  }

  const res = await fetch("/api/me/profile-intake", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    clearMembershipIntakeDraft();
  }
}
