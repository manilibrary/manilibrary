"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDaysYmd, DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import { fetchResumableCheckout, type ResumableCheckoutPayload } from "@/lib/membership/resumable-checkout";
import {
  computeOrderAmountRupees,
  LONG_TERM_DURATION_OPTIONS,
  MAIN_HALL_PRICE_PER_MONTH,
  ROW_HALL_PRICE_PER_MONTH,
  SHORT_TERM_DURATION_OPTIONS,
  type LongTermDurationKey,
  type ShortTermDurationKey,
} from "@/lib/payments/pricing";
import MembershipHubGreeting from "./MembershipHubGreeting";

type MonthChoice = 1 | 3 | 6;
type DailyHours = 12 | 6;

function longTermKeyForMonths(m: MonthChoice): LongTermDurationKey {
  if (m === 1) return "lt_1m";
  if (m === 3) return "lt_3m";
  return "lt_6m";
}

function shortHubKeyForMonths(m: MonthChoice): ShortTermDurationKey {
  if (m === 1) return "st_hub_1m";
  if (m === 3) return "st_hub_3m";
  return "st_hub_6m";
}

function SegmentedRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-ink-500">{label}</p>
      <div
        className="flex rounded-xl bg-ink-100/90 p-1 shadow-inner"
        role="tablist"
        aria-label={label}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(o.value)}
              className={`flex-1 rounded-lg px-2 py-2.5 text-center text-[13px] font-semibold transition sm:px-3 sm:text-sm ${
                active ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MembershipHubClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = todayYmdInTz(DEFAULT_LIBRARY_TZ);
  const maxStart = addDaysYmd(today, 120);

  const [membershipStartDate, setMembershipStartDate] = useState(today);
  const [months, setMonths] = useState<MonthChoice>(1);
  const [dailyHours, setDailyHours] = useState<DailyHours>(12);
  const [hubResume, setHubResume] = useState<ResumableCheckoutPayload | null>(null);
  const [hubResumeDismissing, setHubResumeDismissing] = useState(false);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus === "row") setDailyHours(6);
    else if (focus === "main") setDailyHours(12);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetchResumableCheckout();
        if (!cancelled && r) setHubResume(r);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hubResumeDurationLabel = useMemo(() => {
    if (!hubResume) return "";
    if (hubResume.planKind === "short_term") {
      return SHORT_TERM_DURATION_OPTIONS.find((o) => o.key === hubResume.durationKey)?.label ?? hubResume.durationKey;
    }
    return LONG_TERM_DURATION_OPTIONS.find((o) => o.key === hubResume.durationKey)?.label ?? hubResume.durationKey;
  }, [hubResume]);

  const hubResumeContinueHref = useMemo(() => {
    if (!hubResume) return "/membership";
    return hubResume.planKind === "short_term" ? "/membership/short-term" : "/membership/long-term";
  }, [hubResume]);

  const dismissHubResume = useCallback(async () => {
    if (!hubResume) return;
    setHubResumeDismissing(true);
    try {
      await fetch("/api/payments/razorpay/mark-checkout-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          payment_id: hubResume.paymentId,
          error: { description: "Member chose to start over from hub" },
        }),
      });
      setHubResume(null);
    } finally {
      setHubResumeDismissing(false);
    }
  }, [hubResume]);

  const durationKey = useMemo(
    () => (dailyHours === 12 ? longTermKeyForMonths(months) : shortHubKeyForMonths(months)),
    [dailyHours, months],
  );

  const planKind = dailyHours === 12 ? "long_term" : "short_term";
  const totalRupees = useMemo(
    () => computeOrderAmountRupees(planKind, durationKey) ?? 0,
    [planKind, durationKey],
  );

  const hallTitle = dailyHours === 12 ? "Main hall · 1st floor" : "Row hall";
  const hallBody =
    dailyHours === 12
      ? "12 hours per day · desk in the main study hall. Choose your seat on the live map next."
      : "6 hours per day · row-hall seat. Choose your seat on the live map next.";

  const monthlyRate = dailyHours === 12 ? MAIN_HALL_PRICE_PER_MONTH : ROW_HALL_PRICE_PER_MONTH;

  const continueHref = useMemo(() => {
    const base = dailyHours === 12 ? "/membership/long-term" : "/membership/short-term";
    const q = new URLSearchParams({
      start: membershipStartDate,
      durationKey,
      from: "hub",
    });
    return `${base}?${q.toString()}#seat-map`;
  }, [dailyHours, membershipStartDate, durationKey]);

  const onContinue = useCallback(() => {
    router.push(continueHref);
  }, [router, continueHref]);

  return (
    <>
      <MembershipHubGreeting />

      {hubResume ? (
        <div
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm sm:px-5 sm:py-4"
          role="status"
        >
          <p className="font-semibold text-amber-950">You have an unfinished payment</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
            Seat <span className="font-mono font-medium">{hubResume.seatLabel}</span>, start{" "}
            <span className="font-mono">{hubResume.membershipStartDate}</span>, {hubResumeDurationLabel}. Total{" "}
            <span className="font-semibold">₹{hubResume.amountRupees.toLocaleString("en-IN")}</span> (
            {hubResume.planKind === "short_term" ? "row hall" : "main hall"}).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={hubResumeContinueHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-azure-500 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-azure-600"
            >
              Continue to pay
            </Link>
            <button
              type="button"
              disabled={hubResumeDismissing}
              onClick={() => void dismissHubResume()}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-amber-300 bg-white px-4 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {hubResumeDismissing ? "Cancelling…" : "Discard checkout"}
            </button>
          </div>
        </div>
      ) : null}

      <header className="max-w-xl">
        <h1 className="text-[28px] font-bold tracking-tight text-ink-900 sm:text-3xl md:text-[34px]">
          Choose your plan
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-600 sm:text-base">
          Pick a start date and how long you want access. We show the hall that matches your daily hours.
        </p>
      </header>

      <div className="mt-8 space-y-6 rounded-[20px] border border-ink-100/80 bg-white p-5 shadow-sm sm:p-6">
        <label className="block space-y-2">
          <span className="text-[13px] font-medium text-ink-500">Start date</span>
          <input
            type="date"
            className="w-full min-h-[48px] rounded-xl border border-ink-200 bg-ink-50/40 px-4 py-3 font-mono text-[15px] text-ink-900 outline-none transition focus:border-azure-400 focus:bg-white focus:ring-2 focus:ring-azure-200"
            min={today}
            max={maxStart}
            value={membershipStartDate}
            onChange={(e) => setMembershipStartDate(e.target.value)}
          />
        </label>

        <SegmentedRow<MonthChoice>
          label="Duration"
          value={months}
          onChange={setMonths}
          options={[
            { value: 1, label: "1 mo" },
            { value: 3, label: "3 mo" },
            { value: 6, label: "6 mo" },
          ]}
        />

        <SegmentedRow<DailyHours>
          label="Daily hours"
          value={dailyHours}
          onChange={setDailyHours}
          options={[
            { value: 12, label: "12h · Main" },
            { value: 6, label: "6h · Row" },
          ]}
        />

        <div className="rounded-2xl border border-azure-100 bg-azure-50/60 px-4 py-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-azure-700">
            {dailyHours === 12 ? "Main hall" : "Row hall"}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink-900">{hallTitle}</h2>
          <p className="mt-1.5 text-sm text-ink-600">{hallBody}</p>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-azure-100/80 pt-4">
            <div>
              <p className="text-xs text-ink-500">
                {months}× ₹{monthlyRate.toLocaleString("en-IN")}/mo
              </p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink-900">
                ₹{totalRupees.toLocaleString("en-IN")}
              </p>
            </div>
            <p className="text-xs text-ink-500">{DEFAULT_LIBRARY_TZ} calendar</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="flex w-full min-h-[50px] items-center justify-center rounded-xl bg-azure-500 text-[15px] font-semibold text-white shadow-sm transition hover:bg-azure-600 active:scale-[0.99]"
        >
          Continue to seat map
        </button>
      </div>

      <details className="mt-10 rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-600 shadow-sm sm:p-5">
        <summary className="cursor-pointer font-semibold text-ink-800 outline-none marker:text-azure-600">
          Account &amp; billing note
        </summary>
        <p className="mt-3 text-xs leading-relaxed sm:text-sm">
          Use <Link href="/register" className="text-azure-600 hover:underline">Create account</Link> or{" "}
          <Link href="/login" className="text-azure-600 hover:underline">Sign in</Link> before paying. Day and week passes
          are still available inside the row-hall flow if you need a shorter visit.
        </p>
      </details>
    </>
  );
}
