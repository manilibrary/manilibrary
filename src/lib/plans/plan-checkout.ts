import type { MembershipPlanKind } from "@/lib/payments/pricing";
import type { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const PLAN_MONTHS = [1, 3, 6] as const;
export type PlanMonths = (typeof PLAN_MONTHS)[number];

export type PlanShift = "morning" | "evening" | "night";

export function isPlanMonths(n: unknown): n is PlanMonths {
  return n === 1 || n === 3 || n === 6;
}

/** Floor-1 fixed seat is long_term; floor-2 shift plans are short_term (S seats). */
export function planCodeToKind(code: string): MembershipPlanKind | null {
  if (code === "fixed_24h") return "long_term";
  if (code === "morning" || code === "evening" || code === "night") return "short_term";
  return null;
}

export function planCodeShift(code: string): PlanShift | null {
  if (code === "morning" || code === "evening" || code === "night") return code;
  return null;
}

export function planMonthsPriceColumn(months: PlanMonths): "price_1m" | "price_3m" | "price_6m" {
  return months === 1 ? "price_1m" : months === 3 ? "price_3m" : "price_6m";
}

export type ResolvedPlanCheckout = {
  code: string;
  name: string;
  floor: 1 | 2;
  planKind: MembershipPlanKind;
  shift: PlanShift | null;
  months: PlanMonths;
  priceRupees: number;
};

/** Server-side price resolution from library_plans (source of truth for checkout amounts). */
export async function resolvePlanCheckout(
  admin: ReturnType<typeof createSupabaseServiceRoleClient>,
  code: string,
  months: number,
): Promise<ResolvedPlanCheckout | null> {
  const planKind = planCodeToKind(code);
  if (!planKind || !isPlanMonths(months)) return null;

  const col = planMonthsPriceColumn(months);
  const { data, error } = await admin
    .from("library_plans")
    .select(`code, name, floor, is_active, ${col}`)
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as Record<string, unknown>;
  const price = Number(row[col]);
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    code,
    name: String(row.name ?? code),
    floor: Number(row.floor) === 1 ? 1 : 2,
    planKind,
    shift: planCodeShift(code),
    months: months as PlanMonths,
    priceRupees: price,
  };
}
