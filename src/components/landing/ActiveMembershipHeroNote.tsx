"use client";

import Link from "next/link";

import { formatMembershipWindow, useActiveMembership } from "@/hooks/useActiveMembership";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";

export default function ActiveMembershipHeroNote() {
  const { loading, membership } = useActiveMembership();
  if (loading || !membership) return null;

  const plan = membership.plan_kind === "short_term" ? "Short-term" : "Long-term";

  return (
    <div
      className="mx-auto mt-6 max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50/85 px-5 py-3 text-left text-sm shadow-sm"
      role="status"
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">
        You&apos;re already a member
      </p>
      <p className="mt-1 text-emerald-900">
        <span className="font-semibold">{plan}</span> · Seat{" "}
        <span className="font-mono">
          {resolveMemberSeatDisplayLabel({
            plan_kind: membership.plan_kind,
            seat_number: membership.seat_number,
            seat_label: membership.seat_label,
          })}
        </span>
      </p>
      <p className="mt-1 font-mono text-[11px] text-emerald-800/80">
        {formatMembershipWindow(membership)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={MEMBER_MEMBERSHIP_PATH}
          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          Your membership
        </Link>
        <Link
          href="/membership"
          className="rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          Browse plans &amp; seats
        </Link>
      </div>
    </div>
  );
}
