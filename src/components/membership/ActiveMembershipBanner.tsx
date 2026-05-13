"use client";

import Link from "next/link";

import { formatDateDdMmYyyy } from "@/lib/date-format";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";

export type ActiveMembership = {
  id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

function formatWindow(m: ActiveMembership): string {
  if (m.plan_kind === "short_term" && m.starts_at && m.ends_at) {
    return `${formatDateDdMmYyyy(m.starts_at)} → ${formatDateDdMmYyyy(m.ends_at)}`;
  }
  if (m.plan_kind === "long_term" && m.valid_from && m.valid_until) {
    return `${formatDateDdMmYyyy(m.valid_from)} → ${formatDateDdMmYyyy(m.valid_until)}`;
  }
  return "—";
}

export default function ActiveMembershipBanner({ membership }: { membership: ActiveMembership }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 px-5 py-4 text-sm shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">
        Thanks for being a member — feel free to explore
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-emerald-900">
          <span className="font-semibold capitalize">
            {membership.plan_kind.replace(/_/g, " ")}
          </span>
          {" · "}
          Seat{" "}
          <span className="font-mono">
            {resolveMemberSeatDisplayLabel({
              plan_kind: membership.plan_kind,
              seat_number: membership.seat_number,
            })}
          </span>
          {" · "}
          <span className="text-xs">{formatWindow(membership)}</span>
        </div>
        <Link
          href={MEMBER_MEMBERSHIP_PATH}
          className="self-start rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 sm:self-auto"
        >
          View my membership
        </Link>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-emerald-900/80">
        You can keep browsing layouts and future plans here. A new booking will be available once
        your current plan ends, or if an admin changes your seat for you.
      </p>
    </div>
  );
}
