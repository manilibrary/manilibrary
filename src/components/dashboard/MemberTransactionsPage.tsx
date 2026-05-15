"use client";

import { useEffect, useState } from "react";

import { TransactionsTableSkeleton } from "@/components/ui/ContentSkeletons";
import { useStaleWhileRevalidate } from "@/hooks/useStaleWhileRevalidate";
import { fetchMemberTransactions, type MemberTxRow } from "@/lib/client/fetch-member-transactions";
import { ddcKey } from "@/lib/client-data-cache";
import { createClient } from "@/lib/supabase/client";

function statusBadgeClass(status: string): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (status === "pending") return "bg-amber-100 text-amber-900 ring-amber-200";
  if (status === "failed") return "bg-red-100 text-red-900 ring-red-200";
  if (status === "refunded") return "bg-ink-100 text-ink-800 ring-ink-200";
  return "bg-ink-50 text-ink-700 ring-ink-200";
}

export default function MemberTransactionsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setAuthErr("Sign in to view your payment history.");
        setUserId(null);
        return;
      }
      setAuthErr(null);
      setUserId(user.id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    data: rows,
    loading,
    revalidating,
    error: loadErr,
  } = useStaleWhileRevalidate<MemberTxRow[]>({
    cacheKey: userId ? ddcKey.memberPayments(userId) : "",
    fetcher: fetchMemberTransactions,
    enabled: userId != null,
  });

  const list = rows ?? [];
  const err = authErr ?? loadErr;
  const showSkeleton = (userId == null && !authErr) || (loading && list.length === 0);

  const th =
    "border-b border-r border-ink-200 bg-ink-50/95 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500 last:border-r-0 sm:px-4";
  const td =
    "border-b border-r border-ink-100 px-3 py-3 align-top text-sm text-ink-800 last:border-r-0 sm:px-4";

  return (
    <div className="min-w-0 max-w-6xl space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-widest text-azure-500">Billing</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">Payment history</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-600">
          Membership checkouts through Razorpay. Use the Razorpay payment ID if you need support or to match your
          receipt.
        </p>
      </header>

      {showSkeleton ? <TransactionsTableSkeleton /> : null}
      {err && list.length === 0 ? (
        <p className="text-sm text-red-700" role="alert">
          {err}
        </p>
      ) : null}

      {!showSkeleton && !err && list.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-4 py-6 text-sm text-ink-600 shadow-sm">
          No Razorpay payments yet. When you complete a membership checkout, it will appear here.
        </p>
      ) : null}

      {list.length > 0 ? (
        <div className="space-y-2">
          {revalidating ? <p className="text-xs text-ink-500">Updating payment history…</p> : null}
          <p className="text-xs text-ink-500 lg:hidden">Swipe horizontally to see every column.</p>
          <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-sm ring-1 ring-black/[0.02]">
            <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[11.5rem]" />
                <col />
                <col className="w-[7.5rem]" />
                <col className="w-[6.5rem]" />
                <col className="min-w-[16rem] sm:min-w-[18rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    Date
                  </th>
                  <th scope="col" className={th}>
                    Membership
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Amount
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={th}>
                    Razorpay
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, index) => (
                  <tr
                    key={r.id}
                    className={
                      index % 2 === 0
                        ? "bg-white hover:bg-azure-50/50"
                        : "bg-ink-50/40 hover:bg-azure-50/50"
                    }
                  >
                    <td className={`${td} whitespace-nowrap font-mono text-xs text-ink-700`}>
                      {new Date(r.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className={td}>
                      {r.membership ? (
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium text-ink-900">{r.membership.planTitle}</p>
                          <p className="text-xs leading-snug text-ink-600">
                            <span className="text-ink-500">Seat</span>{" "}
                            <span className="font-mono text-ink-800">{r.membership.seatLabel}</span>
                            <span className="text-ink-400"> · </span>
                            <span className="whitespace-nowrap">{r.membership.windowLabel}</span>
                          </p>
                          <p className="text-[11px] text-ink-500">Membership {r.membership.status}</p>
                        </div>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-ink-900`}>
                      <span className="inline-block text-right">
                        ₹{r.amountRupees.toLocaleString("en-IN")}
                        <span className="pl-1 text-xs font-normal text-ink-500">{r.currency}</span>
                      </span>
                    </td>
                    <td className={td}>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className={`${td} font-mono text-[11px] leading-relaxed text-ink-800`}>
                      {r.razorpayPaymentId ? (
                        <p className="break-all">
                          <span className="font-sans text-ink-500">Payment </span>
                          {r.razorpayPaymentId}
                        </p>
                      ) : (
                        <p className="text-ink-400">{r.status === "paid" ? "—" : "After pay: pay_…"}</p>
                      )}
                      {r.razorpayOrderId ? (
                        <p className="mt-1.5 break-all">
                          <span className="font-sans text-ink-500">Order </span>
                          {r.razorpayOrderId}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
