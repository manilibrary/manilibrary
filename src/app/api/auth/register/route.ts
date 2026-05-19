import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { guardAuthEmail, guardPublicAuthPost } from "@/lib/security/request-guards";
import { validateRegisterFields } from "@/lib/security/validate-fields";

export const runtime = "nodejs";

function wantsMobileSession(request: Request, body: Record<string, unknown>) {
  if (body.client === "expo") return true;
  if (request.headers.get("x-app-client")?.toLowerCase() === "expo") return true;
  return false;
}

/**
 * Member sign-up (same as web /register): creates Auth user + profile via trigger.
 * For Expo, pass `"client":"expo"` to receive session tokens when email confirmation is off.
 */
export async function POST(request: Request) {
  const pre = await guardPublicAuthPost(request);
  if (!pre.ok) return pre.response;

  const body = pre.body;
  const validated = validateRegisterFields({
    name: body.name,
    email: body.email,
    phone: body.phone,
    password: body.password,
  });
  if (!validated.ok) {
    return apiError(validated.error, 400);
  }

  const { name, email, phone, password } = validated;
  const emailLimited = guardAuthEmail(email);
  if (emailLimited) return emailLimited;

  const mobile = wantsMobileSession(request, body);

  const origin =
    typeof body.origin === "string" && body.origin.startsWith("http")
      ? body.origin.replace(/\/$/, "")
      : process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";

  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: origin ? `${origin}/auth/callback?flow=signup&next=${encodeURIComponent("/login")}` : undefined,
        data: {
          full_name: name,
          ...(phone ? { phone } : {}),
        },
      },
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("confirmation email") || msg.includes("error sending")) {
        return apiError(
          "Could not send the verification email. In Supabase: Authentication → SMTP — use a Gmail App Password (not your normal password), then save and try again.",
          400,
        );
      }
      return apiErrorSafe(error, 400, "Could not create account.");
    }
    if (!data.user) {
      return apiError("No user returned from sign up.", 500);
    }

    const createdEmail = (data.user.email ?? "").trim().toLowerCase();
    if (createdEmail !== email) {
      await supabase.auth.signOut();
      return apiError("Account email mismatch. Please try again.", 400);
    }

    if (data.session && mobile) {
      const { data: profileRow, error: profErr } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", data.user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (profErr || !profileRow) {
        await supabase.auth.signOut();
        return apiError(
          "Your sign-up did not finish linking a library profile (required for this app). Ask staff to check the database trigger, or try again in a moment.",
          503,
        );
      }

      const s = data.session;
      return apiSuccess("Account created.", {
        needsEmailConfirmation: false,
        token: s.access_token,
        user: {
          id: data.user.id,
          role: "student",
          name,
          email,
          phone: phone || undefined,
        },
        session: {
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_at: s.expires_at,
          expires_in: s.expires_in,
          token_type: s.token_type,
        },
      });
    }

    return apiSuccess(
      data.session ? "Account created. You are signed in." : "Check your email to confirm, then sign in.",
      {
        needsEmailConfirmation: !data.session,
        user_id: data.user.id,
      },
    );
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not complete sign up.");
  }
}
