"use client";

import Link from "next/link";

import { formatMembershipWindow, useActiveMembership } from "@/hooks/useActiveMembership";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";

export default function MembershipHubGreeting() {
  const { loading, membership, error } = useActiveMembership();

  if (loading) return null;

  if (error) {
    return (
      <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700">
          We couldn&apos;t verify your membership
        </p>
        <p className="mt-1">{error}</p>
        <p className="mt-1 text-xs">
          You can still browse the seat maps; checkout will verify before charging.
        </p>
      </div>
    );
  }

  if (!membership) return null;

  const plan = membership.plan_kind === "short_term" ? "Short-term" : "Long-term";

  return (
    <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/85 px-5 py-4 text-sm shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">
        You&apos;re already a member — feel free to explore
      </p>
      <p className="mt-1 text-emerald-900">
        <span className="font-semibold">{plan}</span> · Seat{" "}
        <span className="font-mono">
          {resolveMemberSeatDisplayLabel({
            plan_kind: membership.plan_kind,
            seat_number: membership.seat_number,
          })}
        </span>{" "}
        <span className="font-mono text-[11px] text-emerald-800/80">
          {formatMembershipWindow(membership)}
        </span>
      </p>
      <p className="mt-2 text-emerald-900/80">
        Open a hall below to see which seats are free. Payment and checkout stay hidden until your current plan ends or
        an admin closes it.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={MEMBER_MEMBERSHIP_PATH}
          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          View my membership
        </Link>
      </div>
    </div>
  );
}
