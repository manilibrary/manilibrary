import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { lookupReferrerForSignup, normalizeReferralCode } from "@/lib/referrals/library-referrals";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const raw = typeof body.code === "string" ? body.code : "";
  const code = normalizeReferralCode(raw);
  if (!code) return apiError("Enter a referral code.", 400);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  try {
    const lookup = await lookupReferrerForSignup(admin, code);
    if (!lookup.ok) return apiError(lookup.error, 400);
    return apiSuccess("Referral code is valid.", { code });
  } catch (e) {
    return apiErrorSafe(e, 500);
  }
}
