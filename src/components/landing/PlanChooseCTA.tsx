"use client";

import Link from "next/link";

import { useActiveMembership } from "@/hooks/useActiveMembership";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";
import { seatPreviewPathForMarketingPlanId } from "@/lib/membership/marketing-plan-seat-preview";

type Props = {
  planName: string;
  planId: string;
  popular: boolean;
};

function membershipHubHref(planId: string): string {
  if (planId === "row-hall" || planId === "half-day") return "/membership?focus=row";
  return "/membership?focus=main";
}

export default function PlanChooseCTA({ planName, planId, popular }: Props) {
  const { loading, membership, signedIn } = useActiveMembership();

  const baseClasses = popular
    ? "bg-azure-500 text-white hover:bg-azure-600"
    : "border border-ink-200 text-ink-800 hover:border-ink-300 hover:bg-ink-50";

  if (loading) {
    return (
      <span
        className={`mt-7 block h-[42px] w-full max-w-[14rem] animate-pulse rounded-full ${baseClasses} opacity-70`}
        aria-label="Checking membership"
      />
    );
  }

  if (membership) {
    const seatHref = seatPreviewPathForMarketingPlanId(planId);
    return (
      <div className="mt-7 space-y-2">
        <Link
          href={seatHref}
          className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          View available seats
        </Link>
        <p className="text-center text-[11px] text-ink-500">
          Opens the live hall map (empty vs taken). Payment is hidden while your plan is active.
        </p>
        <Link
          href={MEMBER_MEMBERSHIP_PATH}
          className="block text-center text-[11px] font-medium text-azure-600 hover:text-azure-700"
        >
          Membership details →
        </Link>
      </div>
    );
  }

  const hub = membershipHubHref(planId);
  const chooseHref = signedIn ? hub : `/login?next=${encodeURIComponent(hub)}`;

  return (
    <Link
      href={chooseHref}
      className={`mt-7 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${baseClasses}`}
    >
      Choose {planName}
    </Link>
  );
}
