import { loadEnvConfig } from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MEMBER_LANDING_PATH, STAFF_LANDING_PATH } from "@/lib/auth-landing";
import { JSON_BODY_MAX_BYTES } from "@/lib/security/field-limits";
import { applyRateLimit, getClientIp } from "@/lib/security/request-guards";
import { RATE_WINDOWS } from "@/lib/security/rate-limit";
import { applySecurityHeaders } from "@/lib/security/security-headers";

loadEnvConfig(process.cwd());

const AUTH_API_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
]);

function guardApiRequest(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  if (method === "POST" || method === "PATCH" || method === "PUT") {
    const contentType = request.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    if (isJson) {
      const contentLength = request.headers.get("content-length");
      if (contentLength) {
        const n = Number.parseInt(contentLength, 10);
        if (Number.isFinite(n) && n > JSON_BODY_MAX_BYTES) {
          return NextResponse.json(
            { ok: false, error: "Request body too large.", message: "Request body too large." },
            { status: 413 },
          );
        }
      }
    }
  }

  if (!path.startsWith("/api/")) {
    return null;
  }

  const ip = getClientIp(request);
  if (AUTH_API_PATHS.has(path)) {
    const limited = applyRateLimit(
      `auth:ip:${ip}`,
      RATE_WINDOWS.authIp.limit,
      RATE_WINDOWS.authIp.windowMs,
    );
    if (limited) return limited;
    return null;
  }

  if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
    const limited = applyRateLimit(
      `api:ip:${ip}`,
      RATE_WINDOWS.apiIp.limit,
      RATE_WINDOWS.apiIp.windowMs,
    );
    if (limited) return limited;
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const blocked = guardApiRequest(request);
  if (blocked) {
    return applySecurityHeaders(blocked);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — add them to `.env` or `.env.local` in the manilibrary folder and restart `npm run dev`.",
      );
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isStaff = false;
  let isSuper = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_superadmin")
      .eq("user_id", user.id)
      .maybeSingle();
    isStaff = profile?.is_admin === true;
    isSuper = profile?.is_superadmin === true;
  }

  const path = request.nextUrl.pathname;

  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = isStaff ? STAFF_LANDING_PATH : MEMBER_LANDING_PATH;
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/dashboard") && !isStaff) {
    const superAllowed =
      isSuper && (path === "/dashboard/superadmin" || path.startsWith("/dashboard/superadmin/"));
    const memberAllowed =
      path === "/dashboard/me" ||
      path.startsWith("/dashboard/me/") ||
      path === "/dashboard/settings" ||
      path.startsWith("/dashboard/settings/") ||
      superAllowed;
    if (!memberAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = MEMBER_LANDING_PATH;
      return NextResponse.redirect(url);
    }
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
