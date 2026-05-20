import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { guardAuthEmail, guardPublicAuthPost } from "@/lib/security/request-guards";
import { signupEmailRedirectTo } from "@/lib/auth/signup-email-redirect";
import { validateForgotPasswordEmail } from "@/lib/security/validate-fields";

function wantsMobileSession(body: Record<string, unknown>) {
  if (body.client === "expo") return true;
  return false;
}

export const runtime = "nodejs";

/** Resend signup confirmation email (rate-limited, same redirect as register). */
export async function POST(request: Request) {
  const pre = await guardPublicAuthPost(request);
  if (!pre.ok) return pre.response;

  const validated = validateForgotPasswordEmail({ email: pre.body.email });
  if (!validated.ok) {
    return apiError(validated.error, 400);
  }

  const emailLimited = guardAuthEmail(validated.email);
  if (emailLimited) return emailLimited;

  const mobile = wantsMobileSession(pre.body);
  const origin =
    typeof pre.body.origin === "string" && pre.body.origin.startsWith("http")
      ? pre.body.origin.replace(/\/$/, "")
      : process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";

  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: validated.email,
      options: {
        emailRedirectTo: signupEmailRedirectTo(origin, mobile),
      },
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("confirmation email") || msg.includes("error sending")) {
        return apiError(
          "Could not send the verification email. Try again in a few minutes.",
          400,
        );
      }
      return apiErrorSafe(error, 400, "Could not resend verification email.");
    }

    return apiSuccess("Verification email sent. Check your inbox.", {});
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not resend verification email.");
  }
}
