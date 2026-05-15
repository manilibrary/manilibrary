import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { guardAuthEmail, guardPublicAuthPost } from "@/lib/security/request-guards";
import { validateForgotPasswordEmail } from "@/lib/security/validate-fields";

export const runtime = "nodejs";

/** Rate-limited password reset email (same redirect as web forgot-password form). */
export async function POST(request: Request) {
  const pre = await guardPublicAuthPost(request);
  if (!pre.ok) return pre.response;

  const validated = validateForgotPasswordEmail({ email: pre.body.email });
  if (!validated.ok) {
    return apiError(validated.error, 400);
  }

  const emailLimited = guardAuthEmail(validated.email);
  if (emailLimited) return emailLimited;

  const origin =
    typeof pre.body.origin === "string" && pre.body.origin.startsWith("http")
      ? pre.body.origin.replace(/\/$/, "")
      : process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";

  if (!origin) {
    return apiError("Site URL is not configured for password reset.", 503);
  }

  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
      redirectTo: `${origin}/auth/callback`,
    });

    if (error) {
      return apiErrorSafe(error, 400, "Could not send reset email.");
    }

    return apiSuccess(
      "If an account exists for this email, you will receive a reset link shortly.",
      {},
    );
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not send reset email.");
  }
}
