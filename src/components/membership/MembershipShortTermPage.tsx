"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import { useActiveMembership } from "@/hooks/useActiveMembership";
import { CLIENT_SEAT_OCC_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";
import { fetchResumableCheckout, type ResumableCheckoutPayload } from "@/lib/membership/resumable-checkout";
import {
  SHORT_TERM_DURATION_OPTIONS,
  computeOrderAmountRupees,
  type ShortTermDurationKey,
} from "@/lib/payments/pricing";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import libraryInfo from "@/data/libraryInfo.json";
import ActiveMembershipBanner, { type ActiveMembership } from "./ActiveMembershipBanner";
import MembershipCheckoutButton from "./MembershipCheckoutButton";
import MembershipFlowSteps from "./MembershipFlowSteps";
import MembershipPendingCheckoutBanner from "./MembershipPendingCheckoutBanner";
import MembershipIntakeStepPanel from "./MembershipIntakeStepPanel";
import MembershipLegend from "./MembershipLegend";
import MembershipPayTipsDisclosure from "./MembershipPayTipsDisclosure";
import ShortTermSeatMap from "./ShortTermSeatMap";

type Step = 1 | 2 | 3;

export default function MembershipShortTermPage() {
  const searchParams = useSearchParams();
  const fromHub = searchParams.get("from") === "hub";
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [occupied, setOccupied] = useState<number[]>([]);
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [membershipStartDate, setMembershipStartDate] = useState(() => todayYmdInTz(DEFAULT_LIBRARY_TZ));
  const [durationKey, setDurationKey] = useState<ShortTermDurationKey>("st_1d");
  const [pendingResume, setPendingResume] = useState<ResumableCheckoutPayload | null>(null);
  const [dismissingResume, setDismissingResume] = useState(false);
  const { membership: hookMembership } = useActiveMembership();
  const durationLabel = useMemo(
    () => SHORT_TERM_DURATION_OPTIONS.find((o) => o.key === durationKey)?.label ?? durationKey,
    [durationKey],
  );
  const amountInr = useMemo(
    () => computeOrderAmountRupees("short_term", durationKey) ?? 0,
    [durationKey],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const start = searchParams.get("start");
      const dk = searchParams.get("durationKey");
      if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
        setMembershipStartDate(start);
      }
      if (dk && SHORT_TERM_DURATION_OPTIONS.some((o) => o.key === dk)) {
        setDurationKey(dk as ShortTermDurationKey);
      }
    });
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const occKey = ddcKey.seatOccupancy("short_term", membershipStartDate, durationKey);
    const cached = getClientCache<number[]>(occKey);
    queueMicrotask(() => {
      if (cached !== null && !cancelled) setOccupied(cached);
    });
    void (async () => {
      try {
        const params = new URLSearchParams({
          planKind: "short_term",
          startDate: membershipStartDate,
          durationKey,
        });
        const res = await fetch(`/api/memberships/seat-occupancy?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const j = (await res.json()) as { ok?: boolean; seats?: number[] };
        if (!cancelled && res.ok && j.ok && Array.isArray(j.seats)) {
          setOccupied(j.seats);
          setClientCache(occKey, j.seats, CLIENT_SEAT_OCC_CACHE_TTL_MS);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [membershipStartDate, durationKey]);

  useEffect(() => {
    queueMicrotask(() => {
      if (hookMembership) setActiveMembership(hookMembership as ActiveMembership);
      else setActiveMembership(null);
    });
  }, [hookMembership]);

  useEffect(() => {
    if (fromHub) {
      queueMicrotask(() => {
        setPendingResume(null);
        setStep(1);
      });
    }
  }, [fromHub]);

  useEffect(() => {
    if (fromHub) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetchResumableCheckout("short_term");
        if (cancelled || !r) return;
        setPendingResume(r);
        setSelected(r.seatNumber);
        setMembershipStartDate(r.membershipStartDate);
        setDurationKey(r.durationKey as ShortTermDurationKey);
        setStep(3);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromHub]);

  const resumeCheckoutForPay = useMemo(() => {
    if (!pendingResume) return null;
    if (
      selected === pendingResume.seatNumber &&
      membershipStartDate === pendingResume.membershipStartDate &&
      durationKey === pendingResume.durationKey
    ) {
      return {
        paymentId: pendingResume.paymentId,
        orderId: pendingResume.orderId,
        amount: pendingResume.amount,
        currency: pendingResume.currency,
        keyId: pendingResume.keyId,
        fingerprint: pendingResume.fingerprint,
      };
    }
    return null;
  }, [pendingResume, selected, membershipStartDate, durationKey]);

  const dismissPendingResume = useCallback(async () => {
    if (!pendingResume) return;
    setDismissingResume(true);
    try {
      await fetch("/api/payments/razorpay/mark-checkout-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          payment_id: pendingResume.paymentId,
          error: { description: "Member chose to start over" },
        }),
      });
      setPendingResume(null);
      setStep(1);
      setSelected(null);
    } finally {
      setDismissingResume(false);
    }
  }, [pendingResume]);

  const occupiedSet = useMemo(() => new Set(occupied), [occupied]);
  const hasActive = activeMembership != null;
  const seatLabel =
    selected != null
      ? resolveMemberSeatDisplayLabel({ plan_kind: "short_term", seat_number: selected })
      : "—";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
      <nav className="mb-5 hidden text-sm md:block">
        <Link href="/membership" className="inline-flex items-center text-azure-600 hover:text-azure-700">
          ← Membership
        </Link>
      </nav>

      <header className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-azure-500">Short-term</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl md:text-4xl">
          Choose your desk — row hall
        </h1>
        <p className="mt-2 text-xs text-ink-500">Pick a seat, then your details and payment.</p>
      </header>

      {hasActive && activeMembership ? (
        <div className="mt-5">
          <ActiveMembershipBanner membership={activeMembership} />
        </div>
      ) : null}

      {!hasActive ? (
        <>
          <MembershipFlowSteps current={step} />

          {pendingResume ? (
            <div className="mt-5">
              <MembershipPendingCheckoutBanner
                resume={pendingResume}
                durationLabel={
                  SHORT_TERM_DURATION_OPTIONS.find((o) => o.key === pendingResume.durationKey)?.label ??
                  pendingResume.durationKey
                }
                onDismiss={dismissPendingResume}
                dismissing={dismissingResume}
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="mt-5 space-y-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Seat colours</p>
                <div className="mt-2">
                  <MembershipLegend mode="short" layout="strip" />
                </div>
              </div>

              <div id="seat-map" className="scroll-mt-24 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Rows</p>
                    <p className="text-xs text-ink-600 sm:text-sm">{libraryInfo.name} · short-term</p>
                  </div>
                  <p className="font-mono text-xs text-ink-600">
                    Selected: <span className="font-semibold text-azure-600">{selected ?? "—"}</span>
                  </p>
                </div>
                <ShortTermSeatMap selected={selected} onSelect={setSelected} occupiedSeats={occupiedSet} />
              </div>

              <button
                type="button"
                disabled={selected == null}
                onClick={() => setStep(2)}
                className="flex w-full min-h-12 items-center justify-center rounded-full bg-azure-500 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-azure-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next: details &amp; documents
              </button>
            </div>
          ) : null}

          {(step === 2 || step === 3) && (
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
                    <dt className="text-ink-500">Seat</dt>
                    <dd className="font-mono font-semibold text-ink-900">{seatLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-ink-100 pb-3">
                    <dt className="text-ink-500">Starts</dt>
                    <dd className="font-mono text-ink-900">{membershipStartDate}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-ink-100 pb-3">
                    <dt className="text-ink-500">Duration</dt>
                    <dd className="text-ink-900">{durationLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4 pt-1">
                    <dt className="text-ink-500">Total</dt>
                    <dd className="font-semibold text-ink-900">
                      ₹{amountInr.toLocaleString("en-IN")}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-ink-500">
                  Need different dates or duration?{" "}
                  <Link href="/membership" className="font-medium text-azure-600 hover:text-azure-700">
                    Change on the membership hub
                  </Link>{" "}
                  ({DEFAULT_LIBRARY_TZ}).
                </p>
              </div>

              <MembershipPayTipsDisclosure />

              <MembershipCheckoutButton
                planKind="short_term"
                seatNumber={selected}
                membershipStartDate={membershipStartDate}
                durationKey={durationKey}
                durationLabel={durationLabel}
                fullWidth
                quietFooter
                resumeCheckout={resumeCheckoutForPay}
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
          )}
        </>
      ) : (
        <div className="mt-6 space-y-4">
          <MembershipLegend mode="short" layout="strip" />
          <div id="seat-map" className="scroll-mt-24 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Rows</p>
              <p className="font-mono text-xs text-ink-500">
                Selected: <span className="font-semibold text-azure-600">{selected ?? "—"}</span>
              </p>
            </div>
            <ShortTermSeatMap selected={selected} onSelect={setSelected} occupiedSeats={occupiedSet} />
          </div>
          <div className="flex flex-col gap-3 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-600">You already have an active pass. Payment is hidden.</p>
            <Link
              href={MEMBER_MEMBERSHIP_PATH}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-emerald-200 bg-white px-5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              My membership
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
