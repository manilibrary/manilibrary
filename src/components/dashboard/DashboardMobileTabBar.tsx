"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  dashboardNavItemIsActive,
  dashboardSecondaryNav,
  memberWorkspaceItems,
  staffWorkspaceItems,
  superadminNavItem,
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-nav-config";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";

function buildTabItems(
  workspace: DashboardNavItem[],
  secondary: DashboardNavItem[],
): DashboardNavItem[] {
  const merged = [...workspace];
  for (const s of secondary) {
    if (!merged.some((m) => m.href === s.href)) merged.push(s);
  }
  return merged;
}

/**
 * iOS-style bottom tab bar for phone / tablet (< lg). Desktop uses the mac-like sidebar.
 */
export default function DashboardMobileTabBar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [workspaceItems, setWorkspaceItems] = useState<DashboardNavItem[]>(memberWorkspaceItems);

  const prefetchPath = useCallback(
    (path: string) => {
      try {
        router.prefetch(path);
      } catch {
        /* noop */
      }
    },
    [router],
  );

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setWorkspaceItems(memberWorkspaceItems);
        return;
      }

      const navKey = ddcKey.profileNav(user.id);
      const cached = getClientCache<{ is_admin?: boolean | null; is_superadmin?: boolean | null }>(navKey);
      if (cached) {
        const isSuper = cached.is_superadmin === true;
        if (cached.is_admin) {
          const merged = [...staffWorkspaceItems];
          if (isSuper && !merged.some((i) => i.href === superadminNavItem.href)) {
            merged.push(superadminNavItem);
          }
          setWorkspaceItems(merged);
        } else if (isSuper) {
          setWorkspaceItems([...memberWorkspaceItems, superadminNavItem]);
        } else {
          setWorkspaceItems(memberWorkspaceItems);
        }
      }

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("is_admin, is_superadmin")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (profileErr) {
        setWorkspaceItems(memberWorkspaceItems);
        return;
      }

      setClientCache(
        navKey,
        { is_admin: profile?.is_admin ?? null, is_superadmin: profile?.is_superadmin ?? null },
        CLIENT_DATA_CACHE_TTL_MS,
      );

      const isSuper = profile?.is_superadmin === true;
      if (profile?.is_admin) {
        const merged = [...staffWorkspaceItems];
        if (isSuper && !merged.some((i) => i.href === superadminNavItem.href)) {
          merged.push(superadminNavItem);
        }
        setWorkspaceItems(merged);
      } else if (isSuper) {
        setWorkspaceItems([...memberWorkspaceItems, superadminNavItem]);
      } else {
        setWorkspaceItems(memberWorkspaceItems);
      }
    };

    void load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const tabs = useMemo(
    () => buildTabItems(workspaceItems, dashboardSecondaryNav),
    [workspaceItems],
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-200/70 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/78 lg:hidden"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom, 0px))" }}
      aria-label="Primary"
    >
      <div
        className="flex max-w-full items-stretch justify-around gap-0.5 overflow-x-auto px-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
      >
        {tabs.map((item) => {
          const active = dashboardNavItemIsActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              scroll={false}
              role="tab"
              aria-selected={active}
              onMouseEnter={() => prefetchPath(item.href)}
              onFocus={() => prefetchPath(item.href)}
              className={`flex min-w-[3.25rem] max-w-[5.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-center transition-colors active:opacity-80 ${
                active ? "text-azure-600" : "text-ink-500 hover:text-ink-800"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-[22px] [&>svg]:w-[22px] ${
                  active ? "text-azure-600" : "text-ink-400"
                }`}
              >
                {item.icon}
              </span>
              <span className="line-clamp-2 w-full px-0.5 text-[10px] font-semibold leading-tight tracking-tight sm:text-[11px]">
                {item.label}
              </span>
              {active ? (
                <span className="h-0.5 w-5 shrink-0 rounded-full bg-azure-500" aria-hidden />
              ) : (
                <span className="h-0.5 w-5 shrink-0" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
