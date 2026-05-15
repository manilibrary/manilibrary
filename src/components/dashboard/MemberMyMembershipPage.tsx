"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  MemberActiveMembershipCards,
  type MemberActivePlanRow,
  memberMembershipEndMs,
  memberMembershipValidityEndedByDate,
} from "@/components/dashboard/MemberActiveMembershipCards";
import { useMemberMeBootstrap } from "@/components/dashboard/MemberMeBootstrapProvider";
import { MemberMembershipCardsSkeleton } from "@/components/ui/ContentSkeletons";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import { createClient } from "@/lib/supabase/client";

function RecoverPaymentBlock(props: {
  recoverId: string;
  setRecoverId: (v: string) => void;
  recoverBusy: boolean;
  recoverMsg: string | null;
  recoverErr: string | null;
  onSync: () => void;
}) {
  const { recoverId, setRecoverId, recoverBusy, recoverMsg, recoverErr, onSync } = props;
  return (
    <div className="min-w-0 rounded-2xl border border-dashed border-ink-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-ink-900">Recover payment</h3>
      <p className="mt-2 text-xs leading-relaxed text-ink-600">
        If Razorpay shows <strong className="text-ink-800">Paid</strong> but you still see no active plan, paste the{" "}
        <strong>Payment ID</strong> from the receipt (e.g. <span className="font-mono">pay_SoN4…</span>).
      </p>
      <p className="mt-2 text-xs text-ink-500">
        <strong className="text-ink-700">Amounts:</strong> stored as whole rupees in{" "}
        <span className="font-mono">amount_rupees</span> (e.g. <span className="font-mono">500</span> = ₹500).
      </p>
      {recoverErr ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {recoverErr}
        </p>
      ) : null}
      {recoverMsg ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {recoverMsg}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-xs text-ink-600">
          Razorpay Payment ID
          <input
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
            placeholder="pay_…"
            value={recoverId}
            onChange={(e) => setRecoverId(e.target.value.trim())}
          />
        </label>
        <button
          type="button"
          disabled={recoverBusy || !recoverId.startsWith("pay_")}
          onClick={onSync}
          className="shrink-0 rounded-full bg-azure-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
        >
          {recoverBusy ? "Working…" : "Sync"}
        </button>
      </div>
    </div>
  );
}

export default function MemberMyMembershipPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paid = searchParams.get("paid") === "1";

  const boot = useMemberMeBootstrap();
  const bootRef = useRef(boot);
  useEffect(() => {
    bootRef.current = boot;
  }, [boot]);

  const [rows, setRows] = useState<MemberActivePlanRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recoverId, setRecoverId] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [recoverErr, setRecoverErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const useCache = refreshKey === 0;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const b = bootRef.current;
        if (useCache && b.ready && !b.skipped && b.memberUserId === user.id && b.membershipRows != null) {
          setRows(b.membershipRows);
          setLoadError(b.membershipError);
          setBootstrap(false);
        }

        const kMem = ddcKey.memberships(user.id);
        if (useCache) {
          const hit = getClientCache<MemberActivePlanRow[]>(kMem);
          if (hit) setRows(hit);
        }

        const { data, error } = await supabase
          .from("memberships")
          .select("id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setLoadError(null);
        const nextRows = (data ?? []) as MemberActivePlanRow[];
        setRows(nextRows);
        setClientCache(kMem, nextRows, CLIENT_DATA_CACHE_TTL_MS);
      } finally {
        if (!cancelled) setBootstrap(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!paid) return;
    const t = window.setTimeout(() => {
      router.replace("/dashboard/me/my-membership", { scroll: false });
    }, 4000);
    return () => window.clearTimeout(t);
  }, [paid, router]);

  const sortByEndDesc = (a: MemberActivePlanRow, b: MemberActivePlanRow) =>
    memberMembershipEndMs(b) - memberMembershipEndMs(a);

  const currentPlans = rows
    .filter((r) => r.status === "active" && !memberMembershipValidityEndedByDate(r))
    .sort(sortByEndDesc);

  const pastPlans = rows
    .filter(
      (r) =>
        r.status !== "pending_payment" &&
        (r.status !== "active" || memberMembershipValidityEndedByDate(r)),
    )
    .sort(sortByEndDesc);

  const runRecover = () => {
    setRecoverErr(null);
    setRecoverMsg(null);
    setRecoverBusy(true);
    void (async () => {
      try {
        const res = await fetch("/api/payments/razorpay/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ razorpay_payment_id: recoverId.trim() }),
        });
        const j = (await res.json()) as { error?: string; hint?: string; ok?: boolean };
        if (!res.ok) {
          const parts = [j.error, j.hint].filter(Boolean);
          throw new Error(parts.length ? parts.join(" — ") : "Could not reconcile.");
        }
        setRecoverMsg("Synced. Refreshing…");
        setRecoverId("");
        setRefreshKey((k) => k + 1);
      } catch (e) {
        setRecoverErr(e instanceof Error ? e.message : "Failed");
      } finally {
        setRecoverBusy(false);
      }
    })();
  };

  return (
    <div className="space-y-8">
      {paid ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Payment received. Your active membership and seat are shown below (this message clears in a few seconds).
        </p>
      ) : null}

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
      ) : null}

      <section className="space-y-4" aria-labelledby="current-membership">
        <h2 id="current-membership" className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          Current membership
        </h2>

        {bootstrap && !loadError ? (
          <MemberMembershipCardsSkeleton />
        ) : currentPlans.length > 0 ? (
          <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
            <div className="min-w-0 flex-1">
              <MemberActiveMembershipCards plans={currentPlans} />
            </div>
            <div className="w-full shrink-0 xl:max-w-sm">
              <RecoverPaymentBlock
                recoverId={recoverId}
                setRecoverId={setRecoverId}
                recoverBusy={recoverBusy}
                recoverMsg={recoverMsg}
                recoverErr={recoverErr}
                onSync={runRecover}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
              <p className="text-sm leading-relaxed text-ink-600">
                No active membership on file yet. After a successful Razorpay payment, your seat and dates appear here.
                If you saw “payment successful” only on Razorpay&apos;s site, use{" "}
                <strong className="font-medium text-ink-800">Recover payment</strong> with your{" "}
                <span className="font-mono text-xs">pay_…</span> id, or start checkout again from{" "}
                <Link href="/membership/long-term" className="font-medium text-azure-600 hover:text-azure-700">
                  membership
                </Link>
                .
              </p>
              <Link href="/#plans" className="mt-4 inline-flex text-sm font-medium text-azure-600 hover:text-azure-700">
                View membership plans →
              </Link>
            </div>
            <RecoverPaymentBlock
              recoverId={recoverId}
              setRecoverId={setRecoverId}
              recoverBusy={recoverBusy}
              recoverMsg={recoverMsg}
              recoverErr={recoverErr}
              onSync={runRecover}
            />
          </div>
        )}
      </section>

      {!bootstrap && pastPlans.length > 0 ? (
        <section className="space-y-4" aria-labelledby="past-membership">
          <h2 id="past-membership" className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Past membership
          </h2>
          <MemberActiveMembershipCards plans={pastPlans} variant="past" showViewPlansLink={false} />
        </section>
      ) : null}
    </div>
  );
}
