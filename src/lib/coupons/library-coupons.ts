import type { SupabaseClient } from "@supabase/supabase-js";

import { PLAN_CODE_NAMES } from "@/lib/plans/library-plans";

export type CouponStatus = "active" | "used";

/** Key under `payments.metadata` that records a redeemed coupon for activation. */
export const PAYMENT_METADATA_COUPON_KEY = "coupon";

export const COUPON_CODE_RE = /^MANI[0-9A-F]{4}$/;

export type LibraryCoupon = {
  id: string;
  code: string;
  discountPercent: number;
  planCode: string;
  planName: string;
  status: CouponStatus;
  usedAt: string | null;
  createdAt: string;
};

export type LibraryCouponRow = {
  id: string;
  code: string;
  discount_percent: number;
  plan_code: string;
  status: CouponStatus;
  used_at: string | null;
  created_at: string;
};

export const LIBRARY_COUPONS_SELECT =
  "id, code, discount_percent, plan_code, status, used_at, created_at";

/** The 4 sellable plan codes a coupon can target. */
export const COUPON_PLAN_CODES = ["morning", "evening", "night", "fixed_24h"] as const;

export function isCouponPlanCode(code: unknown): code is (typeof COUPON_PLAN_CODES)[number] {
  return typeof code === "string" && (COUPON_PLAN_CODES as readonly string[]).includes(code);
}

export function isValidCouponDiscount(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 10 && n <= 90;
}

/** MANI + 4 uppercase hex chars (8 chars total). Isomorphic (Web Crypto). */
export function generateCouponCode(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `MANI${hex}`;
}

/** Selling price after applying a whole-percent discount (rupees, rounded, never below 0). */
export function applyCouponDiscount(priceRupees: number, percent: number): number {
  const discounted = Math.round((priceRupees * (100 - percent)) / 100);
  return Math.max(0, discounted);
}

export type CouponCheck =
  | { ok: true; coupon: LibraryCouponRow }
  | { ok: false; error: string };

/** Server-side: confirm a coupon is active and applies to `planCode`. */
export async function fetchActiveCouponForPlan(
  admin: SupabaseClient,
  code: string,
  planCode: string,
): Promise<CouponCheck> {
  const normalized = code.trim().toUpperCase();
  if (!COUPON_CODE_RE.test(normalized)) {
    return { ok: false, error: "Enter a valid coupon code (MANI followed by 4 characters)." };
  }
  const { data, error } = await admin
    .from("library_coupons")
    .select(LIBRARY_COUPONS_SELECT)
    .eq("code", normalized)
    .maybeSingle();
  if (error) return { ok: false, error: "Could not check this coupon. Try again." };
  if (!data) return { ok: false, error: "Coupon not found." };
  const row = data as LibraryCouponRow;
  if (row.status !== "active") return { ok: false, error: "This coupon has already been used." };
  if (row.plan_code !== planCode) return { ok: false, error: "This coupon is not valid for this plan." };
  return { ok: true, coupon: row };
}

export function rowToLibraryCoupon(row: LibraryCouponRow): LibraryCoupon {
  return {
    id: row.id,
    code: row.code,
    discountPercent: row.discount_percent,
    planCode: row.plan_code,
    planName: PLAN_CODE_NAMES[row.plan_code] ?? row.plan_code,
    status: row.status,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}
