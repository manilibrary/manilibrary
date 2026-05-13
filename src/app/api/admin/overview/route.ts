import { apiError, apiSuccess } from "@/lib/api/json-response";
import { requireLibraryAdminOrSuperAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function last30DayKeysUtc(todayYmd: string): string[] {
  const keys: string[] = [];
  const [y, mo, da] = todayYmd.split("-").map(Number);
  for (let i = 29; i >= 0; i--) {
    const t = new Date(Date.UTC(y, mo - 1, da - i));
    keys.push(t.toISOString().slice(0, 10));
  }
  return keys;
}

function parsePaidSumAggregate(data: unknown): number | null {
  if (data == null) return null;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row || typeof row !== "object") return null;
  for (const v of Object.values(row)) {
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

async function profilesMiniByUserIds(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Record<string, { full_name: string; member_number: number; email: string | null }>> {
  const uniq = [...new Set(userIds)].filter(Boolean);
  if (uniq.length === 0) return {};
  const { data } = await admin
    .from("profiles")
    .select("user_id, full_name, member_number, email")
    .in("user_id", uniq);
  const out: Record<string, { full_name: string; member_number: number; email: string | null }> = {};
  for (const p of data ?? []) {
    out[p.user_id] = {
      full_name: p.full_name,
      member_number: p.member_number,
      email: p.email ?? null,
    };
  }
  return out;
}

async function distinctActiveSeatCount(
  admin: SupabaseClient,
  planKind: "long_term" | "short_term",
  todayYmd: string,
  nowIso: string,
): Promise<number> {
  const base = admin
    .from("memberships")
    .select("seat_number")
    .eq("status", "active")
    .eq("plan_kind", planKind)
    .not("seat_number", "is", null);
  const q =
    planKind === "long_term"
      ? base.lte("valid_from", todayYmd).gte("valid_until", todayYmd)
      : base.lte("starts_at", nowIso).gte("ends_at", nowIso);
  const { data, error } = await q;
  if (error) return 0;
  const seats = new Set<number>();
  for (const r of data ?? []) {
    const n = (r as { seat_number: number | null }).seat_number;
    if (typeof n === "number" && Number.isFinite(n)) seats.add(n);
  }
  return seats.size;
}

export async function GET() {
  const gate = await requireLibraryAdminOrSuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const admin = createSupabaseServiceRoleClient();

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const startOfDay = `${today}T00:00:00.000Z`;
  const thirtyAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const longExpiringUntil = addDaysYmd(today, 14);
  const shortExpiringUntilIso = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const chartDayKeys = last30DayKeysUtc(today);

  const [
    profilesCount,
    activeLong,
    activeShort,
    paidToday,
    pendingPayments,
    newMemberships30dCount,
    recentPaymentsRaw,
    recentMembershipsRaw,
    expiringLongRaw,
    expiringShortRaw,
    paid30dRows,
    memCreated30dRows,
    seatsLong,
    seatsShort,
    paidAllTimeAgg,
  ] = await Promise.all([
    admin.from("profiles").select("user_id", { count: "exact", head: true }),
    admin
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("plan_kind", "long_term")
      .lte("valid_from", today)
      .gte("valid_until", today),
    admin
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("plan_kind", "short_term")
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso),
    admin
      .from("payments")
      .select("amount_rupees")
      .eq("status", "paid")
      .gte("created_at", startOfDay),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyAgoIso),
    admin
      .from("payments")
      .select("id, user_id, membership_id, amount_rupees, status, created_at, provider, provider_payment_id")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("memberships")
      .select("id, user_id, plan_kind, status, seat_number, created_at, valid_from, valid_until, starts_at, ends_at")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("memberships")
      .select("id, user_id, plan_kind, status, seat_number, valid_until, valid_from")
      .eq("status", "active")
      .eq("plan_kind", "long_term")
      .gte("valid_until", today)
      .lte("valid_until", longExpiringUntil)
      .order("valid_until", { ascending: true })
      .limit(20),
    admin
      .from("memberships")
      .select("id, user_id, plan_kind, status, seat_number, ends_at, starts_at")
      .eq("status", "active")
      .eq("plan_kind", "short_term")
      .gt("ends_at", nowIso)
      .lte("ends_at", shortExpiringUntilIso)
      .order("ends_at", { ascending: true })
      .limit(20),
    admin
      .from("payments")
      .select("created_at, amount_rupees")
      .eq("status", "paid")
      .gte("created_at", thirtyAgoIso)
      .limit(5000),
    admin
      .from("memberships")
      .select("created_at")
      .gte("created_at", thirtyAgoIso)
      .limit(5000),
    distinctActiveSeatCount(admin, "long_term", today, nowIso),
    distinctActiveSeatCount(admin, "short_term", today, nowIso),
    admin.from("payments").select("amount_rupees.sum()").eq("status", "paid").maybeSingle(),
  ]);

  const totalRevenueToday = (paidToday.data ?? []).reduce(
    (sum, r) => sum + Number((r as { amount_rupees: number }).amount_rupees ?? 0),
    0,
  );

  const revenue30dInr = (paid30dRows.data ?? []).reduce(
    (sum, r) => sum + Number((r as { amount_rupees: number }).amount_rupees ?? 0),
    0,
  );
  const paidCount30d = paid30dRows.data?.length ?? 0;

  let totalPaidRevenueInr = 0;
  if (!paidAllTimeAgg.error) {
    totalPaidRevenueInr = parsePaidSumAggregate(paidAllTimeAgg.data) ?? 0;
  }
  if (paidAllTimeAgg.error) {
    const { data: paidFallback } = await admin
      .from("payments")
      .select("amount_rupees")
      .eq("status", "paid")
      .limit(25_000);
    totalPaidRevenueInr = (paidFallback ?? []).reduce(
      (s, r) => s + Number((r as { amount_rupees: number }).amount_rupees ?? 0),
      0,
    );
  }

  const revenueByDay = new Map<string, number>();
  for (const r of paid30dRows.data ?? []) {
    const row = r as { created_at: string; amount_rupees: number };
    const d = String(row.created_at).slice(0, 10);
    revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + Number(row.amount_rupees ?? 0));
  }
  const membershipsCreatedByDay = new Map<string, number>();
  for (const r of memCreated30dRows.data ?? []) {
    const row = r as { created_at: string };
    const d = String(row.created_at).slice(0, 10);
    membershipsCreatedByDay.set(d, (membershipsCreatedByDay.get(d) ?? 0) + 1);
  }

  const chartRevenue = chartDayKeys.map((day) => ({
    day,
    amountInr: revenueByDay.get(day) ?? 0,
  }));
  const chartMemberships = chartDayKeys.map((day) => ({
    day,
    count: membershipsCreatedByDay.get(day) ?? 0,
  }));

  const payUsers = (recentPaymentsRaw.data ?? []).map((p) => (p as { user_id: string }).user_id);
  const memUsers = [
    ...(recentMembershipsRaw.data ?? []).map((m) => (m as { user_id: string }).user_id),
    ...(expiringLongRaw.data ?? []).map((m) => (m as { user_id: string }).user_id),
    ...(expiringShortRaw.data ?? []).map((m) => (m as { user_id: string }).user_id),
  ];
  const profs = await profilesMiniByUserIds(admin, [...payUsers, ...memUsers]);

  const recentPayments = (recentPaymentsRaw.data ?? []).map((row) => {
    const p = row as {
      id: string;
      user_id: string;
      membership_id: string | null;
      amount_rupees: number;
      status: string;
      created_at: string;
      provider: string | null;
      provider_payment_id: string | null;
    };
    const pr = profs[p.user_id];
    return {
      id: p.id,
      user_id: p.user_id,
      membership_id: p.membership_id,
      amount_rupees: p.amount_rupees,
      status: p.status,
      created_at: p.created_at,
      provider: p.provider,
      provider_payment_id: p.provider_payment_id,
      member_label: pr ? `${pr.full_name} (#${String(pr.member_number).padStart(4, "0")})` : p.user_id,
    };
  });

  const recentMemberships = (recentMembershipsRaw.data ?? []).map((row) => {
    const m = row as {
      id: string;
      user_id: string;
      plan_kind: string;
      status: string;
      seat_number: number | null;
      created_at: string;
      valid_from: string | null;
      valid_until: string | null;
      starts_at: string | null;
      ends_at: string | null;
    };
    const pr = profs[m.user_id];
    return {
      id: m.id,
      user_id: m.user_id,
      plan_kind: m.plan_kind,
      status: m.status,
      seat_number: m.seat_number,
      created_at: m.created_at,
      valid_from: m.valid_from,
      valid_until: m.valid_until,
      starts_at: m.starts_at,
      ends_at: m.ends_at,
      member_label: pr ? `${pr.full_name} (#${String(pr.member_number).padStart(4, "0")})` : m.user_id,
    };
  });

  const expiringSoon = [
    ...(expiringLongRaw.data ?? []).map((row) => {
      const m = row as {
        id: string;
        user_id: string;
        plan_kind: string;
        status: string;
        seat_number: number | null;
        valid_until: string | null;
      };
      const pr = profs[m.user_id];
      return {
        id: m.id,
        user_id: m.user_id,
        plan_kind: m.plan_kind,
        status: m.status,
        seat_number: m.seat_number,
        end_label: m.valid_until ?? "—",
        member_label: pr ? `${pr.full_name} (#${String(pr.member_number).padStart(4, "0")})` : m.user_id,
      };
    }),
    ...(expiringShortRaw.data ?? []).map((row) => {
      const m = row as {
        id: string;
        user_id: string;
        plan_kind: string;
        status: string;
        seat_number: number | null;
        ends_at: string | null;
      };
      const pr = profs[m.user_id];
      return {
        id: m.id,
        user_id: m.user_id,
        plan_kind: m.plan_kind,
        status: m.status,
        seat_number: m.seat_number,
        end_label: m.ends_at ? String(m.ends_at).replace("T", " ").slice(0, 16) : "—",
        member_label: pr ? `${pr.full_name} (#${String(pr.member_number).padStart(4, "0")})` : m.user_id,
      };
    }),
  ];

  const maxRev = Math.max(1, ...chartRevenue.map((x) => x.amountInr));
  const maxMem = Math.max(1, ...chartMemberships.map((x) => x.count));

  return apiSuccess("Admin overview statistics loaded.", {
    stats: {
      totalMembers: profilesCount.count ?? 0,
      activeLong: activeLong.count ?? 0,
      activeShort: activeShort.count ?? 0,
      activeTotal: (activeLong.count ?? 0) + (activeShort.count ?? 0),
      paidCountToday: (paidToday.data ?? []).length,
      revenueTodayInr: totalRevenueToday,
      revenue30dInr,
      paidCount30d,
      totalPaidRevenueInr,
      pendingPayments: pendingPayments.count ?? 0,
      newMemberships30d: newMemberships30dCount.count ?? 0,
    },
    recentPayments,
    recentMemberships,
    expiringSoon,
    chart: {
      revenueByDay: chartRevenue,
      membershipsCreatedByDay: chartMemberships,
      maxRevenueInr: maxRev,
      maxMembershipsCreated: maxMem,
    },
    seatSnapshot: {
      longTermDistinctSeats: seatsLong,
      shortTermDistinctSeats: seatsShort,
    },
  });
}
