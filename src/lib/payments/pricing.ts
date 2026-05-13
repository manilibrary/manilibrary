export type MembershipPlanKind = "short_term" | "long_term";

/** Test plan prices stored in the DB as whole rupees (e.g. 500 = ₹500). */
export const TEST_AMOUNT_RUPEES: Record<MembershipPlanKind, number> = {
  short_term: 100,
  long_term: 500,
};

export type ShortTermDurationKey = "st_1d" | "st_7d";
export type LongTermDurationKey = "lt_1m" | "lt_3m" | "lt_6m" | "lt_12m";

export type PlanDurationOption =
  | { planKind: "short_term"; key: ShortTermDurationKey; label: string; durationHours: number }
  | { planKind: "long_term"; key: LongTermDurationKey; label: string; calendarMonths: number };

export const SHORT_TERM_DURATION_OPTIONS: Extract<PlanDurationOption, { planKind: "short_term" }>[] = [
  { planKind: "short_term", key: "st_1d", label: "1 day (24 hours)", durationHours: 24 },
  { planKind: "short_term", key: "st_7d", label: "7 days (168 hours)", durationHours: 168 },
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

/** Razorpay order/payment amounts are in INR paise. */
export function rupeesToRazorpayPaise(rupees: number): number {
  return Math.round(Number(rupees) * 100);
}

export function planTitle(kind: MembershipPlanKind, durationLabel?: string): string {
  const base =
    kind === "short_term" ? "Short-term (test)" : "Long-term (test)";
  return durationLabel ? `${base} · ${durationLabel}` : base;
}
