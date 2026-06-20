export const PLAN_DURATIONS = [
  { months: 1, key: "1m", label: "1 month" },
  { months: 3, key: "3m", label: "3 months" },
  { months: 6, key: "6m", label: "6 months" },
] as const;

export type PlanDurationKey = (typeof PLAN_DURATIONS)[number]["key"];

export type PlanDurationPrice = {
  months: number;
  key: PlanDurationKey;
  label: string;
  price: number;
  mrp: number;
  discountPercent: number;
};

export type LibraryPlan = {
  id: string;
  code: string;
  name: string;
  floor: 1 | 2;
  accessLabel: string;
  is24Hour: boolean;
  sortOrder: number;
  durations: PlanDurationPrice[];
};

export type LibraryPlanRow = {
  id: string;
  code: string;
  name: string;
  floor: number;
  access_label: string;
  is_24hour: boolean;
  sort_order: number;
  price_1m: number;
  mrp_1m: number;
  price_3m: number;
  mrp_3m: number;
  price_6m: number;
  mrp_6m: number;
};

export const PLAN_CODE_NAMES: Record<string, string> = {
  morning: "Morning shift",
  evening: "Evening shift",
  night: "Night shift",
  fixed_24h: "24-hour fixed seat",
};

/** Friendly label for a membership: prefers the plan_code name, falls back to plan_kind. */
export function planDisplayName(
  planCode: string | null | undefined,
  planKind: string | null | undefined,
): string {
  if (planCode && PLAN_CODE_NAMES[planCode]) return PLAN_CODE_NAMES[planCode];
  if (planKind === "long_term") return "Long-term";
  if (planKind === "short_term") return "Short-term";
  return planKind ?? "Membership";
}

export function discountPercent(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function floorLabel(floor: 1 | 2): string {
  return floor === 1 ? "1st floor" : "2nd floor";
}

export function formatPlanInr(amount: number): string {
  return amount.toLocaleString("en-IN");
}

export function planDurationByKey(
  plan: LibraryPlan,
  durationKey: PlanDurationKey,
): PlanDurationPrice {
  return plan.durations.find((d) => d.key === durationKey) ?? plan.durations[0];
}

/** Rounded effective monthly rate for a lump-sum duration price. */
export function effectiveMonthlyPrice(totalPrice: number, months: number): number {
  if (months <= 0) return totalPrice;
  return Math.round(totalPrice / months);
}

export type CheapestEffectivePlan = {
  plan: LibraryPlan;
  duration: PlanDurationPrice;
  effectiveMonthly: number;
};

/** Lowest effective ₹/month across plans for a billing duration (default 6 months). */
export function cheapestEffectivePlan(
  plans: LibraryPlan[],
  durationKey: PlanDurationKey = "6m",
): CheapestEffectivePlan | null {
  let best: CheapestEffectivePlan | null = null;
  for (const plan of plans) {
    const duration = planDurationByKey(plan, durationKey);
    const effectiveMonthly = effectiveMonthlyPrice(duration.price, duration.months);
    if (!best || effectiveMonthly < best.effectiveMonthly) {
      best = { plan, duration, effectiveMonthly };
    }
  }
  return best;
}

export function bestValuePlanCode(plans: LibraryPlan[], durationKey: PlanDurationKey): string | null {
  return cheapestEffectivePlan(plans, durationKey)?.plan.code ?? null;
}

export const LIBRARY_PLANS_SELECT =
  "id, code, name, floor, access_label, is_24hour, sort_order, price_1m, mrp_1m, price_3m, mrp_3m, price_6m, mrp_6m";

export const LIBRARY_PLANS_ADMIN_SELECT = `${LIBRARY_PLANS_SELECT}, is_active`;

export const PLAN_PRICE_FIELDS = [
  "price_1m",
  "mrp_1m",
  "price_3m",
  "mrp_3m",
  "price_6m",
  "mrp_6m",
] as const;

export type PlanPriceField = (typeof PLAN_PRICE_FIELDS)[number];

/** Validate that each MRP is >= its selling price for the merged field set. */
export function validatePlanPricing(fields: Partial<Record<PlanPriceField, number>>): string | null {
  const pairs: [PlanPriceField, PlanPriceField, string][] = [
    ["price_1m", "mrp_1m", "1 month"],
    ["price_3m", "mrp_3m", "3 months"],
    ["price_6m", "mrp_6m", "6 months"],
  ];
  for (const [priceKey, mrpKey, label] of pairs) {
    const price = fields[priceKey];
    const mrp = fields[mrpKey];
    if (price != null && (!Number.isFinite(price) || price < 0)) {
      return `${label} price must be a non-negative number.`;
    }
    if (mrp != null && (!Number.isFinite(mrp) || mrp < 0)) {
      return `${label} MRP must be a non-negative number.`;
    }
    if (price != null && mrp != null && mrp < price) {
      return `${label}: MRP (${mrp}) cannot be less than the selling price (${price}).`;
    }
  }
  return null;
}

export function rowToLibraryPlan(row: LibraryPlanRow): LibraryPlan {
  const priceByKey: Record<PlanDurationKey, { price: number; mrp: number }> = {
    "1m": { price: row.price_1m, mrp: row.mrp_1m },
    "3m": { price: row.price_3m, mrp: row.mrp_3m },
    "6m": { price: row.price_6m, mrp: row.mrp_6m },
  };

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    floor: row.floor === 1 ? 1 : 2,
    accessLabel: row.access_label,
    is24Hour: row.is_24hour === true,
    sortOrder: row.sort_order,
    durations: PLAN_DURATIONS.map((d) => {
      const { price, mrp } = priceByKey[d.key];
      return {
        months: d.months,
        key: d.key,
        label: d.label,
        price,
        mrp,
        discountPercent: discountPercent(mrp, price),
      };
    }),
  };
}
