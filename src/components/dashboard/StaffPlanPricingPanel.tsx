"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PLAN_PRICE_FIELDS,
  discountPercent,
  floorLabel,
  type LibraryPlan,
  type PlanPriceField,
} from "@/lib/plans/library-plans";

type AdminPlan = LibraryPlan & { isActive: boolean };

type DraftFields = Record<PlanPriceField, string>;

function planToDraft(plan: LibraryPlan): DraftFields {
  const byKey = Object.fromEntries(plan.durations.map((d) => [d.key, d]));
  return {
    price_1m: String(byKey["1m"]?.price ?? 0),
    mrp_1m: String(byKey["1m"]?.mrp ?? 0),
    price_3m: String(byKey["3m"]?.price ?? 0),
    mrp_3m: String(byKey["3m"]?.mrp ?? 0),
    price_6m: String(byKey["6m"]?.price ?? 0),
    mrp_6m: String(byKey["6m"]?.mrp ?? 0),
  };
}

const DURATION_ROWS: { label: string; price: PlanPriceField; mrp: PlanPriceField }[] = [
  { label: "1 month", price: "price_1m", mrp: "mrp_1m" },
  { label: "3 months", price: "price_3m", mrp: "mrp_3m" },
  { label: "6 months", price: "price_6m", mrp: "mrp_6m" },
];

function PlanRow({
  plan,
  busy,
  onSave,
  onToggleActive,
}: {
  plan: AdminPlan;
  busy: boolean;
  onSave: (id: string, fields: Record<PlanPriceField, number>) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState<DraftFields>(() => planToDraft(plan));

  useEffect(() => {
    setDraft(planToDraft(plan));
  }, [plan]);

  const set = (field: PlanPriceField, value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const save = () => {
    const fields = {} as Record<PlanPriceField, number>;
    for (const f of PLAN_PRICE_FIELDS) fields[f] = Math.round(Number(draft[f]) || 0);
    void onSave(plan.id, fields);
  };

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">{plan.name}</h3>
          <p className="mt-1 text-xs text-ink-500">
            {floorLabel(plan.floor)} · {plan.accessLabel}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-ink-600">
          <input
            type="checkbox"
            checked={plan.isActive}
            disabled={busy}
            onChange={(e) => void onToggleActive(plan.id, e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-azure-500 focus:ring-azure-500"
          />
          {plan.isActive ? "Active" : "Hidden"}
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <th className="pb-2 pr-3 font-medium">Duration</th>
              <th className="pb-2 pr-3 font-medium">Price (₹)</th>
              <th className="pb-2 pr-3 font-medium">MRP (₹)</th>
              <th className="pb-2 font-medium">Discount</th>
            </tr>
          </thead>
          <tbody>
            {DURATION_ROWS.map((row) => {
              const price = Math.round(Number(draft[row.price]) || 0);
              const mrp = Math.round(Number(draft[row.mrp]) || 0);
              const pct = discountPercent(mrp, price);
              const invalid = mrp < price;
              return (
                <tr key={row.label} className="border-t border-ink-50">
                  <td className="py-2 pr-3 text-ink-700">{row.label}</td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft[row.price]}
                      disabled={busy}
                      onChange={(e) => set(row.price, e.target.value)}
                      className="w-24 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-2 focus:ring-azure-500/15 disabled:opacity-50"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft[row.mrp]}
                      disabled={busy}
                      onChange={(e) => set(row.mrp, e.target.value)}
                      className={`w-24 rounded-lg border px-2.5 py-1.5 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-azure-500/15 disabled:opacity-50 ${
                        invalid ? "border-red-300 focus:border-red-500" : "border-ink-200 focus:border-azure-500"
                      }`}
                    />
                  </td>
                  <td className="py-2 text-xs">
                    {invalid ? (
                      <span className="text-red-600">MRP &lt; price</span>
                    ) : pct > 0 ? (
                      <span className="font-semibold text-emerald-700">{pct}% off</span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="mt-4 rounded-full bg-azure-500 px-4 py-2 text-xs font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
      >
        Save prices
      </button>
    </div>
  );
}

export default function StaffPlanPricingPanel() {
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/plans", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; error?: string; plans?: AdminPlan[] };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not load plans.");
      setPlans(j.plans ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchPlan = async (id: string, patch: Record<string, number | boolean>, okMsg: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; plan?: AdminPlan };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not save.");
      if (j.plan) {
        setPlans((prev) => prev.map((p) => (p.id === id ? j.plan! : p)));
      }
      setMsg(okMsg);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const savePrices = async (id: string, fields: Record<PlanPriceField, number>) => {
    await patchPlan(id, fields, "Prices saved.");
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await patchPlan(id, { is_active: isActive }, isActive ? "Plan shown." : "Plan hidden.");
  };

  if (loading) {
    return <p className="text-sm text-ink-500">Loading plans…</p>;
  }

  return (
    <div className="space-y-4">
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
      {plans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 bg-surface-muted px-6 py-10 text-center text-sm text-ink-600">
          No plans found. Run the library_plans migration.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              busy={busy}
              onSave={savePrices}
              onToggleActive={toggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
