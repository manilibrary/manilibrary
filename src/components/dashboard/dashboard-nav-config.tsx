import type { ReactNode } from "react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** When set, a small section label is shown above this link (member nav). */
  groupStart?: string;
};

export const DASHBOARD_NAV_ICON = {
  className: "h-[18px] w-[18px]",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const staffWorkspaceItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg {...DASHBOARD_NAV_ICON}>
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
      <svg {...DASHBOARD_NAV_ICON}>
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
      <svg {...DASHBOARD_NAV_ICON}>
        <rect x="2.5" y="6" width="19" height="13" rx="2" />
        <path d="M2.5 10h19M6 15h3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/subscriptions",
    label: "Subscriptions",
    icon: (
      <svg {...DASHBOARD_NAV_ICON}>
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
      <svg {...DASHBOARD_NAV_ICON}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
];

export const memberWorkspaceItems: DashboardNavItem[] = [
  {
    groupStart: "member",
    href: "/dashboard/me/membership",
    label: "Your account",
    icon: (
      <svg {...DASHBOARD_NAV_ICON}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    href: "/dashboard/me/my-membership",
    label: "My membership",
    icon: (
      <svg {...DASHBOARD_NAV_ICON}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/me/transactions",
    label: "Transactions",
    icon: (
      <svg {...DASHBOARD_NAV_ICON}>
        <rect x="2.5" y="6" width="19" height="13" rx="2" />
        <path d="M2.5 10h19M6 15h3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/me/attendance",
    label: "Attendance",
    icon: (
      <svg {...DASHBOARD_NAV_ICON}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
];

export const superadminNavItem: DashboardNavItem = {
  href: "/dashboard/superadmin",
  label: "Superadmin",
  icon: (
    <svg {...DASHBOARD_NAV_ICON}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

export const dashboardSecondaryNav: DashboardNavItem[] = [
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: (
      <svg {...DASHBOARD_NAV_ICON}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    ),
  },
];

/** Same rules as dashboard sidebar active state. */
export function dashboardNavItemIsActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  if (href === "/dashboard/me/membership") {
    return pathname === href || pathname === "/dashboard/me";
  }
  if (href === "/dashboard/me/my-membership") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/dashboard/me/transactions") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
