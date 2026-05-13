import Link from "next/link";

import { formatDateDdMmYyyy } from "@/lib/date-format";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";

export { formatMemberSeatLabel, resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";

export type MemberActivePlanRow = {
  id: string;
  plan_kind: string;
  status: string;
  /** Text token F(n)/S(n) in DB after migration; may still be a number from older cached rows. */
  seat_number: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
};

/** Validity range for tables and cards (dd/mm/yyyy → dd/mm/yyyy). */
export function formatMemberPlanWindow(m: MemberActivePlanRow): string {
  if (m.plan_kind === "short_term" && m.starts_at && m.ends_at) {
    return `${formatDateDdMmYyyy(m.starts_at)} → ${formatDateDdMmYyyy(m.ends_at)}`;
  }
  if (m.plan_kind === "long_term" && m.valid_from && m.valid_until) {
    return `${formatDateDdMmYyyy(m.valid_from)} → ${formatDateDdMmYyyy(m.valid_until)}`;
  }
  return "—";
}

/** Calendar days from start of today to end date (local). Negative if already ended. */
export function memberMembershipDaysLeft(m: MemberActivePlanRow): number | null {
  const endRaw = m.plan_kind === "short_term" ? m.ends_at : m.valid_until;
  if (!endRaw) return null;
  const end = new Date(endRaw.includes("T") ? endRaw : `${endRaw.trim()}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((endDay.getTime() - startOfToday.getTime()) / 86400000);
}

export function memberMembershipDaysLeftLabel(m: MemberActivePlanRow): string | null {
  const days = memberMembershipDaysLeft(m);
  if (days === null) return null;
  if (days < 0) return "Ended";
  if (days === 0) return "Last day today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

/** True when the plan's end date is before today (still may be `active` in the database). */
export function memberMembershipValidityEndedByDate(m: MemberActivePlanRow): boolean {
  const days = memberMembershipDaysLeft(m);
  return days !== null && days < 0;
}

/** Status for badges: date-ended memberships count as expired even if the row is still `active`. */
export function memberMembershipEffectiveStatus(m: MemberActivePlanRow): string {
  if (memberMembershipValidityEndedByDate(m)) return "expired";
  return m.status.toLowerCase();
}

/** End of validity (local end-of-day), for sorting. Missing dates sort as 0. */
export function memberMembershipEndMs(m: MemberActivePlanRow): number {
  const endRaw = m.plan_kind === "short_term" ? m.ends_at : m.valid_until;
  if (!endRaw) return 0;
  const end = new Date(endRaw.includes("T") ? endRaw : `${endRaw.trim()}T23:59:59`);
  const t = end.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function memberPlanLabel(kind: string): string {
  return kind === "short_term" ? "Short-term" : "Long-term";
}

/** Table / inline status text colour */
export function membershipStatusTextClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "text-emerald-800";
  if (s === "expired") return "text-ink-600";
  if (s === "cancelled") return "text-ink-600";
  if (s === "pending_payment") return "text-amber-800";
  return "text-ink-800";
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active") return "bg-emerald-100 text-emerald-900 ring-emerald-200/80";
  if (s === "expired") return "bg-ink-100 text-ink-700 ring-ink-200/60";
  if (s === "cancelled") return "bg-ink-100 text-ink-700 ring-ink-200/60";
  if (s === "pending_payment") return "bg-amber-100 text-amber-900 ring-amber-200/80";
  return "bg-ink-100 text-ink-800 ring-ink-200/60";
}

function ActiveMembershipCardContent({
  m,
  pad,
  plClass,
  compactScroll,
  showViewPlansLink,
  seatToneClass,
}: {
  m: MemberActivePlanRow;
  pad: string;
  plClass: string;
  compactScroll: boolean;
  showViewPlansLink: boolean;
  seatToneClass: string;
}) {
  const days = memberMembershipDaysLeft(m);
  const daysLabel = memberMembershipDaysLeftLabel(m);
  const effectiveStatus = memberMembershipEffectiveStatus(m);
  const seatClass = compactScroll
    ? `font-mono text-lg font-bold tracking-tight sm:text-xl ${seatToneClass}`
    : `font-mono text-xl font-bold tracking-tight sm:text-2xl md:text-3xl ${seatToneClass}`;

  return (
    <div className={`${pad} ${plClass}`}>
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            {memberPlanLabel(m.plan_kind)}
          </p>
          <p className={seatClass} title="F = long-term seat, S = short-term seat">
            {resolveMemberSeatDisplayLabel({
              plan_kind: m.plan_kind,
              seat_number: m.seat_number,
            })}
          </p>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-500 sm:text-[10px]">Valid window</p>
            <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink-800 sm:text-xs">
              {formatMemberPlanWindow(m)}
            </p>
          </div>
          {daysLabel != null ? (
            <p
              className={`text-[10px] font-semibold sm:text-xs ${
                days !== null && days <= 7 && days >= 0
                  ? "text-amber-800"
                  : days !== null && days < 0
                    ? "text-ink-500"
                    : "text-ink-700"
              }`}
            >
              {daysLabel}
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 sm:px-3 sm:text-[11px] ${statusBadgeClass(effectiveStatus)}`}
        >
          {effectiveStatus.replace(/_/g, " ")}
        </span>
      </div>
      {showViewPlansLink ? (
        <Link
          href="/#plans"
          className="mt-3 inline-flex text-xs font-medium text-azure-700 underline-offset-2 hover:text-azure-800 hover:underline sm:text-sm"
        >
          View membership plans →
        </Link>
      ) : null}
    </div>
  );
}

/** `scroll` = single horizontal row with overflow-x on narrow screens (account strip). `wrap` = flex-wrap for wider layouts. */
export type MemberActiveCardsRowMode = "wrap" | "scroll";

export type MemberActiveCardsVariant = "current" | "past";

type Props = {
  plans: MemberActivePlanRow[];
  /** Tighter padding for profile / account strip */
  compact?: boolean;
  showViewPlansLink?: boolean;
  className?: string;
  rowMode?: MemberActiveCardsRowMode;
  /** `past` uses muted gray shells for ended / historical memberships */
  variant?: MemberActiveCardsVariant;
};

export function MemberActiveMembershipCards({
  plans,
  compact = false,
  showViewPlansLink = true,
  className = "",
  rowMode = "wrap",
  variant = "current",
}: Props) {
  if (plans.length === 0) return null;

  const pad = compact ? "p-3.5 sm:p-4" : "p-5 sm:p-6";
  const isScroll = rowMode === "scroll";
  const singlePlan = plans.length === 1;
  const isPast = variant === "past";

  const listClass = isScroll
    ? singlePlan
      ? "flex flex-row flex-nowrap items-stretch gap-3"
      : "flex flex-row flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain scroll-pl-1 scroll-pr-1 pb-2 pt-0.5 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory [scrollbar-width:thin]"
    : "flex flex-row flex-wrap items-stretch gap-4";

  const itemClass = isPast
    ? isScroll
      ? singlePlan
        ? "group relative min-w-0 w-full shrink-0 self-stretch overflow-hidden rounded-2xl border border-ink-300/70 bg-gradient-to-br from-ink-200/90 via-ink-100/95 to-ink-300/60 shadow-sm ring-1 ring-ink-300/40 transition-shadow hover:shadow-md"
        : "group relative w-[min(18.5rem,calc(100vw-2.25rem))] shrink-0 snap-start overflow-hidden rounded-2xl border border-ink-300/70 bg-gradient-to-br from-ink-200/90 via-ink-100/95 to-ink-300/60 shadow-sm ring-1 ring-ink-300/40 transition-shadow hover:shadow-md sm:w-72"
      : "group relative min-h-[1px] min-w-0 flex-1 basis-[min(100%,17.5rem)] overflow-hidden rounded-2xl border border-ink-300/70 bg-gradient-to-br from-ink-200/90 via-ink-100/95 to-ink-300/60 shadow-sm ring-1 ring-ink-300/40 transition-shadow hover:shadow-md sm:max-w-md sm:basis-[clamp(14rem,42%,22rem)] lg:max-w-none lg:basis-0 lg:grow"
    : isScroll
      ? singlePlan
        ? "group relative min-w-0 w-full shrink-0 overflow-hidden rounded-2xl border border-azure-200/90 bg-gradient-to-br from-white via-azure-50/30 to-azure-50/60 shadow-sm ring-1 ring-azure-100/50 transition-shadow hover:shadow-md self-stretch"
        : "group relative w-[min(18.5rem,calc(100vw-2.25rem))] shrink-0 snap-start overflow-hidden rounded-2xl border border-azure-200/90 bg-gradient-to-br from-white via-azure-50/30 to-azure-50/60 shadow-sm ring-1 ring-azure-100/50 transition-shadow hover:shadow-md sm:w-72"
      : "group relative min-h-[1px] min-w-0 flex-1 basis-[min(100%,17.5rem)] overflow-hidden rounded-2xl border border-azure-200/90 bg-gradient-to-br from-white via-azure-50/30 to-azure-50/60 shadow-sm ring-1 ring-azure-100/50 transition-shadow hover:shadow-md sm:max-w-md sm:basis-[clamp(14rem,42%,22rem)] lg:max-w-none lg:basis-0 lg:grow";

  const accentClass = isPast
    ? "pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-ink-500 to-ink-700"
    : "pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-azure-400 to-azure-600";

  const seatToneClass = isPast ? "text-ink-800" : "text-azure-700";

  return (
    <div className={`${listClass} ${className}`.trim()} role="list">
      {plans.map((m) => (
        <article key={m.id} role="listitem" className={itemClass}>
          <div className={accentClass} aria-hidden />
          {isScroll ? (
            <ActiveMembershipCardContent
              m={m}
              pad={pad}
              plClass="pl-4 sm:pl-5"
              compactScroll
              showViewPlansLink={showViewPlansLink}
              seatToneClass={seatToneClass}
            />
          ) : (
            <ActiveMembershipCardContent
              m={m}
              pad={pad}
              plClass="pl-5 sm:pl-6"
              compactScroll={false}
              showViewPlansLink={showViewPlansLink}
              seatToneClass={seatToneClass}
            />
          )}
        </article>
      ))}
    </div>
  );
}
