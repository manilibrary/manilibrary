"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAdminOverview } from "@/components/dashboard/AdminOverviewProvider";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from "@/lib/date-format";

type Stats = {
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

type RecentPayment = {
  id: string;
  user_id: string;
  membership_id: string | null;
  amount_rupees: number;
  status: string;
  created_at: string;
  plan_kind: string | null;
  member_label: string;
  device_user_id: number | null;
};

type RecentMembership = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  created_at: string;
  member_label: string;
  device_user_id: number | null;
};

type ExpiringRow = {
  id: string;
  plan_kind: string;
  seat_number: string | number | null;
  end_label: string;
  member_label: string;
  device_user_id: number | null;
};

type ChartDay = { day: string; amountInr: number };
type ChartMem = { day: string; count: number };

const TREND_DAYS = 14;

function formatInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const OVERVIEW_STAT_CARD_CLASS =
  "block shrink-0 w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.67rem)] md:w-[calc(25%-0.75rem)] xl:w-[calc((100%-4*1rem)/5)] rounded-2xl border border-ink-100 bg-white p-5 shadow-sm transition-colors hover:bg-ink-50/60";

function OverviewStatsRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto scroll-smooth pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

function shortDayLabel(isoDay: string) {
  const d = new Date(`${isoDay}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDay.slice(5);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function trimFromFirstActivity<T>(rows: T[], valueOf: (row: T) => number): T[] {
  const firstActive = rows.findIndex((row) => valueOf(row) > 0);
  if (firstActive < 0) return [];
  return rows.slice(firstActive);
}

function chartPeriodLabel(days: { day: string }[]) {
  if (days.length === 0) return `Last ${TREND_DAYS} days`;
  if (days.length === 1) return shortDayLabel(days[0].day);
  return `${shortDayLabel(days[0].day)} – ${shortDayLabel(days[days.length - 1].day)}`;
}

function formatAxisInr(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return `₹${n}`;
}

function formatBarValue(mode: "revenue" | "memberships", value: number) {
  if (mode === "revenue") return formatInr(value);
  return String(value);
}

function formatExpiringEnd(planKind: string, endLabel: string) {
  if (!endLabel || endLabel === "—") return "—";
  if (planKind === "short_term") {
    const iso = endLabel.includes(" ") ? endLabel.replace(" ", "T") : endLabel;
    return formatDateTimeDdMmYyyy(iso);
  }
  return formatDateDdMmYyyy(endLabel);
}

function daysToExpire(planKind: string, endLabel: string, todayYmd: string): number | null {
  if (!endLabel || endLabel === "—") return null;
  if (planKind === "long_term") {
    const ymd = endLabel.slice(0, 10);
    return Math.ceil((new Date(ymd).getTime() - new Date(todayYmd).getTime()) / (24 * 60 * 60 * 1000));
  }
  const iso = endLabel.includes(" ") ? endLabel.replace(" ", "T") : endLabel;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function daysToExpireLabel(days: number | null) {
  if (days == null) return "—";
  if (days < 0) return "Expired";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

type TrendPoint = { day: string; label: string; value: number };

function TrendChart({
  mode,
  revenueDays,
  membershipDays,
}: {
  mode: "revenue" | "memberships";
  revenueDays: ChartDay[];
  membershipDays: ChartMem[];
}) {
  const source = mode === "revenue" ? revenueDays : membershipDays;
  const chartData: TrendPoint[] = source.map((row) => ({
    day: row.day,
    label: shortDayLabel(row.day),
    value: mode === "revenue" ? (row as ChartDay).amountInr : (row as ChartMem).count,
  }));

  const peak = Math.max(0, ...chartData.map((d) => d.value));
  const peakLabel =
    mode === "revenue"
      ? peak > 0
        ? `${formatInr(Math.round(peak))} peak`
        : "No paid revenue yet"
      : peak > 0
        ? `${Math.round(peak)} peak`
        : "No new memberships yet";

  const barColor = mode === "revenue" ? "#2563eb" : "#059669";
  const yPadding = peak > 0 ? Math.ceil(peak * 0.15) : 1;

  if (chartData.length === 0) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Last {TREND_DAYS} days</p>
          <p className="font-mono text-[10px] text-ink-400">{peakLabel}</p>
        </div>
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/50">
          <p className="text-sm text-ink-500">
            {mode === "revenue" ? "No paid revenue in this window." : "No new memberships in this window."}
          </p>
        </div>
        <p className="mt-2 text-[10px] text-ink-400">Daily totals in UTC. Open Payments or Subscriptions for full history.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">{chartPeriodLabel(source)}</p>
        <p className="font-mono text-[10px] text-ink-400">{peakLabel}</p>
      </div>
      <div className="h-56 min-h-56 w-full min-w-0 rounded-xl border border-ink-100 bg-gradient-to-b from-white to-ink-50/60 px-1 py-3 sm:px-2">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={224}>
          <BarChart data={chartData} margin={{ top: 28, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              interval={chartData.length > 8 ? "preserveStartEnd" : 0}
              angle={chartData.length > 6 ? -32 : 0}
              textAnchor={chartData.length > 6 ? "end" : "middle"}
              height={chartData.length > 6 ? 48 : 28}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={mode === "revenue" ? 52 : 36}
              domain={[0, peak + yPadding]}
              tickFormatter={(v) => (mode === "revenue" ? formatAxisInr(Number(v)) : String(v))}
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
              }}
              formatter={(value) => [
                formatBarValue(mode, Number(value ?? 0)),
                mode === "revenue" ? "Revenue" : "New memberships",
              ]}
              labelFormatter={(_, payload) => {
                const day = payload?.[0]?.payload?.day as string | undefined;
                return day ? shortDayLabel(day) : "";
              }}
            />
            <Bar dataKey="value" fill={barColor} radius={[6, 6, 0, 0]} maxBarSize={56}>
              <LabelList
                dataKey="value"
                position="top"
                className="fill-ink-600 font-mono text-[10px] font-medium"
                formatter={(value) => formatBarValue(mode, Number(value ?? 0))}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-ink-400">
        Chart starts from the first day with activity in the last {TREND_DAYS} days (UTC). Open Payments or Subscriptions
        for full history.
      </p>
    </div>
  );
}

export default function AdminLibraryInsights() {
  const [trendMode, setTrendMode] = useState<"revenue" | "memberships">("revenue");

  const { data, error } = useAdminOverview();

  const slicedChart = useMemo(() => {
    if (!data) {
      return {
        revenue: [] as ChartDay[],
        memberships: [] as ChartMem[],
      };
    }
    const rev = trimFromFirstActivity(data.chart.revenueByDay.slice(-TREND_DAYS), (d) => d.amountInr);
    const mem = trimFromFirstActivity(data.chart.membershipsCreatedByDay.slice(-TREND_DAYS), (d) => d.count);
    return { revenue: rev, memberships: mem };
  }, [data]);

  const stats = data?.stats;
  const expiringSoon = data?.expiringSoon ?? [];
  const seatSnapshot = data?.seatSnapshot ?? { longTermDistinctSeats: 0, shortTermDistinctSeats: 0 };
  const todayYmd = new Date().toISOString().slice(0, 10);
  const registered = stats ? stats.registeredAccounts || stats.totalMembers : null;
  const activeMembers = stats ? stats.activeMembersDistinct ?? stats.activeTotal : null;

  if (error && !data) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <OverviewStatsRow>
        <Link href="/dashboard/members" className={OVERVIEW_STAT_CARD_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Registered users</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">
            {registered != null ? registered : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-500">Signed up on the website or app</p>
        </Link>

        <Link href="/dashboard/subscriptions" className={OVERVIEW_STAT_CARD_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Active members</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-800 tabular-nums">
            {activeMembers != null ? activeMembers : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-500">Bought a plan · membership active now</p>
        </Link>

        <Link href="/dashboard/subscriptions" className={OVERVIEW_STAT_CARD_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Active plans</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">
              {stats ? stats.activeTotal : "—"}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {stats ? `${stats.activeLong} long · ${stats.activeShort} short` : "—"}
            </p>
            <p className="mt-2 text-[11px] text-ink-400">
              {stats
                ? `Seats in use: ${seatSnapshot.longTermDistinctSeats} long · ${seatSnapshot.shortTermDistinctSeats} short`
                : "—"}
            </p>
            <p className="mt-2 text-[11px] text-ink-400">
              {stats ? (
                <>
                  Roster {stats.totalMembers}
                  {stats.newMemberships30d > 0 ? (
                    <>
                      {" "}
                      · <span className="text-emerald-700">+{stats.newMemberships30d}</span> new (30d)
                    </>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </p>
          </Link>

        <Link href="/dashboard/payments" className={OVERVIEW_STAT_CARD_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Income · 30 days</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-azure-800 tabular-nums">
            {stats ? formatInr(stats.revenue30dInr) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {stats ? `${stats.paidCount30d} paid charges` : "—"}
          </p>
        </Link>

        <Link href="/dashboard/payments" className={OVERVIEW_STAT_CARD_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Income · today</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">
            {stats ? formatInr(stats.revenueTodayInr) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {stats ? `${stats.paidCountToday} payments` : "—"}
          </p>
        </Link>

        <Link href="/dashboard/payments" className={OVERVIEW_STAT_CARD_CLASS}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Total income</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-azure-800 tabular-nums">
            {stats ? formatInr(stats.totalPaidRevenueInr) : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-500">All-time paid revenue</p>
        </Link>
      </OverviewStatsRow>

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Trend</p>
            <p className="mt-1 text-sm text-ink-600">Daily totals from the first active day in the last {TREND_DAYS} days.</p>
          </div>
          <div className="inline-flex rounded-full border border-ink-200 bg-ink-50/80 p-0.5">
            <button
              type="button"
              onClick={() => setTrendMode("revenue")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                trendMode === "revenue" ? "bg-white text-azure-800 shadow-sm" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              Revenue
            </button>
            <button
              type="button"
              onClick={() => setTrendMode("memberships")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                trendMode === "memberships" ? "bg-white text-emerald-800 shadow-sm" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              New memberships
            </button>
          </div>
        </div>
        <div className="mt-6 min-h-56">
          <TrendChart
            mode={trendMode}
            revenueDays={slicedChart.revenue}
            membershipDays={slicedChart.memberships}
          />
        </div>
      </div>

      <section
        className={`rounded-2xl border bg-white p-5 shadow-sm ${
          data && expiringSoon.length > 0 ? "border-amber-100" : "border-ink-100"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800"
              aria-hidden
            >
              <svg
                className="h-[18px] w-[18px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 3.5" />
              </svg>
            </div>
            <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Needs attention</p>
            <p className="mt-1 text-sm text-amber-900/80">
              {!data
                ? "—"
                : expiringSoon.length === 0
                  ? "No memberships in the expiring window."
                  : `${expiringSoon.length} membership${expiringSoon.length === 1 ? "" : "s"} ending soon.`}
            </p>
            </div>
          </div>
          <Link href="/dashboard/subscriptions?focus=expiring" className="text-xs font-medium text-azure-600 hover:text-azure-700">
            View all →
          </Link>
        </div>

        <div className="mt-4 min-h-[5.5rem]">
        {expiringSoon.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-ink-100">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60 font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <tr>
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Device user id</th>
                  <th className="px-3 py-2">Seat</th>
                  <th className="px-3 py-2">Ends</th>
                  <th className="px-3 py-2">Days to expire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-ink-800">
                {expiringSoon.slice(0, 5).map((m) => (
                  <tr key={m.id} className="bg-white">
                    <td className="max-w-[11rem] truncate px-3 py-2 text-xs">{m.member_label}</td>
                    <td className="px-3 py-2 text-xs capitalize">{m.plan_kind.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {m.device_user_id != null ? String(m.device_user_id).padStart(4, "0") : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {resolveMemberSeatDisplayLabel({ plan_kind: m.plan_kind, seat_number: m.seat_number })}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{formatExpiringEnd(m.plan_kind, m.end_label)}</td>
                    <td className="px-3 py-2 text-xs font-medium text-amber-800">
                      {daysToExpireLabel(daysToExpire(m.plan_kind, m.end_label, todayYmd))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expiringSoon.length > 5 ? (
              <p className="border-t border-ink-100 bg-ink-50/40 px-3 py-2 text-center text-[11px] text-ink-500">
                +{expiringSoon.length - 5} more in Subscriptions
              </p>
            ) : null}
          </div>
        ) : data ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-500">
            No memberships in the expiring window.
          </p>
        ) : null}
        </div>
      </section>
    </div>
  );
}
