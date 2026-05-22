"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { useActiveMembership } from "@/hooks/useActiveMembership";
import { MEMBER_MEMBERSHIP_PATH, STAFF_LANDING_PATH } from "@/lib/auth-landing";
import { prefetchMembershipPath } from "@/lib/membership/prefetch-membership";

const MEMBERSHIP_ENTRY = "/membership";

export default function HeroCTAs({ align = "center" }: { align?: "center" | "start" }) {
  const router = useRouter();
  const auth = useAuthSession();
  const { loading: memLoading, membership } = useActiveMembership();
  const pending = !auth.ready || memLoading;
  const signedIn = auth.signedIn;
  const isStaff = auth.isAdmin || auth.isSuperAdmin;
  const rowClass =
    align === "start"
      ? "flex flex-wrap items-center justify-center gap-3 lg:justify-start"
      : "flex flex-wrap items-center justify-center gap-3";

  const warmMembership = () => prefetchMembershipPath(router, MEMBERSHIP_ENTRY);

  const reserveHref =
    pending || signedIn
      ? MEMBERSHIP_ENTRY
      : `/login?next=${encodeURIComponent(MEMBERSHIP_ENTRY)}`;

  if (auth.ready && isStaff) {
    return (
      <div className={rowClass}>
        <Link
          href={STAFF_LANDING_PATH}
          className="inline-flex items-center gap-2 rounded-full bg-azure-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-azure-600"
        >
          Go to dashboard
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10h10m0 0-4-4m4 4-4 4" />
          </svg>
        </Link>
        <a
          href="#facilities"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
        >
          Explore facilities
        </a>
      </div>
    );
  }

  if (!pending && membership) {
    return (
      <div className={rowClass}>
        <Link
          href={MEMBER_MEMBERSHIP_PATH}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          View my membership
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10h10m0 0-4-4m4 4-4 4" />
          </svg>
        </Link>
        <Link
          href={MEMBERSHIP_ENTRY}
          onMouseEnter={warmMembership}
          onFocus={warmMembership}
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
        >
          Explore plans &amp; seats
        </Link>
      </div>
    );
  }

  return (
    <div className={rowClass}>
      <Link
        href={reserveHref}
        onMouseEnter={warmMembership}
        onFocus={warmMembership}
        className={`inline-flex items-center gap-2 rounded-full bg-azure-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-azure-600 ${
          pending ? "animate-pulse" : ""
        }`}
        aria-busy={pending}
      >
        Reserve your seat
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10h10m0 0-4-4m4 4-4 4" />
        </svg>
      </Link>
      <a
        href="#facilities"
        className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
      >
        Explore facilities
      </a>
    </div>
  );
}
