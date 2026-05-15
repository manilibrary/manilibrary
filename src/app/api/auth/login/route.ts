import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { displayPersonName } from "@/lib/format-person-name";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { guardAuthEmail, guardPublicAuthPost } from "@/lib/security/request-guards";
import { validateLoginFields } from "@/lib/security/validate-fields";

export const runtime = "nodejs";

function wantsMobileSession(request: Request, body: Record<string, unknown>) {
  if (body.client === "expo") return true;
  if (request.headers.get("x-app-client")?.toLowerCase() === "expo") return true;
  return false;
}

function loginEmailFromBody(body: Record<string, unknown>) {
  const e = typeof body.email === "string" ? body.email.trim() : "";
  if (e) return e;
  return typeof body.emailOrPhone === "string" ? body.emailOrPhone.trim() : "";
}

function passwordFromBody(body: Record<string, unknown>) {
  const p = typeof body.password === "string" ? body.password : "";
  if (p) return p;
  return typeof body.passwordOrOtp === "string" ? body.passwordOrOtp : "";
}

/**
 * Email/password login.
 * - **Browser / Postman (default):** sets Supabase cookies; JSON returns minimal `user`.
 * - **Expo:** pass `"client":"expo"` (or header `X-App-Client: expo`) to receive `token` + `user` + `session`
 *   for `Authorization: Bearer` on other `/api` routes.
 */
export async function POST(request: Request) {
  const pre = await guardPublicAuthPost(request);
  if (!pre.ok) return pre.response;

  const body = pre.body;
  const validated = validateLoginFields({
    email: loginEmailFromBody(body),
    password: passwordFromBody(body),
  });
  if (!validated.ok) {
    return apiError(validated.error, 400);
  }

  const emailLimited = guardAuthEmail(validated.email);
  if (emailLimited) return emailLimited;

  const { email, password } = validated;
  const mobile = wantsMobileSession(request, body);

  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return apiErrorSafe(error, 401, "Invalid email or password.");
    }
    if (!data.session) {
      return apiError(
        "No session returned. If email confirmation is required in Supabase, confirm the email first or disable confirmation for testing.",
        401,
      );
    }

    const authedEmail = (data.user.email ?? "").trim().toLowerCase();
    if (authedEmail !== email) {
      await supabase.auth.signOut();
      return apiError("Sign-in email did not match the authenticated account. Please try again.", 401);
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("full_name, phone, email, is_admin, is_superadmin")
      .eq("user_id", data.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (profErr) {
      await supabase.auth.signOut();
      return apiErrorSafe(profErr, 500);
    }
    if (!profile) {
      await supabase.auth.signOut();
      return apiError(
        "We could not find a library member profile for this account. Please contact the library so your login can be linked, then try again.",
        403,
      );
    }

    const isStaff = profile.is_admin === true || profile.is_superadmin === true;
    const role = isStaff ? "admin" : "student";
    const userPayload = {
      id: data.user.id,
      role,
      name: displayPersonName(profile.full_name as string, "Member"),
      email: (profile.email as string | null) ?? data.user.email ?? email,
      phone: (profile.phone as string | null) ?? undefined,
    };

    if (mobile) {
      const s = data.session;
      return apiSuccess("Login successful.", {
        token: s.access_token,
        user: userPayload,
        session: {
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_at: s.expires_at,
          expires_in: s.expires_in,
          token_type: s.token_type,
        },
      });
    }

    return apiSuccess("Login successful.", {
      user: { id: data.user.id, email: data.user.email ?? email },
    });
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not complete sign in.");
  }
}
