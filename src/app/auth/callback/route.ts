import { loadEnvConfig } from "@next/env";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

loadEnvConfig(process.cwd());

/** Only same-origin relative paths; blocks open redirects like `//evil.com`. */
function safeInternalNextPath(raw: string | null, fallback: string): string {
  if (raw == null) return fallback;
  const s = raw.trim();
  if (!s.startsWith("/") || s.startsWith("//")) return fallback;
  if (s.includes("\\") || s.includes("\0")) return fallback;
  return s;
}

/**
 * Finishes Supabase email flows (password recovery PKCE `code`, or `token_hash` links)
 * and sets session cookies on the redirect response.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const fail = (message: string) =>
    NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(message)}`, url.origin),
    );

  if (!supabaseUrl || !supabaseAnonKey) {
    return fail("Server is missing Supabase configuration.");
  }

  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next");
  const nextPath = safeInternalNextPath(
    nextParam,
    "/auth/update-password",
  );
  const destination = new URL(nextPath, url.origin);

  let response = NextResponse.redirect(destination);
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return response;
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (error) return fail(error.message);
    return response;
  }

  return fail("Invalid or expired reset link. Request a new email from Forgot password.");
}
