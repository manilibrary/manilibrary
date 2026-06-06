"use client";

import { useCallback, useEffect, useState } from "react";

import { COUPON_PLAN_CODES, type LibraryCoupon } from "@/lib/coupons/library-coupons";
import { PLAN_CODE_NAMES } from "@/lib/plans/library-plans";
import { formatDateTimeDdMmYyyy } from "@/lib/date-format";

const DISCOUNT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

function CouponRow({ c }: { c: LibraryCoupon }) {
  return (
    <tr className="border-t border-ink-50">
      <td className="py-2 pr-3 font-mono text-sm font-semibold text-ink-900">{c.code}</td>
      <td className="py-2 pr-3 text-ink-700">{c.planName}</td>
      <td className="py-2 pr-3 font-semibold text-emerald-700">{c.discountPercent}% off</td>
      <td className="py-2 text-xs text-ink-500">
        {c.status === "used" ? `Used ${c.usedAt ? formatDateTimeDdMmYyyy(c.usedAt) : ""}` : "Active"}
      </td>
    </tr>
  );
}

export default function StaffCouponsPanel() {
  const [coupons, setCoupons] = useState<LibraryCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [discount, setDiscount] = useState<number>(10);
  const [planCode, setPlanCode] = useState<string>(COUPON_PLAN_CODES[0]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/coupons", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; error?: string; coupons?: LibraryCoupon[] };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not load coupons.");
      setCoupons(j.coupons ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountPercent: discount, planCode }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; coupon?: LibraryCoupon };
      if (!res.ok || !j.ok || !j.coupon) throw new Error(j.error ?? "Could not generate coupon.");
      setCoupons((prev) => [j.coupon!, ...prev]);
      setMsg(`Coupon ${j.coupon.code} generated.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate coupon.");
    } finally {
      setBusy(false);
    }
  };

  const active = coupons.filter((c) => c.status === "active");
  const used = coupons.filter((c) => c.status === "used");

  return (
    <div className="space-y-5">
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-ink-900">Generate new coupon</h3>
        <p className="mt-1 text-xs text-ink-500">Single-use code (MANI + 4 hex). Pick a discount and the plan it applies to.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs text-ink-600">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-500">Discount</span>
            <select
              value={discount}
              disabled={busy}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-2 focus:ring-azure-500/15 disabled:opacity-50"
            >
              {DISCOUNT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}% off
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-600">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink-500">Applicable plan</span>
            <select
              value={planCode}
              disabled={busy}
              onChange={(e) => setPlanCode(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-2 focus:ring-azure-500/15 disabled:opacity-50"
            >
              {COUPON_PLAN_CODES.map((code) => (
                <option key={code} value={code}>
                  {PLAN_CODE_NAMES[code] ?? code}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={generate}
            className="rounded-full bg-azure-500 px-4 py-2 text-xs font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate new coupon"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-500">Loading coupons…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <CouponTable title="Active coupons" rows={active} emptyText="No active coupons yet." />
          <CouponTable title="Used coupons" rows={used} emptyText="No coupons used yet." />
        </div>
      )}
    </div>
  );
}

function CouponTable({ title, rows, emptyText }: { title: string; rows: LibraryCoupon[]; emptyText: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-ink-900">
        {title} <span className="font-normal text-ink-400">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-ink-500">{emptyText}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <th className="pb-2 pr-3 font-medium">Code</th>
                <th className="pb-2 pr-3 font-medium">Plan</th>
                <th className="pb-2 pr-3 font-medium">Discount</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <CouponRow key={c.id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
