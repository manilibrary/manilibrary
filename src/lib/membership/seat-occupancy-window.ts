import {
  DEFAULT_LIBRARY_TZ,
  addWallClockHours,
  longTermInclusiveUntil,
  membershipDayStartIso,
  toYmdBoundary,
} from "@/lib/membership/windows";
import {
  resolveLongTermDuration,
  resolveShortTermDuration,
  type MembershipPlanKind,
} from "@/lib/payments/pricing";

export type ProposedBookingWindow =
  | { planKind: "long_term"; startYmd: string; endYmd: string }
  | { planKind: "short_term"; startsIso: string; endsIso: string };

export function resolveProposedBookingWindow(
  planKind: MembershipPlanKind,
  membershipStartYmd: string,
  durationKey: string,
): ProposedBookingWindow | { error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(membershipStartYmd)) {
    return { error: "startDate must be YYYY-MM-DD." };
  }
  if (planKind === "long_term") {
    const dur = resolveLongTermDuration(durationKey);
    if (!dur) return { error: "Invalid durationKey for long_term." };
    const endYmd = longTermInclusiveUntil(membershipStartYmd, dur.calendarMonths);
    return { planKind: "long_term", startYmd: membershipStartYmd, endYmd: endYmd };
  }
  const dur = resolveShortTermDuration(durationKey);
  if (!dur) return { error: "Invalid durationKey for short_term." };
  const startsIso = membershipDayStartIso(membershipStartYmd, DEFAULT_LIBRARY_TZ);
  const endsIso = addWallClockHours(startsIso, dur.durationHours);
  return { planKind: "short_term", startsIso, endsIso };
}

type LongDateRow = { valid_from: string | null; valid_until: string | null };
type ShortIsoRow = { starts_at: string | null; ends_at: string | null };

/** Inclusive calendar overlap for long-term (YYYY-MM-DD compare). */
export function longTermWindowsOverlap(row: LongDateRow, windowStartYmd: string, windowEndYmd: string): boolean {
  const vf = toYmdBoundary(row.valid_from);
  const vu = toYmdBoundary(row.valid_until);
  if (!vf || !vu) return false;
  return vf <= windowEndYmd && windowStartYmd <= vu;
}

/** Half-open style overlap for wall-clock intervals (same as DB exclusion intent). */
export function shortTermIntervalsOverlap(row: ShortIsoRow, winStartIso: string, winEndIso: string): boolean {
  if (!row.starts_at || !row.ends_at) return false;
  const rs = Date.parse(row.starts_at);
  const re = Date.parse(row.ends_at);
  const ws = Date.parse(winStartIso);
  const we = Date.parse(winEndIso);
  if (![rs, re, ws, we].every(Number.isFinite)) return false;
  return rs < we && ws < re;
}

/** Active long-term membership covers library-local `todayYmd`. */
export function longTermCoversToday(row: LongDateRow, todayYmd: string): boolean {
  return longTermWindowsOverlap(row, todayYmd, todayYmd);
}

/** Active short-term pass is in progress at `nowIso`. */
export function shortTermActiveNow(row: ShortIsoRow, nowIso: string): boolean {
  if (!row.starts_at || !row.ends_at) return false;
  const t = Date.parse(nowIso);
  const s = Date.parse(row.starts_at);
  const e = Date.parse(row.ends_at);
  if (![t, s, e].every(Number.isFinite)) return false;
  return s <= t && t <= e;
}
