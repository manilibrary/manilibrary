import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { loadReferralSettings } from "@/lib/referrals/library-referrals";
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

  try {
    const settings = await loadReferralSettings(admin);
    return apiSuccess("OK.", { settings });
  } catch (e) {
    return apiErrorSafe(e, 500);
  }
}

export async function PATCH(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const patch: Record<string, boolean | number | string> = {
    updated_at: new Date().toISOString(),
  };

  if (body.enabled !== undefined) {
    patch.referral_enabled = body.enabled === true;
  }
  if (body.creditsPerReferral !== undefined) {
    const n = typeof body.creditsPerReferral === "number" ? body.creditsPerReferral : Number(body.creditsPerReferral);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return apiError("Credits per referral must be between 0 and 100,000.", 400);
    }
    patch.referral_credits_per_referral = Math.round(n);
  }
  if (body.maxPerMember !== undefined) {
    const n = typeof body.maxPerMember === "number" ? body.maxPerMember : Number(body.maxPerMember);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      return apiError("Max referrals per member must be a whole number between 0 and 1,000.", 400);
    }
    patch.referral_max_per_member = n;
  }

  if (Object.keys(patch).length === 1) {
    return apiError("Provide enabled, creditsPerReferral, and/or maxPerMember.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { error } = await admin.from("library_settings").upsert({ id: 1, ...patch }, { onConflict: "id" });
  if (error) return apiErrorSafe(error, 400);

  try {
    const settings = await loadReferralSettings(admin);
    return apiSuccess("Referral settings updated.", { settings });
  } catch (e) {
    return apiErrorSafe(e, 500);
  }
}
