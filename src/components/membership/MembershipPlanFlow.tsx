"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MembershipSeatMapSkeleton, ProfileIntakePanelSkeleton } from "@/components/ui/ContentSkeletons";
import { useActiveMembership } from "@/hooks/useActiveMembership";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import { floorLabel, type LibraryPlan, type PlanDurationKey } from "@/lib/plans/library-plans";
import { isPlanMonths, planCodeToKind } from "@/lib/plans/plan-checkout";
import ActiveMembershipBanner, { type ActiveMembership } from "./ActiveMembershipBanner";
import MembershipCheckoutButton from "./MembershipCheckoutButton";
import MembershipFlowSteps from "./MembershipFlowSteps";
import MembershipLegend from "./MembershipLegend";
import MembershipPayTipsDisclosure from "./MembershipPayTipsDisclosure";

const LongTermSeatMap = dynamic(() => import("./LongTermSeatMap"), {
  loading: () => <MembershipSeatMapSkeleton />,
});
const ShortTermSeatMap = dynamic(() => import("./ShortTermSeatMap"), {
  loading: () => <MembershipSeatMapSkeleton />,
});
const MembershipIntakeStepPanel = dynamic(() => import("./MembershipIntakeStepPanel"), {
  loading: () => <ProfileIntakePanelSkeleton />,
});

type Step = 1 | 2 | 3;

const MONTH_OPTIONS: { months: 1 | 3 | 6; key: PlanDurationKey; label: string }[] = [
  { months: 1, key: "1m", label: "1 month" },
  { months: 3, key: "3m", label: "3 months" },
  { months: 6, key: "6m", label: "6 months" },
];

function inr(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function MembershipPlanFlow() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() ?? "";

  const [plan, setPlan] = useState<LibraryPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [intakeKeepAlive, setIntakeKeepAlive] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [occupied, setOccupied] = useState<number[]>([]);
  const [months, setMonths] = useState<1 | 3 | 6>(() => {
    const m = Number(searchParams.get("months"));
    return isPlanMonths(m) ? m : 1;
  });
  const [membershipStartDate, setMembershipStartDate] = useState(() => todayYmdInTz(DEFAULT_LIBRARY_TZ));

  const { membership: hookMembership } = useActiveMembership();
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);

  const planKind = code ? planCodeToKind(code) : null;
  const isFloor1 = plan?.floor === 1;

  useEffect(() => {
    if (step >= 2) setIntakeKeepAlive(true);
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/public/plans");
        const j = (await res.json()) as { ok?: boolean; plans?: LibraryPlan[] };
        if (cancelled) return;
        const found = (j.plans ?? []).find((p) => p.code === code) ?? null;
        if (!found) {
          setLoadError("This plan is unavailable.");
        } else {
          setPlan(found);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load plan.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    queueMicrotask(() => {
      setActiveMembership(hookMembership ? (hookMembership as ActiveMembership) : null);
    });
  }, [hookMembership]);

  useEffect(() => {
    if (!code || !planKind) return;
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({
          planCode: code,
          startDate: membershipStartDate,
          months: String(months),
        });
        const res = await fetch(`/api/memberships/seat-occupancy?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const j = (await res.json()) as { ok?: boolean; seats?: number[] };
        if (!cancelled && res.ok && j.ok && Array.isArray(j.seats)) {
          setOccupied(j.seats);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, planKind, membershipStartDate, months]);

  const duration = useMemo(
    () => plan?.durations.find((d) => d.months === months) ?? null,
    [plan, months],
  );
  const occupiedSet = useMemo(() => new Set(occupied), [occupied]);
  const hasActive = activeMembership != null;

  const seatLabel =
    selected != null && planKind
      ? resolveMemberSeatDisplayLabel({ plan_kind: planKind, seat_number: selected })
      : "—";

  if (!loaded) {
    return <p className="mx-auto max-w-6xl px-4 py-12 text-sm text-ink-500">Loading plan…</p>;
  }

  if (!plan || !planKind) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-800">
          {loadError ?? "Plan not found."}
        </p>
        <div className="mt-4 text-center">
          <Link href="/#plans" className="text-sm font-medium text-azure-600 hover:text-azure-700">
            ← Back to plans
          </Link>
        </div>
      </div>
    );
  }

  const SeatMap = isFloor1 ? LongTermSeatMap : ShortTermSeatMap;
  const legendMode = isFloor1 ? "long" : "short";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
      <nav className="mb-5 hidden text-sm md:block">
        <Link href="/#plans" className="inline-flex items-center text-azure-600 hover:text-azure-700">
          ← Plans
        </Link>
      </nav>

      <header className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-azure-500">
          {floorLabel(plan.floor)} · {plan.accessLabel}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl md:text-4xl">
          {plan.name}
        </h1>
        <p className="mt-2 text-xs text-ink-500">Pick a seat, then your details and payment.</p>
      </header>

      {hasActive && activeMembership ? (
        <div className="mt-5 space-y-4">
          <ActiveMembershipBanner membership={activeMembership} />
          <p className="text-sm text-ink-600">
            You already have an active membership.{" "}
            <Link href={MEMBER_MEMBERSHIP_PATH} className="font-medium text-azure-600 hover:text-azure-700">
              View my membership
            </Link>
          </p>
        </div>
      ) : (
        <>
          <MembershipFlowSteps current={step} />

          {step === 1 ? (
            <div className="mt-5 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Duration</p>
                  <div className="mt-2 inline-flex rounded-full border border-ink-200 bg-ink-50 p-1">
                    {MONTH_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setMonths(o.months)}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                          months === o.months
                            ? "bg-white text-ink-900 shadow-sm"
                            : "text-ink-500 hover:text-ink-700"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="plan-start"
                    className="font-mono text-[10px] uppercase tracking-widest text-ink-500"
                  >
                    Start date
                  </label>
                  <input
                    id="plan-start"
                    type="date"
                    value={membershipStartDate}
                    min={todayYmdInTz(DEFAULT_LIBRARY_TZ)}
                    onChange={(e) => setMembershipStartDate(e.target.value)}
                    className="mt-2 block rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 outline-none focus:border-azure-500 focus:ring-2 focus:ring-azure-500/15"
                  />
                </div>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Seat colours</p>
                <div className="mt-2">
                  <MembershipLegend mode={legendMode} layout="strip" />
                </div>
              </div>

              <div id="seat-map" className="scroll-mt-24 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                    {isFloor1 ? "Floor map" : "Rows"}
                  </p>
                  <p className="font-mono text-xs text-ink-600">
                    Selected: <span className="font-semibold text-azure-600">{seatLabel}</span>
                  </p>
                </div>
                <SeatMap selected={selected} onSelect={setSelected} occupiedSeats={occupiedSet} />
              </div>

              <button
                type="button"
                disabled={selected == null}
                onClick={() => setStep(2)}
                onMouseEnter={() => void import("./MembershipIntakeStepPanel")}
                className="flex w-full min-h-12 items-center justify-center rounded-full bg-azure-500 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next: details &amp; documents
              </button>
            </div>
          ) : null}

          {intakeKeepAlive ? (
            <>
              <div className={step === 2 ? "mt-5 space-y-5" : "hidden"} aria-hidden={step !== 2}>
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">Your details &amp; optional ID</h2>
                  <p className="mt-1 text-xs text-ink-500">
                    Your answers stay on this device until payment; then they sync to your account.
                  </p>
                </div>
                <MembershipIntakeStepPanel deferPersist />
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="order-2 flex min-h-12 flex-1 items-center justify-center rounded-full border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50 sm:order-1 sm:max-w-xs"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="order-1 flex min-h-12 flex-1 items-center justify-center rounded-full bg-azure-500 px-5 text-sm font-semibold text-white hover:bg-azure-600 sm:order-2 sm:max-w-xs"
                  >
                    Next: pay
                  </button>
                </div>
              </div>

              {step === 3 ? (
                <div className="mt-5 space-y-5">
                  <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:p-5">
                    <h2 className="text-lg font-semibold text-ink-900">Review &amp; pay</h2>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-4 border-b border-ink-100 pb-3">
                        <dt className="text-ink-500">Plan</dt>
                        <dd className="text-ink-900">{plan.name}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-ink-100 pb-3">
                        <dt className="text-ink-500">Seat</dt>
                        <dd className="font-mono font-semibold text-ink-900">{seatLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-ink-100 pb-3">
                        <dt className="text-ink-500">Starts</dt>
                        <dd className="font-mono text-ink-900">{membershipStartDate}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-ink-100 pb-3">
                        <dt className="text-ink-500">Duration</dt>
                        <dd className="text-ink-900">{duration?.label ?? `${months} months`}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4 pt-1">
                        <dt className="text-ink-500">Total</dt>
                        <dd className="text-right">
                          <span className="font-semibold text-ink-900">₹{inr(duration?.price ?? 0)}</span>
                          {duration && duration.discountPercent > 0 ? (
                            <span className="ml-2 text-xs text-ink-400 line-through">₹{inr(duration.mrp)}</span>
                          ) : null}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <MembershipPayTipsDisclosure />

                  <MembershipCheckoutButton
                    planKind={planKind}
                    planCode={plan.code}
                    months={months}
                    seatNumber={selected}
                    membershipStartDate={membershipStartDate}
                    durationKey={`${months}m`}
                    durationLabel={duration?.label ?? `${months} months`}
                    quotedAmountRupees={duration?.price}
                    fullWidth
                    quietFooter
                  />

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex w-full min-h-12 items-center justify-center rounded-full border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                  >
                    Back to details
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
