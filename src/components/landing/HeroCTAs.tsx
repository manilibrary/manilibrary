"use client";

import Link from "next/link";

import { useActiveMembership } from "@/hooks/useActiveMembership";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";

export default function HeroCTAs() {
  const { loading, membership } = useActiveMembership();

  if (loading) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span
          className="inline-flex h-[46px] w-[200px] animate-pulse items-center justify-center rounded-full bg-azure-100/70 text-sm font-semibold text-azure-500"
          aria-label="Loading membership status"
        />
        <span
          className="inline-flex h-[46px] w-[180px] animate-pulse items-center justify-center rounded-full border border-ink-100 bg-white text-sm font-semibold text-ink-300"
          aria-hidden
        >
          Explore facilities
        </span>
      </div>
    );
  }

  if (membership) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
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
          href="/membership"
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
        >
          Explore plans &amp; seats
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link
        href="/membership"
        className="inline-flex items-center gap-2 rounded-full bg-azure-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-azure-600"
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
