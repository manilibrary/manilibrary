import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { mergeProfileExtras } from "@/lib/profiles/profile-extras";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const INSTITUTIONS = new Set(["school", "college", "freelance", "other"]);

type Body = {
  aadhaar_last_four?: string | null;
  student_roll_number?: string | null;
  institution_type?: string | null;
  preparing_for?: string | null;
};

function normLastFour(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/\D/g, "").slice(0, 4);
  if (s.length !== 4) return "__invalid__";
  return s;
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("Sign in required.", 401);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const extrasPatch: Record<string, unknown> = {};

  if ("aadhaar_last_four" in body) {
    const n = normLastFour(body.aadhaar_last_four);
    if (n === "__invalid__") {
      return apiError("Aadhaar last four must be exactly 4 digits.", 400);
    }
    extrasPatch.aadhaar_last_four = n;
  }
  if ("student_roll_number" in body) {
    const s = body.student_roll_number == null ? null : String(body.student_roll_number).trim().slice(0, 120);
    extrasPatch.student_roll_number = s || null;
  }
  if ("institution_type" in body) {
    const t = body.institution_type == null || body.institution_type === "" ? null : String(body.institution_type);
    if (t && !INSTITUTIONS.has(t)) {
      return apiError("institution_type must be school, college, freelance, or other.", 400);
    }
    extrasPatch.institution_type = t;
  }
  if ("preparing_for" in body) {
    const s = body.preparing_for == null ? null : String(body.preparing_for).trim().slice(0, 200);
    extrasPatch.preparing_for = s || null;
  }

  if (Object.keys(extrasPatch).length === 0) {
    return apiError("No fields to update.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data: cur, error: ce } = await admin.from("profiles").select("profile_extras").eq("user_id", user.id).maybeSingle();
  if (ce) {
    return apiErrorSafe(ce, 400);
  }

  const merged = mergeProfileExtras(cur?.profile_extras ?? {}, extrasPatch);

  const { error } = await admin.from("profiles").update({ profile_extras: merged }).eq("user_id", user.id);
  if (error) {
    return apiErrorSafe(error, 400);
  }

  return apiSuccess("Profile / intake fields saved.");
}
