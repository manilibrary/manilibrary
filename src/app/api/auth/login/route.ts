import { apiError, apiSuccess } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";

/**
 * Email/password login for tools like Postman.
 * Sets Supabase session cookies on the response (same as /login in the browser).
 */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return apiError("email and password are required.", 400);
  }

  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return apiError(error.message, 401);
    }
    if (!data.session) {
      return apiError(
        "No session returned. If email confirmation is required in Supabase, confirm the email first or disable confirmation for testing.",
        401,
      );
    }

    return apiSuccess("Login successful.", {
      user: { id: data.user.id, email: data.user.email ?? email },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error.";
    return apiError(msg, 503);
  }
}
