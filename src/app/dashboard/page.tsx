import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import TableScroll from "@/components/dashboard/TableScroll";
import {
  daysUntil,
  formatCurrency,
  formatDate,
  getRecentPayments,
  getStats,
  planName,
} from "@/lib/members";
import AttendanceMiniWidget from "@/components/dashboard/AttendanceMiniWidget";

export const metadata = { title: "Overview" };

export default function DashboardOverview() {
  const stats = getStats();
  const recent = getRecentPayments(5);
  const expiring = [...stats.expiringSoon].sort(
    (a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)
  );

  const pctChange =
    stats.lastMonthRevenue === 0
      ? 0
      : Math.round(
          ((stats.monthlyRevenue - stats.lastMonthRevenue) /
            stats.lastMonthRevenue) *
            100
        );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="overview"
        title="Welcome back, Admin"
        description="Here's how the library is running today."
        actions={
          <>
            <Link
              href="/dashboard/payments"
              className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:border-ink-300 hover:bg-ink-50"
            >
              View payments
            </Link>
            <Link
              href="/dashboard/members"
              className="inline-flex items-center gap-2 rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 4v12M4 10h12"
                />
              </svg>
              New member
            </Link>
          </>
        }
      />

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active members"
          value={String(stats.active)}
          hint={`of ${stats.total} total`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="9" cy="8" r="3.5" />
              <path strokeLinecap="round" d="M2.5 20a6.5 6.5 0 0 1 13 0" />
              <circle cx="17" cy="9" r="2.5" />
            </svg>
          }
        />
        <KpiCard
          label="Revenue (this month)"
          value={formatCurrency(stats.monthlyRevenue)}
          hint={`${pctChange >= 0 ? "+" : ""}${pctChange}% vs last month`}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path strokeLinecap="round" d="M3 17 9 11l4 4 8-9" />
              <path strokeLinecap="round" d="M14 3h7v7" />
            </svg>
          }
        />
        <KpiCard
          label="Expiring soon"
          value={String(expiring.length)}
          hint="within 7 days"
          tone="warn"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" d="M12 7v5l3 2" />
            </svg>
          }
        />
        <KpiCard
          label="Payments due"
          value={String(stats.due.length)}
          hint="needs follow-up"
          tone="warn"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="2.5" y="6" width="19" height="13" rx="2" />
              <path strokeLinecap="round" d="M2.5 10h19" />
            </svg>
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Expiring */}
        <div className="lg:col-span-2 rounded-2xl border border-ink-100 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Subscriptions expiring soon
              </h2>
              <p className="mt-0.5 text-xs text-ink-500">
                Members whose plan ends within the next 7 days.
              </p>
            </div>
            <Link
              href="/dashboard/subscriptions"
              className="text-xs font-semibold text-azure-500 hover:text-azure-600"
            >
              View all →
            </Link>
          </div>

          <TableScroll>
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  <th className="sticky-col border-b border-ink-100 px-5 py-3 font-medium">Member</th>
                  <th className="border-b border-ink-100 px-3 py-3 font-medium">Plan</th>
                  <th className="border-b border-ink-100 px-3 py-3 font-medium">Seat</th>
                  <th className="border-b border-ink-100 px-3 py-3 font-medium">Expires</th>
                  <th className="border-b border-ink-100 px-5 py-3 text-right font-medium">In</th>
                </tr>
              </thead>
              <tbody>
                {expiring.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-ink-500">
                      All clear — no renewals due in the next week.
                    </td>
                  </tr>
                ) : (
                  expiring.map((m) => {
                    const d = daysUntil(m.expiryDate);
                    const tone = d <= 2 ? "warn" : "neutral";
                    return (
                      <tr key={m.id}>
                        <td className="sticky-col whitespace-nowrap border-b border-ink-50 px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.name} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink-900">{m.name}</p>
                              <p className="truncate font-mono text-[11px] text-ink-500">{m.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3 text-ink-700">
                          {planName(m.plan)}
                        </td>
                        <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3 font-mono text-xs text-ink-600">
                          {m.seatNo}
                        </td>
                        <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3 text-ink-600">
                          {formatDate(m.expiryDate)}
                        </td>
                        <td className="whitespace-nowrap border-b border-ink-50 px-5 py-3 text-right">
                          <StatusBadge tone={tone} dot>
                            {d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`}
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableScroll>
        </div>

        {/* Quick info card */}
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <h2 className="text-base font-semibold text-ink-900">
            Today, at a glance
          </h2>
          <p className="mt-1 text-xs text-ink-500">May 04, 2026 · Monday</p>

          <ul className="mt-6 space-y-4">
            <Glance
              label="Seats occupied"
              value={`${stats.active} / 120`}
              progress={(stats.active / 120) * 100}
            />
            <Glance
              label="Renewal rate"
              value="98%"
              progress={98}
            />
            <Glance
              label="Collection rate"
              value={`${Math.round(
                ((stats.total - stats.due.length) / stats.total) * 100
              )}%`}
              progress={
                ((stats.total - stats.due.length) / stats.total) * 100
              }
            />
          </ul>

          <div className="mt-6 rounded-xl bg-surface-muted p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              // tip
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              Send a friendly reminder to {expiring.length} members with
              expiring plans this week.
            </p>
          </div>
        </div>
      </section>

      {/* Today's attendance */}
      <AttendanceMiniWidget />

      {/* Recent payments */}
      <section className="rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Recent payments
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Latest 5 payments received.
            </p>
          </div>
          <Link
            href="/dashboard/payments"
            className="text-xs font-semibold text-azure-500 hover:text-azure-600"
          >
            View all →
          </Link>
        </div>

        <TableScroll>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <th className="sticky-col border-b border-ink-100 px-5 py-3 font-medium">Member</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Plan</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Method</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Date</th>
                <th className="border-b border-ink-100 px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id}>
                  <td className="sticky-col whitespace-nowrap border-b border-ink-50 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">{m.name}</p>
                        <p className="truncate font-mono text-[11px] text-ink-500">{m.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3 text-ink-700">
                    {planName(m.plan)}
                  </td>
                  <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3">
                    <StatusBadge tone="neutral">{m.lastPayment.method}</StatusBadge>
                  </td>
                  <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3 text-ink-600">
                    {formatDate(m.lastPayment.date)}
                  </td>
                  <td className="whitespace-nowrap border-b border-ink-50 px-5 py-3 text-right font-mono font-semibold text-ink-900">
                    {formatCurrency(m.lastPayment.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */

function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warn";
  icon: React.ReactNode;
}) {
  return (
    <article className="group rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
            tone === "warn"
              ? "bg-azure-50 text-azure-500"
              : "bg-ink-50 text-ink-700"
          }`}
        >
          <span className="block h-[18px] w-[18px]">{icon}</span>
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">
        {value}
      </p>
      {hint && (
        <p className="mt-1 font-mono text-[11px] text-ink-500">{hint}</p>
      )}
    </article>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 font-mono text-xs font-semibold text-ink-700">
      {initials}
    </span>
  );
}

function Glance({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <li>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-600">{label}</span>
        <span className="font-mono text-xs font-semibold text-ink-900">
          {value}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-azure-500 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}
