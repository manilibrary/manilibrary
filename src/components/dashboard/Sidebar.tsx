"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";

type Item = {
  href: string;
  label: string;
  icon: ReactNode;
  /** When set, a small section label is shown above this link (member nav). */
  groupStart?: string;
};

const ICON = {
  className: "h-[18px] w-[18px]",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

const staffWorkspaceItems: Item[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg {...ICON}>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/members",
    label: "Members",
    icon: (
      <svg {...ICON}>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15.5 14.5A4.5 4.5 0 0 1 22 18" />
      </svg>
    ),
  },
  {
    href: "/dashboard/payments",
    label: "Payments",
    icon: (
      <svg {...ICON}>
        <rect x="2.5" y="6" width="19" height="13" rx="2" />
        <path d="M2.5 10h19M6 15h3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/subscriptions",
    label: "Subscriptions",
    icon: (
      <svg {...ICON}>
        <path d="M3 12a9 9 0 0 1 16-5.7" />
        <path d="M19 4v3h-3" />
        <path d="M21 12a9 9 0 0 1-16 5.7" />
        <path d="M5 20v-3h3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/attendance",
    label: "Attendance",
    icon: (
      <svg {...ICON}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
];

const memberWorkspaceItems: Item[] = [
  {
    groupStart: "member",
    href: "/dashboard/me/membership",
    label: "Your account",
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    href: "/dashboard/me/my-membership",
    label: "My membership",
    icon: (
      <svg {...ICON}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/me/attendance",
    label: "Attendance",
    icon: (
      <svg {...ICON}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
];

const superadminNavItem: Item = {
  href: "/dashboard/superadmin",
  label: "Superadmin",
  icon: (
    <svg {...ICON}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

const secondary: Item[] = [
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    ),
  },
];

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
    const urls = [...workspaceItems.map((i) => i.href), ...secondary.map((i) => i.href)];
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

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    if (href === "/dashboard/me/membership") {
      return pathname === href || pathname === "/dashboard/me";
    }
    if (href === "/dashboard/me/my-membership") {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {open && (
        <button
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink-900/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-100 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center border-b border-ink-100 px-5">
          <Logo height={34} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
            // workspace
          </p>
          <ul className="mt-2 space-y-1">
            {workspaceItems.map((item) => (
              <Fragment key={item.href}>
                {item.groupStart ? (
                  <li className="list-none pt-4 first:pt-1">
                    <p className="px-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
                      // {item.groupStart}
                    </p>
                  </li>
                ) : null}
                <li>
                  <SidebarNavLink
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isActive(item.href)}
                    onClose={onClose}
                    onPrefetch={prefetchPath}
                  />
                </li>
              </Fragment>
            ))}
          </ul>

          <p className="mt-7 px-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
            // settings
          </p>
          <ul className="mt-2 space-y-1">
            {secondary.map((item) => (
              <li key={item.href}>
                <SidebarNavLink
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(item.href)}
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
