"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
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

const items: Item[] = [
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
];

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

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <>
      {open && (
        <button
          aria-label="Close sidebar"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden"
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
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-azure-50 text-azure-700"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  <span
                    className={
                      isActive(item.href) ? "text-azure-500" : "text-ink-400 group-hover:text-ink-600"
                    }
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-7 px-3 font-mono text-[10px] uppercase tracking-widest text-ink-400">
            // settings
          </p>
          <ul className="mt-2 space-y-1">
            {secondary.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-azure-50 text-azure-700"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  <span
                    className={
                      isActive(item.href) ? "text-azure-500" : "text-ink-400 group-hover:text-ink-600"
                    }
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-ink-100 p-4">
          <Link
            href="/"
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
