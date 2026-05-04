import PageHeader from "@/components/dashboard/PageHeader";
import StatusBadge from "@/components/dashboard/StatusBadge";
import TableScroll from "@/components/dashboard/TableScroll";
import {
  formatCurrency,
  formatDate,
  getMembers,
  getStats,
  planName,
} from "@/lib/members";

export const metadata = { title: "Payments" };

export default function PaymentsPage() {
  const members = getMembers();
  const stats = getStats();

  const sorted = [...members].sort(
    (a, b) =>
      new Date(b.lastPayment.date).getTime() -
      new Date(a.lastPayment.date).getTime()
  );

  const dueList = members.filter(
    (m) => m.paymentStatus === "due" || m.paymentStatus === "overdue"
  );

  const collected = members
    .filter((m) => m.paymentStatus === "paid")
    .reduce((sum, m) => sum + m.lastPayment.amount, 0);

  const outstanding = dueList.reduce(
    (sum, m) => sum + m.lastPayment.amount,
    0
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="payments"
        title="Payments"
        description="Track collections, dues, and payment history."
        actions={
          <button
            type="button"
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
            Record payment
          </button>
        }
      />

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Collected this month"
          value={formatCurrency(stats.monthlyRevenue)}
          hint={`${stats.total - dueList.length} of ${stats.total} members paid`}
          tone="azure"
        />
        <Tile
          label="Outstanding"
          value={formatCurrency(outstanding)}
          hint={`${dueList.length} members pending`}
        />
        <Tile
          label="Lifetime collected"
          value={formatCurrency(collected)}
          hint="Across all active receipts"
        />
      </section>

      {/* Outstanding */}
      <section className="rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Outstanding payments
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Members with dues or overdue invoices.
            </p>
          </div>
          <span className="font-mono text-xs text-ink-500">
            {dueList.length} pending
          </span>
        </div>

        <TableScroll>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <th className="sticky-col border-b border-ink-100 px-5 py-3 font-medium">Member</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Plan</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Status</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Last payment</th>
                <th className="border-b border-ink-100 px-5 py-3 text-right font-medium">Amount due</th>
              </tr>
            </thead>
            <tbody>
              {dueList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-ink-500">
                    All payments collected. Nothing pending.
                  </td>
                </tr>
              ) : (
                dueList.map((m) => (
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
                    <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3">
                      {m.paymentStatus === "overdue" ? (
                        <StatusBadge tone="danger" dot>Overdue</StatusBadge>
                      ) : (
                        <StatusBadge tone="warn" dot>Due</StatusBadge>
                      )}
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3 text-ink-600">
                      {formatDate(m.lastPayment.date)}
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-5 py-3 text-right">
                      <p className="font-mono font-semibold text-ink-900">
                        {formatCurrency(m.lastPayment.amount)}
                      </p>
                      <button
                        type="button"
                        className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-azure-500 hover:text-azure-600"
                      >
                        Send reminder →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
      </section>

      {/* History */}
      <section className="rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="border-b border-ink-100 px-6 py-4">
          <h2 className="text-base font-semibold text-ink-900">
            Payment history
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Most recent payments across all members.
          </p>
        </div>

        <TableScroll>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <th className="sticky-col border-b border-ink-100 px-5 py-3 font-medium">Receipt</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Member</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Plan</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Method</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Date</th>
                <th className="border-b border-ink-100 px-5 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => (
                <tr key={m.id}>
                  <td className="sticky-col whitespace-nowrap border-b border-ink-50 px-5 py-3 font-mono text-xs text-ink-600">
                    RCT-{(2000 + i).toString().padStart(4, "0")}
                  </td>
                  <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} small />
                      <span className="font-medium text-ink-800">{m.name}</span>
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

function Tile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "azure";
}) {
  return (
    <article
      className={`rounded-2xl border p-6 shadow-card ${
        tone === "azure"
          ? "border-azure-200 bg-azure-50/50"
          : "border-ink-100 bg-white"
      }`}
    >
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink-900">
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 font-mono text-[11px] text-ink-500">{hint}</p>
      )}
    </article>
  );
}

function Avatar({ name, small }: { name: string; small?: boolean }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-ink-100 font-mono font-semibold text-ink-700 ${
        small ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs"
      }`}
    >
      {initials}
    </span>
  );
}
