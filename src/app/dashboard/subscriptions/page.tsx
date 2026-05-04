import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import TableScroll from "@/components/dashboard/TableScroll";
import {
  daysUntil,
  formatCurrency,
  formatDate,
  getMembers,
  planName,
} from "@/lib/members";
import libraryInfo from "@/data/libraryInfo.json";

export const metadata = { title: "Subscriptions" };

export default function SubscriptionsPage() {
  const members = getMembers();

  const expired = members.filter((m) => m.status === "expired");
  const expiringSoon = members
    .filter((m) => {
      if (m.status !== "active") return false;
      const d = daysUntil(m.expiryDate);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));
  const upcoming = members
    .filter((m) => {
      if (m.status !== "active") return false;
      const d = daysUntil(m.expiryDate);
      return d > 7 && d <= 30;
    })
    .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate));

  const planDistribution = libraryInfo.plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    count: members.filter((m) => m.plan === p.id).length,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="subscriptions"
        title="Subscriptions"
        description="Renewals, expiries, and plan distribution at a glance."
      />

      {/* Plan distribution */}
      <section className="grid gap-4 md:grid-cols-3">
        {planDistribution.map((p) => {
          const total = members.length;
          const pct = total === 0 ? 0 : Math.round((p.count / total) * 100);
          return (
            <article
              key={p.id}
              className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-ink-500">
                    {p.name} plan
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">
                    {p.count}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-ink-500">
                    {formatCurrency(p.price)} / month
                  </p>
                </div>
                <span className="rounded-full bg-azure-50 px-2.5 py-0.5 text-[11px] font-semibold text-azure-700">
                  {pct}%
                </span>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-azure-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </article>
          );
        })}
      </section>

      {/* Expiring soon */}
      <Section
        title="Expiring this week"
        description="Reach out for renewals before access lapses."
      >
        {expiringSoon.length === 0 ? (
          <Empty message="No subscriptions expiring in the next 7 days." />
        ) : (
          <SubsTable rows={expiringSoon} mode="expiring" />
        )}
      </Section>

      {/* Upcoming */}
      <Section
        title="Renewals this month"
        description="Active members whose plan ends within 30 days."
      >
        {upcoming.length === 0 ? (
          <Empty message="No upcoming renewals in the next 30 days." />
        ) : (
          <SubsTable rows={upcoming} mode="upcoming" />
        )}
      </Section>

      {/* Expired */}
      <Section
        title="Expired"
        description="Members whose subscription has lapsed."
      >
        {expired.length === 0 ? (
          <Empty message="No expired subscriptions. " />
        ) : (
          <SubsTable rows={expired} mode="expired" />
        )}
      </Section>
    </div>
  );
}

/* ---------- helpers ---------- */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="border-b border-ink-100 px-6 py-4">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-ink-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="px-6 py-12 text-center text-sm text-ink-500">{message}</div>
  );
}

type Mode = "expiring" | "upcoming" | "expired";

function SubsTable({
  rows,
  mode,
}: {
  rows: ReturnType<typeof getMembers>;
  mode: Mode;
}) {
  return (
    <TableScroll>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
            <th className="sticky-col border-b border-ink-100 px-5 py-3 font-medium">Member</th>
            <th className="border-b border-ink-100 px-3 py-3 font-medium">Plan</th>
            <th className="border-b border-ink-100 px-3 py-3 font-medium">Seat</th>
            <th className="border-b border-ink-100 px-3 py-3 font-medium">Expires</th>
            <th className="border-b border-ink-100 px-5 py-3 text-right font-medium">
              {mode === "expired" ? "Lapsed" : "Status"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const d = daysUntil(m.expiryDate);
            return (
              <tr key={m.id}>
                <td className="sticky-col whitespace-nowrap border-b border-ink-50 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{m.name}</p>
                      <p className="truncate font-mono text-[11px] text-ink-500">
                        {m.id} · {m.phone}
                      </p>
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
                  {mode === "expired" ? (
                    <StatusBadge tone="danger" dot>
                      {Math.abs(d)} days ago
                    </StatusBadge>
                  ) : mode === "expiring" ? (
                    <StatusBadge tone="warn" dot>
                      {d <= 0
                        ? "Today"
                        : d === 1
                        ? "Tomorrow"
                        : `In ${d} days`}
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">In {d} days</StatusBadge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 font-mono text-xs font-semibold text-ink-700">
      {initials}
    </span>
  );
}
