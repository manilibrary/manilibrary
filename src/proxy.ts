import { loadEnvConfig } from "@next/env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { MEMBER_LANDING_PATH, STAFF_LANDING_PATH } from "@/lib/auth-landing";

loadEnvConfig(process.cwd());

export async function proxy(request: NextRequest) {
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
