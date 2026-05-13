export type MembershipPlanKind = "short_term" | "long_term";

/** Legacy flat test amounts for day/week passes (Rupees). */
export const TEST_AMOUNT_RUPEES: Record<MembershipPlanKind, number> = {
  short_term: 100,
  long_term: 500,
};

/** Main hall (12 hrs/day) — billed per calendar month on long-term plans. */
export const MAIN_HALL_PRICE_PER_MONTH = 1500;
/** Row hall (6 hrs/day) — billed per 30-day-equivalent month on hub monthly passes. */
export const ROW_HALL_PRICE_PER_MONTH = 800;

export type ShortTermDurationKey = "st_1d" | "st_7d" | "st_hub_1m" | "st_hub_3m" | "st_hub_6m";
export type LongTermDurationKey = "lt_1m" | "lt_3m" | "lt_6m" | "lt_12m";

export type PlanDurationOption =
  | { planKind: "short_term"; key: ShortTermDurationKey; label: string; durationHours: number }
  | { planKind: "long_term"; key: LongTermDurationKey; label: string; calendarMonths: number };

/** ~30 days × 6 hours/day per “month” bucket for row-hall monthly passes (wall-clock entitlement). */
const HUB_MONTH_HOURS = 30 * 6;

export const SHORT_TERM_DURATION_OPTIONS: Extract<PlanDurationOption, { planKind: "short_term" }>[] = [
  { planKind: "short_term", key: "st_1d", label: "1 day (24 hours)", durationHours: 24 },
  { planKind: "short_term", key: "st_7d", label: "7 days (168 hours)", durationHours: 168 },
  { planKind: "short_term", key: "st_hub_1m", label: "1 month (6 hrs/day)", durationHours: HUB_MONTH_HOURS * 1 },
  { planKind: "short_term", key: "st_hub_3m", label: "3 months (6 hrs/day)", durationHours: HUB_MONTH_HOURS * 3 },
  { planKind: "short_term", key: "st_hub_6m", label: "6 months (6 hrs/day)", durationHours: HUB_MONTH_HOURS * 6 },
];

export const LONG_TERM_DURATION_OPTIONS: Extract<PlanDurationOption, { planKind: "long_term" }>[] = [
  { planKind: "long_term", key: "lt_1m", label: "1 calendar month", calendarMonths: 1 },
  { planKind: "long_term", key: "lt_3m", label: "3 calendar months", calendarMonths: 3 },
  { planKind: "long_term", key: "lt_6m", label: "6 calendar months", calendarMonths: 6 },
  { planKind: "long_term", key: "lt_12m", label: "12 calendar months", calendarMonths: 12 },
];

export function resolveShortTermDuration(key: unknown): (typeof SHORT_TERM_DURATION_OPTIONS)[number] | null {
  const k = typeof key === "string" ? key : "";
  return SHORT_TERM_DURATION_OPTIONS.find((o) => o.key === k) ?? null;
}

export function resolveLongTermDuration(key: unknown): (typeof LONG_TERM_DURATION_OPTIONS)[number] | null {
  const k = typeof key === "string" ? key : "";
  return LONG_TERM_DURATION_OPTIONS.find((o) => o.key === k) ?? null;
}

function rowHallHubMonths(durationKey: string): number | null {
  if (durationKey === "st_hub_1m") return 1;
  if (durationKey === "st_hub_3m") return 3;
  if (durationKey === "st_hub_6m") return 6;
  return null;
}

/**
 * Whitelist order totals (INR whole rupees). Server must use this for Razorpay amounts.
 * Returns null if durationKey is not recognised for the plan kind.
 */
export function computeOrderAmountRupees(planKind: MembershipPlanKind, durationKey: string): number | null {
  if (planKind === "long_term") {
    const d = resolveLongTermDuration(durationKey);
    if (!d) return null;
    return d.calendarMonths * MAIN_HALL_PRICE_PER_MONTH;
  }
  const sd = resolveShortTermDuration(durationKey);
  if (!sd) return null;
  if (sd.key === "st_1d" || sd.key === "st_7d") {
    return TEST_AMOUNT_RUPEES.short_term;
  }
  const months = rowHallHubMonths(sd.key);
  if (months == null) return null;
  return months * ROW_HALL_PRICE_PER_MONTH;
}

/** Razorpay order/payment amounts are in INR paise. */
export function rupeesToRazorpayPaise(rupees: number): number {
  return Math.round(Number(rupees) * 100);
}

export function planTitle(kind: MembershipPlanKind, durationLabel?: string): string {
  const base = kind === "short_term" ? "Row hall" : "Main hall (1st floor)";
  return durationLabel ? `${base} · ${durationLabel}` : base;
}
