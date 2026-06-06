"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/components/auth/AuthSessionProvider";
import { useActiveMembership } from "@/hooks/useActiveMembership";
import { MEMBER_MEMBERSHIP_PATH, STAFF_LANDING_PATH } from "@/lib/auth-landing";

type Props = {
  planName: string;
  planCode: string;
  months: number;
  popular: boolean;
};

function planFlowHref(planCode: string, months: number): string {
  const params = new URLSearchParams({ code: planCode, months: String(months) });
  return `/membership/plan?${params.toString()}`;
}

export default function PlanChooseCTA({ planName, planCode, months, popular }: Props) {
  const router = useRouter();
  const auth = useAuthSession();
  const { loading: memLoading, membership } = useActiveMembership();
  const pending = !auth.ready || memLoading;
  const signedIn = auth.signedIn;
  const isStaff = auth.isAdmin || auth.isSuperAdmin;

  const baseClasses = popular
    ? "bg-azure-500 text-white hover:bg-azure-600"
    : "border border-ink-200 text-ink-800 hover:border-ink-300 hover:bg-ink-50";

  if (auth.ready && isStaff) {
    return (
      <Link
        href={STAFF_LANDING_PATH}
        className={`mt-7 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${baseClasses}`}
      >
        Go to dashboard
      </Link>
    );
  }

  if (membership && !pending) {
    return (
      <div className="mt-7 space-y-2">
        <Link
          href={MEMBER_MEMBERSHIP_PATH}
          className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          View my membership
        </Link>
        <p className="text-center text-[11px] text-ink-500">
          Payment is hidden while your plan is active.
        </p>
      </div>
    );
  }

  const flow = planFlowHref(planCode, months);
  const chooseHref = pending || signedIn ? flow : `/login?next=${encodeURIComponent(flow)}`;
  const warmChoose = () => router.prefetch(flow);

  return (
    <Link
      href={chooseHref}
      onMouseEnter={warmChoose}
      onFocus={warmChoose}
      aria-busy={pending}
      className={`mt-7 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${baseClasses} ${
        pending ? "animate-pulse opacity-90" : ""
      }`}
    >
      Choose {planName}
    </Link>
  );
}
