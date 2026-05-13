"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDaysYmd, DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import { MEMBER_MEMBERSHIP_PATH } from "@/lib/auth-landing";
import { LONG_TERM_DURATION_OPTIONS, type LongTermDurationKey } from "@/lib/payments/pricing";
import libraryInfo from "@/data/libraryInfo.json";
import ActiveMembershipBanner, { type ActiveMembership } from "./ActiveMembershipBanner";
import LongTermSeatMap from "./LongTermSeatMap";
import MembershipCheckoutButton from "./MembershipCheckoutButton";
import MembershipDesignBanner from "./MembershipDesignBanner";
import MembershipLegend from "./MembershipLegend";
import MembershipSeatMapIntro from "./MembershipSeatMapIntro";

export default function MembershipLongTermPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [occupied, setOccupied] = useState<number[]>([]);
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [membershipStartDate, setMembershipStartDate] = useState(() => todayYmdInTz(DEFAULT_LIBRARY_TZ));
  const [durationKey, setDurationKey] = useState<LongTermDurationKey>("lt_1m");

  const durationLabel = useMemo(
    () => LONG_TERM_DURATION_OPTIONS.find((o) => o.key === durationKey)?.label ?? durationKey,
    [durationKey],
  );
  const today = todayYmdInTz(DEFAULT_LIBRARY_TZ);
  const maxStart = addDaysYmd(today, 120);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/memberships/seat-occupancy?planKind=long_term", { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; seats?: number[] };
        if (!cancelled && res.ok && j.ok && Array.isArray(j.seats)) {
          setOccupied(j.seats);
        }
      } catch {
        // ignore — seat map still works, DB will enforce exclusivity
      }
    })();
    void (async () => {
      try {
        const res = await fetch("/api/memberships/me-active", { cache: "no-store" });
        const j = (await res.json()) as { ok?: boolean; membership?: ActiveMembership | null };
        if (!cancelled && res.ok && j.ok && j.membership) {
          setActiveMembership(j.membership);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const occupiedSet = useMemo(() => new Set(occupied), [occupied]);
  const hasActive = activeMembership != null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <nav className="mb-6 text-sm">
        <Link href="/membership" className="text-azure-600 hover:text-azure-700">
          ← Membership
        </Link>
      </nav>

      <header className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-azure-500">
          Long-term
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
          Choose your desk — main hall
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Same 100-seat blueprint as the mobile app: back-to-back blocks with a
          central aisle. Pick an available desk; long members can later mark a
          &quot;home&quot; seat when away.
        </p>
      </header>

      {hasActive && activeMembership ? (
        <div className="mt-6">
          <ActiveMembershipBanner membership={activeMembership} />
        </div>
      ) : null}

      {!hasActive ? (
        <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
            Membership window
          </p>
          <p className="mt-1 text-xs text-ink-600">
            Choose when your plan starts ({DEFAULT_LIBRARY_TZ}). End date is calculated from the duration below.
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              Start date
              <input
                type="date"
                className="rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
                min={today}
                max={maxStart}
                value={membershipStartDate}
                onChange={(e) => setMembershipStartDate(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              Duration
              <select
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                value={durationKey}
                onChange={(e) => setDurationKey(e.target.value as LongTermDurationKey)}
              >
                {LONG_TERM_DURATION_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <div className="mt-8 space-y-6">
        <MembershipDesignBanner />
        <MembershipSeatMapIntro mode="long" />
        <MembershipLegend mode="long" />
      </div>

      <div id="seat-map" className="mt-10 scroll-mt-24 rounded-2xl border border-ink-100 bg-white p-4 shadow-card md:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
              Floor map
            </p>
            <p className="text-sm text-ink-600">{libraryInfo.name} · long-term zone</p>
          </div>
          <p className="font-mono text-xs text-ink-500">
            Selected:{" "}
            <span className="font-semibold text-azure-600">
              {selected ?? "—"}
            </span>
          </p>
        </div>
        <LongTermSeatMap selected={selected} onSelect={setSelected} occupiedSeats={occupiedSet} />
      </div>

      <div className="sticky bottom-0 z-10 mt-10 border-t border-ink-100 bg-surface-muted/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-surface-muted/80 md:static md:border-0 md:bg-transparent md:py-0">
        {hasActive ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-600">
              Tap seats to see numbers; available seats stay selectable for reference. Occupied seats reflect current
              bookings. Payment is not shown while your membership is active.
            </p>
            <Link
              href={MEMBER_MEMBERSHIP_PATH}
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              My membership
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-600">
              Pay securely with Razorpay (test mode) after choosing a seat. Plan duration UI can follow later.
            </p>
            <MembershipCheckoutButton
              planKind="long_term"
              seatNumber={selected}
              membershipStartDate={membershipStartDate}
              durationKey={durationKey}
              durationLabel={durationLabel}
            />
          </div>
        )}
      </div>
    </div>
  );
}
