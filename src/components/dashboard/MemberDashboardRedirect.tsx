"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MEMBER_LANDING_PATH } from "@/lib/auth-landing";

/**
 * Library members (non-admin) should not use the staff overview at `/dashboard`;
 * send them to the member landing page (also enforced in `proxy.ts`).
 */
export default function MemberDashboardRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/dashboard") return;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (profile && !profile.is_admin) {
        router.replace(MEMBER_LANDING_PATH);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
