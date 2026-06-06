"use client";

import { useEffect, useMemo, useState } from "react";
import PlanChooseCTA from "@/components/landing/PlanChooseCTA";
import { HOME_SECTION_PAD } from "@/lib/landing/home-section-spacing";
import {
  PLAN_DURATIONS,
  floorLabel,
  type LibraryPlan,
  type PlanDurationKey,
} from "@/lib/plans/library-plans";

const CURRENCY = "₹";

function inr(n: number): string {
  return n.toLocaleString("en-IN");
}

function PlanCard({
  plan,
  durationKey,
  popular,
}: {
  plan: LibraryPlan;
  durationKey: PlanDurationKey;
  popular: boolean;
}) {
  const d = plan.durations.find((x) => x.key === durationKey) ?? plan.durations[0];
  const hasDiscount = d.discountPercent > 0 && d.mrp > d.price;

  return (
    <article
      className={`relative flex flex-col rounded-2xl border bg-white p-6 ${
        popular
          ? "border-azure-500 shadow-card-hover ring-1 ring-azure-500"
          : "border-ink-100 shadow-card"
      }`}
    >
      {popular ? (
        <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-azure-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
          Most popular
        </span>
      ) : null}

      <header>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-ink-50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-ink-500">
            {floorLabel(plan.floor)}
          </span>
          {hasDiscount ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              {d.discountPercent}% off
            </span>
          ) : null}
        </div>

        <h3 className="mt-3 text-lg font-semibold text-ink-900">{plan.name}</h3>
        <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-ink-500">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          {plan.accessLabel}
        </p>

        <div className="mt-4">
          <p className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-ink-900">
              {CURRENCY}
              {inr(d.price)}
            </span>
            <span className="text-sm text-ink-500">/ {d.label}</span>
          </p>
          {hasDiscount ? (
            <p className="mt-1 text-sm text-ink-400">
              <span className="line-through">
                {CURRENCY}
                {inr(d.mrp)}
              </span>{" "}
              <span className="text-emerald-600">
                Save {CURRENCY}
                {inr(d.mrp - d.price)}
              </span>
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-auto">
        <PlanChooseCTA planName={plan.name} planCode={plan.code} months={d.months} popular={popular} />
      </div>
    </article>
  );
}

export default function PlansSection() {
  const [plans, setPlans] = useState<LibraryPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [durationKey, setDurationKey] = useState<PlanDurationKey>("1m");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/plans");
        const j = (await res.json()) as { ok?: boolean; plans?: LibraryPlan[] };
        if (!cancelled && res.ok && j.ok) setPlans(j.plans ?? []);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const popularCode = useMemo(() => {
    const fixed = plans.find((p) => p.is24Hour);
    return fixed?.code ?? null;
  }, [plans]);

  return (
    <section id="plans" className="bg-white">
      <div className={`mx-auto max-w-7xl ${HOME_SECTION_PAD}`}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-azure-500">Membership</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
            Simple plans, no surprises.
          </h2>
          <p className="mt-4 text-base text-ink-600">
            Shift seats on the 2nd floor, or a reserved 24-hour seat on the 1st floor.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-ink-200 bg-ink-50 p-1">
            {PLAN_DURATIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDurationKey(d.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  durationKey === d.key
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-500 hover:text-ink-700"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {!loaded ? (
          <p className="mt-12 text-center text-sm text-ink-500">Loading plans…</p>
        ) : plans.length === 0 ? (
          <p className="mt-12 rounded-2xl border border-dashed border-ink-200 bg-surface-muted px-6 py-10 text-center text-sm text-ink-600">
            Plans coming soon.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                durationKey={durationKey}
                popular={plan.code === popularCode}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
