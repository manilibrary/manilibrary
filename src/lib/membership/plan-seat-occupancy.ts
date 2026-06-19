import type { SupabaseClient } from "@supabase/supabase-js";

import { longTermCoversToday } from "@/lib/membership/seat-occupancy-window";
import { parseNumericSeatFromStoredSeat } from "@/lib/membership/seat-label";
import { planCodeShift, planCodeToKind } from "@/lib/plans/plan-checkout";

type OccupancyRow = {
  seat_number: string | number | null;
  valid_from: string | null;
  valid_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export function seatNumbersFromRows(rows: OccupancyRow[]): number[] {
  return Array.from(
    new Set(
      rows
        .map((r) => parseNumericSeatFromStoredSeat(r.seat_number))
        .filter((n): n is number => n != null),
    ),
  ).sort((a, b) => a - b);
}

/** Active memberships covering `todayYmd` for a library_plans code (shift-aware). */
export async function occupiedSeatsForPlanCode(
  admin: SupabaseClient,
  planCode: string,
  todayYmd: string,
): Promise<number[]> {
  const planKind = planCodeToKind(planCode);
  if (!planKind) return [];

  const shift = planCodeShift(planCode);
  let query = admin
    .from("memberships")
    .select("seat_number, valid_from, valid_until, starts_at, ends_at")
    .eq("status", "active")
    .eq("plan_kind", planKind)
    .not("seat_number", "is", null);
  if (shift) query = query.eq("shift", shift);

  const { data, error } = await query;
  if (error) return [];

  const overlapping = ((data ?? []) as OccupancyRow[]).filter((r) =>
    longTermCoversToday(r, todayYmd),
  );
  return seatNumbersFromRows(overlapping);
}
