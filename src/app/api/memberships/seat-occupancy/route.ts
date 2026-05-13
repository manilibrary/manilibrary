import { apiError, apiSuccess } from "@/lib/api/json-response";
import { parseNumericSeatFromStoredSeat } from "@/lib/membership/seat-label";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const planKind = url.searchParams.get("planKind");
  if (planKind !== "short_term" && planKind !== "long_term") {
    return apiError("Query param planKind must be short_term | long_term.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create Supabase admin client.";
    return apiError(msg, 503);
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const base = admin
    .from("memberships")
    .select("seat_number")
    .eq("status", "active")
    .eq("plan_kind", planKind)
    .not("seat_number", "is", null);

  const q =
    planKind === "long_term"
      ? base.lte("valid_from", today).gte("valid_until", today)
      : base.lte("starts_at", now.toISOString()).gte("ends_at", now.toISOString());

  const { data, error } = await q;
  if (error) {
    return apiError(error.message, 500);
  }

  const seats = Array.from(
    new Set(
      (data ?? [])
        .map((r) => parseNumericSeatFromStoredSeat((r as { seat_number: string | number | null }).seat_number))
        .filter((n): n is number => n != null),
    ),
  ).sort((a, b) => a - b);

  const label = planKind === "long_term" ? "long-term" : "short-term";
  return apiSuccess(`Active ${label} seat numbers loaded (${seats.length} seats).`, { planKind, seats });
}
