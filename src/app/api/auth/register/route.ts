import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

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
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 2) {
    return apiError("Full name is required.", 400);
  }
  if (!email.includes("@")) {
    return apiError("A valid email is required.", 400);
  }
  if (password.length < 6) {
    return apiError("Password must be at least 6 characters.", 400);
  }

  const mobile = wantsMobileSession(request, body);

  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          ...(phone ? { phone } : {}),
        },
      },
    });

    if (error) {
      return apiErrorSafe(error, 400, "Could not create account.");
    }
    if (!data.user) {
      return apiError("No user returned from sign up.", 500);
    }

    if (data.session && mobile) {
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
