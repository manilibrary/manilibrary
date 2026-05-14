import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  longTermCoversToday,
  longTermWindowsOverlap,
  resolveProposedBookingWindow,
  shortTermActiveNow,
  shortTermIntervalsOverlap,
} from "@/lib/membership/seat-occupancy-window";
import { parseNumericSeatFromStoredSeat } from "@/lib/membership/seat-label";
import type { MembershipPlanKind } from "@/lib/payments/pricing";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type PlanRow = {
  seat_number: string | number | null;
  valid_from: string | null;
  valid_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
  plan_kind: string | null;
};

function isPlanKind(v: string | null): v is MembershipPlanKind {
  return v === "short_term" || v === "long_term";
}

export async function GET(request: Request) {
  const {
    data: { user },
  } = await getAuthUserForApiRequest(request);
  if (!user) {
    return apiError("Sign in to load seat availability.", 401, { signedIn: false });
  }

  const url = new URL(request.url);
  const planKindRaw = url.searchParams.get("planKind");
  if (!isPlanKind(planKindRaw)) {
    return apiError("Query param planKind must be short_term | long_term.", 400);
  }
  const planKind = planKindRaw;

  const startDate = url.searchParams.get("startDate")?.trim() ?? "";
  const durationKey = url.searchParams.get("durationKey")?.trim() ?? "";
  const useProposedWindow = startDate.length > 0 && durationKey.length > 0;

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create Supabase admin client.");
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);

  const { data: rows, error } = await admin
    .from("memberships")
    .select("seat_number, valid_from, valid_until, starts_at, ends_at, plan_kind")
    .eq("status", "active")
    .eq("plan_kind", planKind)
    .not("seat_number", "is", null);

  if (error) {
    return apiErrorSafe(error, 500);
  }

  const list = (rows ?? []) as PlanRow[];

  let overlapping: PlanRow[];

  if (useProposedWindow) {
    const win = resolveProposedBookingWindow(planKind, startDate, durationKey);
    if ("error" in win) {
      return apiError(win.error, 400);
    }
    if (win.planKind === "long_term") {
      overlapping = list.filter((r) => longTermWindowsOverlap(r, win.startYmd, win.endYmd));
    } else {
      overlapping = list.filter((r) => shortTermIntervalsOverlap(r, win.startsIso, win.endsIso));
    }
  } else if (planKind === "long_term") {
    overlapping = list.filter((r) => longTermCoversToday(r, today));
  } else {
    overlapping = list.filter((r) => shortTermActiveNow(r, nowIso));
  }

  const seats = Array.from(
    new Set(
      overlapping
        .map((r) => parseNumericSeatFromStoredSeat(r.seat_number))
        .filter((n): n is number => n != null),
    ),
  ).sort((a, b) => a - b);

  const label = planKind === "long_term" ? "long-term" : "short-term";
  return apiSuccess(`Active ${label} seat numbers loaded (${seats.length} seats).`, {
    planKind,
    seats,
    window: useProposedWindow ? { startDate, durationKey } : { mode: "now" as const },
  });
}
