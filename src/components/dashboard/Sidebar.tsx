"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import Logo from "@/components/Logo";
import {
  dashboardNavItemIsActive,
  dashboardSecondaryNav,
  memberWorkspaceItems,
  staffWorkspaceItems,
  superadminNavItem,
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-nav-config";
import { createClient } from "@/lib/supabase/client";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";

type Item = DashboardNavItem;

function SidebarNavLinkBody({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span
      className={`flex w-full min-w-0 items-center gap-3 transition-opacity ${pending ? "opacity-60" : ""}`}
    >
      <span className={active ? "text-azure-500" : "text-ink-400 group-hover:text-ink-600"}>{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function SidebarNavLink({
  href,
  label,
  icon,
  active,
  onClose,
  onPrefetch,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onClose: () => void;
  onPrefetch: (path: string) => void;
}) {
  return (
    <Link
      href={href}
      prefetch
      scroll={false}
      onClick={onClose}
      onMouseEnter={() => onPrefetch(href)}
      onFocus={() => onPrefetch(href)}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-azure-50 text-azure-700" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
      }`}
    >
      <SidebarNavLinkBody active={active} icon={icon} label={label} />
    </Link>
  );
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Default least-privilege until we know is_admin (avoids flashing staff nav for members).
  const [workspaceItems, setWorkspaceItems] = useState<Item[]>(memberWorkspaceItems);

  const prefetchPath = useCallback((path: string) => {
    try {
      router.prefetch(path);
    } catch {
      /* noop */
    }
  }, [router]);

  useEffect(() => {
    const urls = [...workspaceItems.map((i) => i.href), ...dashboardSecondaryNav.map((i) => i.href)];
    for (const href of urls) {
      prefetchPath(href);
    }
  }, [workspaceItems, prefetchPath]);

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

  return (
    <>
      {open && (
        <button
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-[45] bg-ink-900/45 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[15.5rem] flex-col border-r border-ink-200/70 bg-white shadow-[4px_0_24px_-12px_rgba(15,23,42,0.12)] transition-transform supports-[backdrop-filter]:bg-white/95 lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-[13.75rem] lg:max-w-none lg:translate-x-0 lg:border-ink-200/55 lg:bg-white/72 lg:shadow-none xl:w-64 xl:backdrop-blur-xl xl:supports-[backdrop-filter]:bg-white/60 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-ink-100 px-5">
          <Logo height={34} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
            <span aria-hidden>{"// "}</span>
            workspace
          </p>
          <ul className="mt-2 space-y-1">
            {workspaceItems.map((item) => (
              <Fragment key={item.href}>
                {item.groupStart ? (
                  <li className="list-none pt-4 first:pt-1">
                    <p className="px-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
                      <span aria-hidden>{"// "}</span>
                      {item.groupStart}
                    </p>
                  </li>
                ) : null}
                <li>
                  <SidebarNavLink
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={dashboardNavItemIsActive(pathname, item.href)}
                    onClose={onClose}
                    onPrefetch={prefetchPath}
                  />
                </li>
              </Fragment>
            ))}
          </ul>

          <p className="mt-7 px-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
            <span aria-hidden>{"// "}</span>
            settings
          </p>
          <ul className="mt-2 space-y-1">
            {dashboardSecondaryNav.map((item) => (
              <li key={item.href}>
                <SidebarNavLink
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={dashboardNavItemIsActive(pathname, item.href)}
                  onClose={onClose}
                  onPrefetch={prefetchPath}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-ink-100 p-4">
          <Link
            href="/"
            prefetch
            scroll={false}
            onClick={onClose}
            onMouseEnter={() => prefetchPath("/")}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-600 hover:bg-ink-50"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18 9 12l6-6" />
            </svg>
            Back to site
          </Link>
        </div>
      </aside>
    </>
  );
}
