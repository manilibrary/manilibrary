"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import LongTermSeatMap from "@/components/membership/LongTermSeatMap";
import MembershipLegend from "@/components/membership/MembershipLegend";
import ShortTermSeatMap from "@/components/membership/ShortTermSeatMap";
import { formatDateDdMmYyyy } from "@/lib/date-format";
import { DEVICE_USER_ID_SEARCH_PLACEHOLDER, deviceUserIdInlineLabel } from "@/lib/device-user-id-label";
import { membershipDisplayStatusLabel } from "@/lib/membership/display-status";
import {
  buildRosterMembers,
  searchRosterMembers,
  type RosterMember,
} from "@/lib/admin/member-roster-search";
import {
  isValidRenewStartYmd,
  minRenewStartYmd,
  renewStartDateHint,
} from "@/lib/admin/renew-start-date";
import { CLIENT_SEAT_OCC_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import {
  computeOrderAmountRupees,
  LONG_TERM_DURATION_OPTIONS,
  SHORT_TERM_DURATION_OPTIONS,
  type MembershipPlanKind,
} from "@/lib/payments/pricing";

type MembershipRow = {
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  valid_from: string | null;
  valid_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
  window_state?: string;
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
  email: string | null;
  verification_status?: string;
};

type Props = {
  rows: MembershipRow[];
  profiles: Record<string, ProfileMini>;
  onClose: () => void;
  onSaved: () => void;
};

export default function StaffRenewMemberPanel({ rows, profiles, onClose, onSaved }: Props) {
  const roster = useMemo(() => buildRosterMembers(rows, profiles), [rows, profiles]);

  const [step, setStep] = useState<"search" | "enroll">("search");
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState<RosterMember | null>(null);

  const [planKind, setPlanKind] = useState<MembershipPlanKind>("long_term");
  const [durationKey, setDurationKey] = useState("lt_1m");
  const [seat, setSeat] = useState("");
  const [startYmd, setStartYmd] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<
    "cash" | "upi_external" | "bank_transfer" | "card_terminal" | "other"
  >("cash");
  const [extRef, setExtRef] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    device_user_id: number;
    membership_id: string;
    payment_id: string;
  } | null>(null);

  const [occupiedSeats, setOccupiedSeats] = useState<number[]>([]);
  const [seatOccErr, setSeatOccErr] = useState<string | null>(null);

  const searchResults = useMemo(() => searchRosterMembers(roster, searchQ), [roster, searchQ]);

  const minStart = useMemo(() => {
    if (!selected?.expiryYmd) return "";
    return minRenewStartYmd(selected.expiryYmd);
  }, [selected]);

  const catalogAmount = useMemo(() => computeOrderAmountRupees(planKind, durationKey), [planKind, durationKey]);

  const durationOptions = useMemo(
    () => (planKind === "long_term" ? LONG_TERM_DURATION_OPTIONS : SHORT_TERM_DURATION_OPTIONS),
    [planKind],
  );

  const occupiedSet = useMemo(() => new Set(occupiedSeats), [occupiedSeats]);

  const mapSelectedSeat = useMemo(() => {
    const n = parseInt(seat.trim(), 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  }, [seat]);

  useEffect(() => {
    if (step !== "enroll" || !/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return;

    let cancelled = false;
    const occKey = ddcKey.seatOccupancy(planKind, startYmd, durationKey);
    const cached = getClientCache<number[]>(occKey);
    queueMicrotask(() => {
      if (cached !== null && !cancelled) setOccupiedSeats(cached);
    });

    void (async () => {
      try {
        const params = new URLSearchParams({ planKind, startDate: startYmd, durationKey });
        const res = await fetch(`/api/memberships/seat-occupancy?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const j = (await res.json()) as { ok?: boolean; seats?: number[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setSeatOccErr(j.error ?? "Could not load seat occupancy.");
          return;
        }
        setSeatOccErr(null);
        if (Array.isArray(j.seats)) {
          setOccupiedSeats(j.seats);
          setClientCache(occKey, j.seats, CLIENT_SEAT_OCC_CACHE_TTL_MS);
        }
      } catch {
        if (!cancelled) setSeatOccErr("Could not load seat occupancy.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, planKind, startYmd, durationKey]);

  useEffect(() => {
    if (!catalogAmount) return;
    setAmount(String(catalogAmount));
  }, [catalogAmount, planKind, durationKey]);

  const pickMember = useCallback((m: RosterMember) => {
    const pk = m.planKind === "short_term" ? "short_term" : "long_term";
    const min = minRenewStartYmd(m.expiryYmd || "");
    const prevSeat = m.seatNo !== "—" ? m.seatNo.replace(/\D/g, "") : "";
    setSelected(m);
    setPlanKind(pk);
    setDurationKey(pk === "long_term" ? "lt_1m" : "st_1d");
    setStartYmd(min);
    setSeat(prevSeat);
    setErr(null);
    setSuccess(null);
    setStep("enroll");
  }, []);

  const submit = useCallback(async () => {
    if (!selected) return;
    setErr(null);
    setSuccess(null);
    const seatN = parseInt(seat.trim(), 10);
    const amountN = parseInt(amount.trim(), 10);
    if (!Number.isFinite(seatN) || seatN < 1) {
      setErr("Choose a free seat on the map.");
      return;
    }
    if (!Number.isFinite(amountN) || amountN < 1) {
      setErr("Enter amount collected in whole rupees.");
      return;
    }
    if (!isValidRenewStartYmd(startYmd, minStart)) {
      setErr(renewStartDateHint(selected.expiryYmd, minStart));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/members/manual-enroll", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existing_user_id: selected.userId,
          plan_kind: planKind,
          seat_number: seatN,
          membership_start_date: startYmd,
          duration_key: durationKey,
          amount_rupees: amountN,
          payment_method: method,
          external_reference: extRef.trim() || undefined,
          staff_note: staffNote.trim() || undefined,
          mark_kyc_verified: false,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        device_user_id?: number;
        membership_id?: string;
        payment_id?: string;
      };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Renewal failed.");
        return;
      }
      setSuccess({
        device_user_id: j.device_user_id ?? (Number(selected.libraryNumber) || 0),
        membership_id: j.membership_id ?? "",
        payment_id: j.payment_id ?? "",
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }, [amount, durationKey, extRef, method, minStart, onSaved, planKind, seat, selected, staffNote, startYmd]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-azure-100 pb-3">
        <div className="min-w-0 max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-azure-900">Renew membership</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-700">
            {step === "search"
              ? "Find the member by device user id, name, email, or phone — then set the new period and seat."
              : "Confirm details, then choose plan, start date (after current expiry), and a free seat."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {step === "enroll" ? (
            <button
              type="button"
              onClick={() => {
                setStep("search");
                setSelected(null);
                setErr(null);
              }}
              className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              disabled={busy}
            >
              ← Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              onClose();
            }}
            className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
            disabled={busy}
          >
            Close
          </button>
        </div>
      </div>

      {step === "search" ? (
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            Find member
            <input
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={DEVICE_USER_ID_SEARCH_PLACEHOLDER}
              autoComplete="off"
            />
          </label>
          {searchQ.trim() && searchResults.length === 0 ? (
            <p className="text-sm text-ink-500">No matches. Try device user id or email.</p>
          ) : null}
          <ul className="space-y-2">
            {searchResults.map((m) => (
              <li key={m.userId}>
                <button
                  type="button"
                  onClick={() => pickMember(m)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 bg-white px-4 py-3 text-left hover:border-azure-300 hover:bg-azure-50/40"
                >
                  <div>
                    <p className="font-semibold text-ink-900">{m.name}</p>
                    <p className="text-xs text-ink-600">
                      {deviceUserIdInlineLabel(m.libraryNumber)}
                      {m.planKind ? ` · Seat ${m.seatNo}` : ""}
                      {m.expiryYmd ? ` · ends ${formatDateDdMmYyyy(m.expiryYmd)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      m.status === "active" && m.windowState === "starts_future"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-ink-100 text-ink-700"
                    }`}
                  >
                    {membershipDisplayStatusLabel(m.status, m.windowState)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : selected ? (
        <form
          className="mt-4 space-y-4"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="rounded-xl border border-azure-100 bg-azure-50/50 px-4 py-3 text-sm">
            <p className="font-semibold text-ink-900">{selected.name}</p>
            <p className="text-ink-600">
              {deviceUserIdInlineLabel(selected.libraryNumber)} · {selected.email || "—"}
            </p>
            <p className="text-ink-600">
              {selected.planKind === "long_term" ? "Main hall" : "Row hall"} · Seat {selected.seatNo} ·{" "}
              {selected.windowLabel}
            </p>
            <p className="mt-2 text-xs font-medium text-azure-800">{renewStartDateHint(selected.expiryYmd, minStart)}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              Plan
              <select
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={planKind}
                onChange={(e) => {
                  const pk = e.target.value as MembershipPlanKind;
                  setPlanKind(pk);
                  setDurationKey(pk === "long_term" ? "lt_1m" : "st_1d");
                  setSeat("");
                }}
                disabled={busy}
              >
                <option value="long_term">Main hall · long term</option>
                <option value="short_term">Row hall · short term</option>
              </select>
            </label>
            <label className="flex min-w-[200px] flex-col gap-1 text-xs text-ink-600">
              Duration
              <select
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={durationKey}
                onChange={(e) => {
                  setDurationKey(e.target.value);
                  setSeat("");
                }}
                disabled={busy}
              >
                {durationOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              New period starts
              <input
                type="date"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={startYmd}
                min={minStart}
                onChange={(e) => {
                  setStartYmd(e.target.value);
                  setSeat("");
                }}
                disabled={busy}
              />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs text-ink-600">
              Seat #
              <input
                inputMode="numeric"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={seat}
                onChange={(e) => setSeat(e.target.value)}
                disabled={busy}
              />
            </label>
            <label className="flex w-32 flex-col gap-1 text-xs text-ink-600">
              Amount (₹)
              <input
                inputMode="numeric"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-inner sm:p-4">
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Floor map</p>
                <p className="text-xs text-ink-600">Blue = free · Amber = taken for this period</p>
              </div>
              <p className="font-mono text-xs text-ink-600">
                Selected: <span className="font-semibold text-azure-700">{mapSelectedSeat ?? "—"}</span>
              </p>
            </div>
            {seatOccErr ? (
              <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                {seatOccErr}
              </p>
            ) : null}
            <div className="mb-3">
              <MembershipLegend mode={planKind === "long_term" ? "long" : "short"} layout="strip" />
            </div>
            <div className="overflow-x-auto pb-1">
              {planKind === "long_term" ? (
                <LongTermSeatMap
                  selected={mapSelectedSeat}
                  onSelect={(n) => setSeat(String(n))}
                  occupiedSeats={occupiedSet}
                />
              ) : (
                <ShortTermSeatMap
                  selected={mapSelectedSeat}
                  onSelect={(n) => setSeat(String(n))}
                  occupiedSeats={occupiedSet}
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[160px] flex-col gap-1 text-xs text-ink-600">
              Payment method
              <select
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
                disabled={busy}
              >
                <option value="cash">Cash</option>
                <option value="upi_external">UPI (other app)</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card_terminal">Card (POS)</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-ink-600">
              Payment reference (optional)
              <input
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={extRef}
                onChange={(e) => setExtRef(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>

          <label className="flex max-w-2xl flex-col gap-1 text-xs text-ink-600">
            Staff note (optional)
            <textarea
              className="min-h-[4rem] rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              disabled={busy}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="rounded-full border border-azure-700 bg-azure-700 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Record renewal"}
          </button>

          {err ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {err}
            </p>
          ) : null}
          {success ? (
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950"
              role="status"
            >
              <p className="font-medium">Renewal saved</p>
              <p className="mt-1 font-mono text-xs">
                {deviceUserIdInlineLabel(success.device_user_id)} · membership{" "}
                <span className="select-all">{success.membership_id}</span>
              </p>
            </div>
          ) : null}

        </form>
      ) : null}
    </>
  );
}
