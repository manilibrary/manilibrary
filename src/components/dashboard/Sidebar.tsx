"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Logo from "@/components/Logo";
import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { prefetchAdminOverviewCache } from "@/lib/client/fetch-admin-overview";
import {
  dashboardNavItemIsActive,
  dashboardSecondaryNav,
  memberWorkspaceItems,
  staffWorkspaceItems,
  superadminNavItem,
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-nav-config";

type Item = DashboardNavItem;

function isMemberDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard/me" || pathname.startsWith("/dashboard/me/");
}

function resolveWorkspaceItems(
  pathname: string,
  session: { ready: boolean; signedIn: boolean; isAdmin: boolean; isSuperAdmin: boolean },
): Item[] {
  if (!session.ready) {
    return isMemberDashboardPath(pathname) ? memberWorkspaceItems : staffWorkspaceItems;
  }
  if (!session.signedIn) return memberWorkspaceItems;
  if (session.isAdmin) {
    const merged = [...staffWorkspaceItems];
    if (session.isSuperAdmin && !merged.some((i) => i.href === superadminNavItem.href)) {
      merged.push(superadminNavItem);
    }
    return merged;
  }
  if (session.isSuperAdmin) return [...memberWorkspaceItems, superadminNavItem];
  return memberWorkspaceItems;
}

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
  const session = useAuthSession();

  const workspaceItems = useMemo(
    () => resolveWorkspaceItems(pathname, session),
    [pathname, session.ready, session.signedIn, session.isAdmin, session.isSuperAdmin],
  );

  const prefetchPath = useCallback((path: string) => {
    try {
      router.prefetch(path);
    } catch {
      /* noop */
    }
    if (path === "/dashboard" && session.isAdmin) {
      prefetchAdminOverviewCache();
    }
  }, [router, session.isAdmin]);

  useEffect(() => {
    const urls = [...workspaceItems.map((i) => i.href), ...dashboardSecondaryNav.map((i) => i.href)];
    for (const href of urls) {
      prefetchPath(href);
    }
  }, [workspaceItems, prefetchPath]);

  useEffect(() => {
    if (session.ready && session.isAdmin) {
      prefetchAdminOverviewCache();
    }
  }, [session.ready, session.isAdmin]);

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
        className={`fixed inset-y-0 left-0 z-50 flex w-[15.5rem] shrink-0 flex-col border-r border-ink-200/70 bg-white shadow-[4px_0_24px_-12px_rgba(15,23,42,0.12)] transition-transform supports-[backdrop-filter]:bg-white/95 lg:sticky lg:top-0 lg:z-10 lg:h-screen lg:w-64 lg:max-w-none lg:translate-x-0 lg:border-ink-200/55 lg:bg-white/72 lg:shadow-none lg:backdrop-blur-xl lg:supports-[backdrop-filter]:bg-white/60 ${
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
