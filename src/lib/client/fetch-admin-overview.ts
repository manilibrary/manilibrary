export type AdminOverviewStats = {
  totalMembers: number;
  registeredAccounts: number;
  activeLong: number;
  activeShort: number;
  activeTotal: number;
  activeMembersDistinct: number;
  paidCountToday: number;
  revenueTodayInr: number;
  revenue30dInr: number;
  paidCount30d: number;
  totalPaidRevenueInr: number;
  pendingPayments: number;
  newMemberships30d: number;
};

export type AdminOverviewPayload = {
  stats: AdminOverviewStats;
  recentPayments: Array<{
    id: string;
    user_id: string;
    membership_id: string | null;
    amount_rupees: number;
    status: string;
    created_at: string;
    provider: string | null;
    provider_payment_id: string | null;
    member_label: string;
    device_user_id: number | null;
  }>;
  recentMemberships: Array<{
    id: string;
    user_id: string;
    plan_kind: string;
    status: string;
    seat_number: string | number | null;
    created_at: string;
    member_label: string;
    device_user_id: number | null;
  }>;
  expiringSoon: Array<{
    id: string;
    plan_kind: string;
    seat_number: string | number | null;
    end_label: string;
    member_label: string;
    device_user_id: number | null;
  }>;
  chart: {
    revenueByDay: Array<{ day: string; amountInr: number }>;
    membershipsCreatedByDay: Array<{ day: string; count: number }>;
    maxRevenueInr: number;
    maxMembershipsCreated: number;
  };
  seatSnapshot: { longTermDistinctSeats: number; shortTermDistinctSeats: number };
};

export async function fetchAdminOverview(): Promise<AdminOverviewPayload> {
  const res = await fetch("/api/admin/overview", { cache: "no-store" });
  const j = (await res.json()) as { ok?: boolean; error?: string } & Partial<AdminOverviewPayload>;
  if (!res.ok || !j.ok || !j.stats) {
    throw new Error(j.error ?? "Could not load overview.");
  }
  return {
    stats: {
      totalMembers: j.stats.totalMembers ?? 0,
      registeredAccounts: j.stats.registeredAccounts ?? j.stats.totalMembers ?? 0,
      activeLong: j.stats.activeLong ?? 0,
      activeShort: j.stats.activeShort ?? 0,
      activeTotal: j.stats.activeTotal ?? 0,
      activeMembersDistinct: j.stats.activeMembersDistinct ?? j.stats.activeTotal ?? 0,
      paidCountToday: j.stats.paidCountToday ?? 0,
      revenueTodayInr: j.stats.revenueTodayInr ?? 0,
      revenue30dInr: j.stats.revenue30dInr ?? 0,
      paidCount30d: j.stats.paidCount30d ?? 0,
      totalPaidRevenueInr: j.stats.totalPaidRevenueInr ?? 0,
      pendingPayments: j.stats.pendingPayments ?? 0,
      newMemberships30d: j.stats.newMemberships30d ?? 0,
    },
    recentPayments: j.recentPayments ?? [],
    recentMemberships: j.recentMemberships ?? [],
    expiringSoon: j.expiringSoon ?? [],
    chart: j.chart ?? {
      revenueByDay: [],
      membershipsCreatedByDay: [],
      maxRevenueInr: 1,
      maxMembershipsCreated: 1,
    },
    seatSnapshot: j.seatSnapshot ?? { longTermDistinctSeats: 0, shortTermDistinctSeats: 0 },
  };
}
