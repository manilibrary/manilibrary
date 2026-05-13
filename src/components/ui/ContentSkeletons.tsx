/** Shared pulse placeholders for client-side data loading. */

const pulse = "animate-pulse rounded bg-ink-100";

export function MembershipHubRouteSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading membership hub">
      <div className="space-y-3">
        <div className={`h-4 w-40 ${pulse}`} />
        <div className={`h-9 w-full max-w-sm ${pulse}`} />
        <div className={`h-4 w-full max-w-md ${pulse}`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`h-36 rounded-2xl ${pulse}`} />
        <div className={`h-36 rounded-2xl ${pulse}`} />
      </div>
      <div className={`h-24 rounded-2xl ${pulse}`} />
    </div>
  );
}

export function TransactionsTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-sm ring-1 ring-black/[0.02]" aria-busy="true" aria-label="Loading payment history">
      <table className="w-full min-w-[920px] table-fixed border-collapse">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50/95">
            {[1, 2, 3, 4, 5].map((i) => (
              <th key={i} className="px-4 py-3 text-left">
                <div className={`h-3 w-16 ${pulse}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4].map((r) => (
            <tr key={r} className={r % 2 === 0 ? "bg-white" : "bg-ink-50/40"}>
              <td className="border-b border-ink-100 px-4 py-4">
                <div className={`h-4 w-28 ${pulse}`} />
              </td>
              <td className="border-b border-ink-100 px-4 py-4">
                <div className={`h-4 w-full max-w-[14rem] ${pulse}`} />
              </td>
              <td className="border-b border-ink-100 px-4 py-4">
                <div className={`ml-auto h-4 w-16 ${pulse}`} />
              </td>
              <td className="border-b border-ink-100 px-4 py-4">
                <div className={`h-6 w-20 rounded-full ${pulse}`} />
              </td>
              <td className="border-b border-ink-100 px-4 py-4">
                <div className={`h-4 w-full ${pulse}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProfileIntakePanelSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm" aria-busy="true" aria-label="Loading profile">
      <div className={`h-5 w-48 ${pulse}`} />
      <div className="space-y-3">
        <div className={`h-10 w-full ${pulse}`} />
        <div className={`h-10 w-full ${pulse}`} />
        <div className={`h-24 w-full ${pulse}`} />
      </div>
      <div className={`h-11 w-40 rounded-full ${pulse}`} />
    </div>
  );
}

export function MembershipGreetingSkeleton() {
  return (
    <div className="mb-8 rounded-2xl border border-ink-100 bg-white/80 px-5 py-4 shadow-sm" aria-busy="true" aria-label="Checking membership">
      <div className={`h-3 w-44 ${pulse}`} />
      <div className="mt-3 space-y-2">
        <div className={`h-4 w-full max-w-md ${pulse}`} />
        <div className={`h-4 w-full max-w-sm ${pulse}`} />
      </div>
    </div>
  );
}

export function TopbarUserTextSkeleton() {
  return (
    <span className="flex flex-col gap-1.5 py-0.5" aria-busy="true" aria-label="Loading account">
      <span className={`h-3.5 w-[4.5rem] ${pulse}`} />
      <span className={`h-3 w-36 max-w-[10rem] ${pulse}`} />
    </span>
  );
}

export function MemberMembershipCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Loading memberships">
      <div className={`h-48 rounded-2xl ${pulse}`} />
      <div className={`h-48 rounded-2xl ${pulse}`} />
    </div>
  );
}

export function KycDocListSkeleton() {
  return (
    <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100" aria-busy="true" aria-label="Loading documents">
      {[0, 1, 2].map((i) => (
        <li key={i} className="bg-white px-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className={`h-4 w-32 ${pulse}`} />
            <div className={`h-7 w-16 rounded-full ${pulse}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TableBodySkeleton({
  rows = 5,
  cols = 8,
  tdClass = "px-3 py-3",
}: {
  rows?: number;
  cols?: number;
  tdClass?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="animate-pulse">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className={tdClass}>
              <div className={`h-4 rounded bg-ink-100`} style={{ width: `${55 + ((ri + ci) % 5) * 8}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function PaymentCompleteSkeleton() {
  return (
    <div className="mx-auto mt-6 max-w-md space-y-3" aria-busy="true" aria-label="Confirming payment">
      <div className={`mx-auto h-2 w-full max-w-sm ${pulse}`} />
      <div className={`mx-auto h-2 w-full max-w-xs ${pulse}`} />
      <div className={`mx-auto h-2 w-full max-w-[12rem] ${pulse}`} />
    </div>
  );
}

export function AttendanceTodaySkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-200 bg-white" aria-busy="true" aria-label="Loading attendance">
      <div className="border-b border-ink-200 bg-ink-50/90 px-3 py-2">
        <div className={`h-4 w-32 ${pulse}`} />
        <div className={`mt-2 h-3 w-full max-w-lg ${pulse}`} />
      </div>
      <div className="p-3">
        <table className="w-full min-w-[560px] border-collapse">
          <tbody>
            <TableBodySkeleton rows={1} cols={7} tdClass="px-3 py-3" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SuperadminHealthSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading health checks">
      <div className={`h-4 w-24 ${pulse}`} />
      <div className={`h-3 w-full ${pulse}`} />
      <div className={`h-3 w-full max-w-md ${pulse}`} />
      <div className={`h-3 w-full max-w-xs ${pulse}`} />
    </div>
  );
}
