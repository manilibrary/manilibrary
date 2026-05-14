"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import MemberKycDocumentsModal, { type MemberKycDetails } from "@/components/dashboard/MemberKycDocumentsModal";
import LongTermSeatMap from "@/components/membership/LongTermSeatMap";
import MembershipLegend from "@/components/membership/MembershipLegend";
import ShortTermSeatMap from "@/components/membership/ShortTermSeatMap";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from "@/lib/date-format";
import { MembershipSeatTableCell } from "@/components/membership/MembershipSeatTableCell";
import { CLIENT_SEAT_OCC_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { addDaysYmd, DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import {
  computeOrderAmountRupees,
  LONG_TERM_DURATION_OPTIONS,
  SHORT_TERM_DURATION_OPTIONS,
  type MembershipPlanKind,
} from "@/lib/payments/pricing";

type MembershipWindowState = "current" | "starts_future" | "ended_past" | "unknown" | "inactive";

type MembershipRow = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  window_state?: MembershipWindowState;
  current_on_library_day?: boolean;
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
  email: string | null;
  verification_status: string;
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
  created_at?: string;
};

function formatMembershipPeriod(r: MembershipRow): string {
  if (r.plan_kind === "long_term") {
    return `${formatDateDdMmYyyy(r.valid_from)} → ${formatDateDdMmYyyy(r.valid_until)}`;
  }
  if (r.plan_kind === "short_term") {
    return `${formatDateTimeDdMmYyyy(r.starts_at)} → ${formatDateTimeDdMmYyyy(r.ends_at)}`;
  }
  return "—";
}

function isMembershipWindowExpired(r: MembershipRow): boolean {
  return r.window_state === "ended_past";
}

function isPendingPaymentMembership(r: MembershipRow): boolean {
  return r.status === "pending_payment";
}

function windowHint(r: MembershipRow): string | null {
  if (isMembershipWindowExpired(r)) {
    const ended = r.plan_kind === "short_term" ? formatDateTimeDdMmYyyy(r.ends_at) : formatDateDdMmYyyy(r.valid_until);
    return ended ? `Ended ${ended}` : "Period ended";
  }
  if (r.status !== "active") return null;
  if (r.window_state === "current") return "Current today";
  if (r.window_state === "starts_future") {
    const starts = r.plan_kind === "short_term" ? formatDateTimeDdMmYyyy(r.starts_at) : formatDateDdMmYyyy(r.valid_from);
    return `Starts ${starts}`;
  }
  if (r.window_state === "unknown") return "Window missing";
  return null;
}

function MembershipStatusBadge({ s, windowState }: { s: string; windowState?: MembershipWindowState }) {
  const expired = s === "active" && windowState === "ended_past";
  let cls = "bg-ink-100 text-ink-700";
  let label = s.replace(/_/g, " ");
  if (expired) {
    cls = "bg-stone-200 text-stone-800";
    label = "expired";
  } else if (s === "active" && windowState === "starts_future") {
    cls = "bg-amber-100 text-amber-800";
  } else if (s === "active" && (windowState === "current" || !windowState)) {
    cls = "bg-emerald-100 text-emerald-800";
  } else if (s === "pending_payment") {
    cls = "bg-azure-100 text-azure-700";
  } else if (s === "cancelled") {
    cls = "bg-red-100 text-red-700";
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}

type MemberBrowseFilter = "all" | "active" | "verified" | "pending" | "unverified" | "pending_payment" | "expired";

function matchesMemberBrowseFilter(v: string | undefined, f: MemberBrowseFilter, r: MembershipRow): boolean {
  const expired = isMembershipWindowExpired(r);
  const pendingPay = isPendingPaymentMembership(r);

  if (f === "expired") return expired;
  if (f === "pending_payment") return pendingPay;
  if (f === "active") return r.status === "active" && !expired;

  if (expired) return false;
  if (pendingPay) return false;

  const norm = (v || "none").toLowerCase();
  if (f === "all") return true;
  if (f === "verified") return norm === "approved";
  if (f === "pending") return norm === "pending";
  if (f === "unverified") return norm !== "approved";
  return true;
}

const FILTER_CHIPS: { id: MemberBrowseFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "verified", label: "Verified" },
  { id: "pending", label: "Pending review" },
  { id: "unverified", label: "Unverified" },
  { id: "pending_payment", label: "Pending payments" },
  { id: "expired", label: "Expired" },
];

export default function StaffMembershipsPanel() {
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [accountOnly, setAccountOnly] = useState<ProfileMini[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [browseFilter, setBrowseFilter] = useState<MemberBrowseFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [kycPreview, setKycPreview] = useState<{
    userId: string;
    title: string;
    details: MemberKycDetails;
  } | null>(null);

  const [createMemberOpen, setCreateMemberOpen] = useState(false);

  const [manUseExisting, setManUseExisting] = useState(false);
  const [manExistingId, setManExistingId] = useState("");
  const [manFullName, setManFullName] = useState("");
  const [manEmail, setManEmail] = useState("");
  const [manPhone, setManPhone] = useState("");
  const [manPassword, setManPassword] = useState("");
  const [manPlanKind, setManPlanKind] = useState<MembershipPlanKind>("long_term");
  const [manDurationKey, setManDurationKey] = useState("lt_1m");
  const [manSeat, setManSeat] = useState("");
  const [manStart, setManStart] = useState(() => todayYmdInTz(DEFAULT_LIBRARY_TZ));
  const [manAmount, setManAmount] = useState("");
  const [manMethod, setManMethod] = useState<
    "cash" | "upi_external" | "bank_transfer" | "card_terminal" | "other"
  >("cash");
  const [manExtRef, setManExtRef] = useState("");
  const [manStaffNote, setManStaffNote] = useState("");
  const [manMarkKyc, setManMarkKyc] = useState(false);
  const [manBusy, setManBusy] = useState(false);
  const [manErr, setManErr] = useState<string | null>(null);
  const [manSuccess, setManSuccess] = useState<{
    device_user_id: number;
    membership_id: string;
    payment_id: string;
    temporary_password?: string;
  } | null>(null);

  const [enrollOccupiedSeats, setEnrollOccupiedSeats] = useState<number[]>([]);
  const [enrollSeatOccErr, setEnrollSeatOccErr] = useState<string | null>(null);

  const [exportFromYmd, setExportFromYmd] = useState(() => {
    const to = todayYmdInTz(DEFAULT_LIBRARY_TZ);
    return addDaysYmd(to, -30);
  });
  const [exportToYmd, setExportToYmd] = useState(() => todayYmdInTz(DEFAULT_LIBRARY_TZ));
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const downloadLibraryWorkbook = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exportFromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(exportToYmd)) {
      setExportErr("Pick valid From / To dates.");
      return;
    }
    setExportBusy(true);
    setExportErr(null);
    try {
      const params = new URLSearchParams({
        fromYmd: exportFromYmd,
        toYmd: exportToYmd,
        paymentDaysBack: "450",
      });
      const res = await fetch(`/api/admin/export/library-workbook?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setExportErr(j.error ?? "Could not generate export.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? `mani-library-export_${exportFromYmd}_${exportToYmd}.xlsx`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExportBusy(false);
    }
  }, [exportFromYmd, exportToYmd]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/members/list", { cache: "no-store" });
    const j = (await res.json()) as {
      ok?: boolean;
      error?: string;
      rows?: MembershipRow[];
      profiles?: Record<string, ProfileMini>;
      account_only_profiles?: ProfileMini[];
    };
    if (!res.ok || !j.ok) {
      throw new Error(j.error ?? "Could not load members.");
    }
    setErr(null);
    setRows(j.rows ?? []);
    setProfiles(j.profiles ?? {});
    setAccountOnly(j.account_only_profiles ?? []);
  }, []);

  const catalogAmount = useMemo(
    () => computeOrderAmountRupees(manPlanKind, manDurationKey),
    [manPlanKind, manDurationKey],
  );

  const durationSelectOptions = useMemo(() => {
    return manPlanKind === "long_term" ? LONG_TERM_DURATION_OPTIONS : SHORT_TERM_DURATION_OPTIONS;
  }, [manPlanKind]);

  const enrollOccupiedSet = useMemo(() => new Set(enrollOccupiedSeats), [enrollOccupiedSeats]);

  const enrollMapSelectedSeat = useMemo(() => {
    const n = parseInt(manSeat.trim(), 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
  }, [manSeat]);

  useEffect(() => {
    if (!createMemberOpen || !/^\d{4}-\d{2}-\d{2}$/.test(manStart)) return;

    let cancelled = false;
    const occKey = ddcKey.seatOccupancy(manPlanKind, manStart, manDurationKey);
    const cached = getClientCache<number[]>(occKey);
    queueMicrotask(() => {
      if (cached !== null && !cancelled) setEnrollOccupiedSeats(cached);
    });

    void (async () => {
      try {
        const params = new URLSearchParams({
          planKind: manPlanKind,
          startDate: manStart,
          durationKey: manDurationKey,
        });
        const res = await fetch(`/api/memberships/seat-occupancy?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const j = (await res.json()) as { ok?: boolean; seats?: number[]; error?: string };
        if (cancelled) return;
        if (!res.ok || !j.ok) {
          setEnrollSeatOccErr(j.error ?? "Could not load seat occupancy.");
          return;
        }
        setEnrollSeatOccErr(null);
        if (Array.isArray(j.seats)) {
          setEnrollOccupiedSeats(j.seats);
          setClientCache(occKey, j.seats, CLIENT_SEAT_OCC_CACHE_TTL_MS);
        }
      } catch {
        if (!cancelled) setEnrollSeatOccErr("Could not load seat occupancy.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [createMemberOpen, manPlanKind, manStart, manDurationKey]);

  const submitManualEnroll = useCallback(async () => {
    setManErr(null);
    setManSuccess(null);
    const seat = parseInt(manSeat.trim(), 10);
    const amount = parseInt(manAmount.trim(), 10);
    if (!Number.isFinite(seat) || seat < 1) {
      setManErr("Enter a valid seat number (1–9999).");
      return;
    }
    if (!Number.isFinite(amount) || amount < 1) {
      setManErr("Enter amount collected in whole rupees.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(manStart)) {
      setManErr("Membership start must be a valid date.");
      return;
    }
    if (manUseExisting) {
      const id = manExistingId.trim();
      if (!id) {
        setManErr("Paste the member’s user id (UUID), or turn off “existing account”.");
        return;
      }
    } else {
      if (!manFullName.trim() || !manEmail.trim()) {
        setManErr("Full name and email are required for a new account.");
        return;
      }
    }
    setManBusy(true);
    try {
      const body: Record<string, unknown> = {
        plan_kind: manPlanKind,
        seat_number: seat,
        membership_start_date: manStart,
        duration_key: manDurationKey,
        amount_rupees: amount,
        payment_method: manMethod,
        external_reference: manExtRef.trim() || undefined,
        staff_note: manStaffNote.trim() || undefined,
        mark_kyc_verified: manMarkKyc,
      };
      if (manUseExisting && manExistingId.trim()) {
        body.existing_user_id = manExistingId.trim();
      } else {
        body.full_name = manFullName.trim();
        body.email = manEmail.trim();
        body.phone = manPhone.trim() || undefined;
        body.password = manPassword.trim() || undefined;
      }
      const res = await fetch("/api/admin/members/manual-enroll", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        device_user_id?: number;
        membership_id?: string;
        payment_id?: string;
        temporary_password?: string;
      };
      if (!res.ok || !j.ok) {
        setManErr(j.error ?? "Enrollment failed.");
        return;
      }
      setManSuccess({
        device_user_id: j.device_user_id ?? 0,
        membership_id: j.membership_id ?? "",
        payment_id: j.payment_id ?? "",
        temporary_password: j.temporary_password,
      });
      if (!manUseExisting) {
        setManPassword("");
        setManFullName("");
        setManEmail("");
        setManPhone("");
      }
      setManExtRef("");
      setManStaffNote("");
      setManMarkKyc(false);
      setRefreshKey((k) => k + 1);
      await load();
    } catch (e) {
      setManErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setManBusy(false);
    }
  }, [
    manUseExisting,
    manExistingId,
    manFullName,
    manEmail,
    manPhone,
    manPassword,
    manPlanKind,
    manDurationKey,
    manSeat,
    manStart,
    manAmount,
    manMethod,
    manExtRef,
    manStaffNote,
    manMarkKyc,
    load,
  ]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, refreshKey]);

  const chipFiltered = useMemo(() => {
    return rows.filter((r) => {
      const p = profiles[r.user_id];
      const v = p?.verification_status ?? "none";
      return matchesMemberBrowseFilter(v, browseFilter, r);
    });
  }, [rows, profiles, browseFilter]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return chipFiltered;
    return chipFiltered.filter((r) => {
      const p = profiles[r.user_id];
      const v = p?.verification_status ?? "none";
      const seatLabel = resolveMemberSeatDisplayLabel({
        plan_kind: r.plan_kind,
        seat_number: r.seat_number,
      });
      const period = formatMembershipPeriod(r);
      const hint = windowHint(r) ?? "";
      const expiredTag = isMembershipWindowExpired(r) ? "expired" : "";
      const pendingPayTag = isPendingPaymentMembership(r) ? "pending payment" : "";
      const activeTag = r.status === "active" && !isMembershipWindowExpired(r) ? "active" : "";
      const member = p
        ? `${p.full_name} ${String(p.device_user_id).padStart(4, "0")} ${p.email ?? ""} ${p.aadhaar_last_four ?? ""} ${p.student_roll_number ?? ""} ${p.institution_type ?? ""} ${p.preparing_for ?? ""} ${v} ${expiredTag} ${pendingPayTag} ${activeTag}`
        : "";
      return (
        member.toLowerCase().includes(needle) ||
        seatLabel.toLowerCase().includes(needle) ||
        period.toLowerCase().includes(needle) ||
        hint.toLowerCase().includes(needle) ||
        (r.seat_number ?? "").toString().includes(needle) ||
        r.plan_kind.toLowerCase().includes(needle) ||
        r.status.toLowerCase().includes(needle)
      );
    });
  }, [chipFiltered, profiles, q]);

  if (err) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
        {!createMemberOpen ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-900">Create member</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">
                Walk-in or when the app / Razorpay checkout is unavailable: open the form to add a login (library
                number is automatic), an <strong>active</strong> seat, and a <strong>paid</strong> manual record for
                cash, UPI on another phone, bank transfer, etc.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateMemberOpen(true);
                setManErr(null);
                setManSuccess(null);
              }}
              className="shrink-0 rounded-full border border-violet-700 bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
            >
              Create member
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-violet-100 pb-3">
              <div className="min-w-0 max-w-3xl">
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-900">New member enrollment</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-700">
                  Payment is stored as <span className="font-mono">manual</span> with your method and reference for
                  audit. Use “Existing account” if the member already has a login and you only need to add this plan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (manBusy) return;
                  setCreateMemberOpen(false);
                  setManErr(null);
                  setManSuccess(null);
                }}
                className="shrink-0 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
                disabled={manBusy}
              >
                Close
              </button>
            </div>
            <form
              className="mt-4 space-y-4"
              autoComplete="off"
              onSubmit={(e) => {
                e.preventDefault();
                void submitManualEnroll();
              }}
            >
          <label className="flex items-center gap-2 text-xs text-ink-700">
            <input
              type="checkbox"
              checked={manUseExisting}
              onChange={(e) => setManUseExisting(e.target.checked)}
              disabled={manBusy}
            />
            Existing account only (paste Supabase <span className="font-mono">user_id</span> — no new login created)
          </label>
          {manUseExisting ? (
            <label className="flex max-w-xl flex-col gap-1 text-xs text-ink-600">
              Member user id (UUID)
              <input
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-sm"
                value={manExistingId}
                onChange={(e) => setManExistingId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                disabled={manBusy}
                autoComplete="off"
                name="staff_enroll_existing_user_id"
              />
            </label>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3">
                <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-ink-600">
                  Full name
                  <input
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                    value={manFullName}
                    onChange={(e) => setManFullName(e.target.value)}
                    disabled={manBusy}
                    autoComplete="off"
                    name="staff_enroll_member_full_name"
                  />
                </label>
                <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-ink-600">
                  Email (login)
                  <input
                    type="email"
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                    value={manEmail}
                    onChange={(e) => setManEmail(e.target.value)}
                    disabled={manBusy}
                    autoComplete="off"
                    name="staff_enroll_member_email"
                  />
                </label>
                <label className="flex min-w-[120px] flex-col gap-1 text-xs text-ink-600">
                  Phone <span className="text-ink-400">(opt.)</span>
                  <input
                    type="tel"
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                    value={manPhone}
                    onChange={(e) => setManPhone(e.target.value)}
                    disabled={manBusy}
                    autoComplete="off"
                    name="staff_enroll_member_phone"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                </label>
                <label className="flex min-w-[140px] flex-col gap-1 text-xs text-ink-600">
                  Password <span className="text-ink-400">(opt.)</span>
                  <input
                    type="password"
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                    value={manPassword}
                    onChange={(e) => setManPassword(e.target.value)}
                    disabled={manBusy}
                    autoComplete="new-password"
                    name="staff_enroll_member_password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                </label>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-500">
                Phone and password are for the <strong>new member’s</strong> mobile app login — not your staff
                account. Browsers and password managers often guess wrong on admin pages; if yours autofills, clear the
                fields before saving.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              Plan
              <select
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={manPlanKind}
                onChange={(e) => {
                  const pk = e.target.value as MembershipPlanKind;
                  setManPlanKind(pk);
                  setManDurationKey(pk === "long_term" ? "lt_1m" : "st_1d");
                }}
                disabled={manBusy}
              >
                <option value="long_term">Main hall · long term</option>
                <option value="short_term">Row hall · short term</option>
              </select>
            </label>
            <label className="flex min-w-[200px] flex-col gap-1 text-xs text-ink-600">
              Duration
              <select
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={manDurationKey}
                onChange={(e) => setManDurationKey(e.target.value)}
                disabled={manBusy}
              >
                {durationSelectOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              Start (library day)
              <input
                type="date"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={manStart}
                onChange={(e) => setManStart(e.target.value)}
                disabled={manBusy}
              />
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs text-ink-600">
              Seat #
              <input
                inputMode="numeric"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={manSeat}
                onChange={(e) => setManSeat(e.target.value)}
                disabled={manBusy}
                autoComplete="off"
                name="staff_enroll_seat_number"
              />
            </label>
            <label className="flex w-32 flex-col gap-1 text-xs text-ink-600">
              Amount (₹)
              <input
                inputMode="numeric"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={manAmount}
                onChange={(e) => setManAmount(e.target.value)}
                placeholder={catalogAmount != null ? String(catalogAmount) : ""}
                disabled={manBusy}
                autoComplete="off"
                name="staff_enroll_amount_rupees"
              />
            </label>
          </div>
          {catalogAmount != null ? (
            <p className="text-xs text-ink-500">
              Suggested catalog total for this plan/duration: <span className="font-mono">₹{catalogAmount}</span> — you
              may enter a different amount if you agreed a discount or rounded cash.
            </p>
          ) : null}
          <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-inner sm:p-4">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Floor map</p>
                <p className="text-xs text-ink-600">
                  {manPlanKind === "long_term" ? "Main hall (long term)" : "Row hall (short term)"} · taken seats overlap
                  the start date + duration above. Tap a free seat to fill “Seat #”.
                </p>
              </div>
              <p className="font-mono text-xs text-ink-600">
                Selected: <span className="font-semibold text-violet-700">{enrollMapSelectedSeat ?? "—"}</span>
              </p>
            </div>
            {enrollSeatOccErr ? (
              <p className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                {enrollSeatOccErr}
              </p>
            ) : null}
            <div className="mb-3">
              <MembershipLegend mode={manPlanKind === "long_term" ? "long" : "short"} layout="strip" />
            </div>
            <div className="overflow-x-auto pb-1">
              {manPlanKind === "long_term" ? (
                <LongTermSeatMap
                  selected={enrollMapSelectedSeat}
                  onSelect={(n) => setManSeat(String(n))}
                  occupiedSeats={enrollOccupiedSet}
                />
              ) : (
                <ShortTermSeatMap
                  selected={enrollMapSelectedSeat}
                  onSelect={(n) => setManSeat(String(n))}
                  occupiedSeats={enrollOccupiedSet}
                />
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[160px] flex-col gap-1 text-xs text-ink-600">
              Payment method
              <select
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={manMethod}
                onChange={(e) =>
                  setManMethod(e.target.value as typeof manMethod)
                }
                disabled={manBusy}
              >
                <option value="cash">Cash</option>
                <option value="upi_external">UPI (other app / bank app)</option>
                <option value="bank_transfer">Bank transfer / NEFT / IMPS</option>
                <option value="card_terminal">Card (terminal / POS)</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-ink-600">
              UPI / bank ref / receipt id <span className="font-normal text-ink-400">(recommended)</span>
              <input
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                value={manExtRef}
                onChange={(e) => setManExtRef(e.target.value)}
                placeholder="e.g. UPI txn id, RR number"
                disabled={manBusy}
              />
            </label>
          </div>
          <label className="flex max-w-2xl flex-col gap-1 text-xs text-ink-600">
            Internal note <span className="font-normal text-ink-400">(optional)</span>
            <textarea
              className="min-h-[4rem] rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
              value={manStaffNote}
              onChange={(e) => setManStaffNote(e.target.value)}
              disabled={manBusy}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-700">
            <input type="checkbox" checked={manMarkKyc} onChange={(e) => setManMarkKyc(e.target.checked)} disabled={manBusy} />
            Mark member as KYC verified (physical Aadhaar / ID checked at desk)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={manBusy}
              className="rounded-full border border-violet-700 bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {manBusy ? "Saving…" : "Save enrollment"}
            </button>
          </div>
          {manErr ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {manErr}
            </p>
          ) : null}
          {manSuccess ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950" role="status">
              <p className="font-medium">Enrollment saved</p>
              <p className="mt-1 font-mono text-xs">
                Library no. {String(manSuccess.device_user_id).padStart(4, "0")} · membership{" "}
                <span className="select-all">{manSuccess.membership_id}</span> · payment{" "}
                <span className="select-all">{manSuccess.payment_id}</span>
              </p>
              {manSuccess.temporary_password ? (
                <p className="mt-2 text-xs">
                  New account temp password:{" "}
                  <code className="rounded bg-white/80 px-1 font-mono">{manSuccess.temporary_password}</code>
                </p>
              ) : null}
            </div>
          ) : null}
            </form>
          </>
        )}
      </div>

      {accountOnly.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-amber-50/30 shadow-sm">
          <div className="border-b border-amber-100 bg-amber-50/80 px-4 py-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-900">No membership yet</p>
            <p className="text-xs text-amber-950/80">
              Recent accounts (last ~40) with no membership row — e.g. just created or not enrolled. Library admin and
              superadmin profiles are excluded. Everyone else stays here until checkout or staff adds a membership.
            </p>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-amber-100 bg-amber-50/50 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <tr>
                <th className="px-4 py-2">Member</th>
                <th className="px-4 py-2">Library no.</th>
                <th className="px-4 py-2">KYC</th>
                <th className="px-4 py-2">Profile created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100/80">
              {accountOnly.map((p) => (
                <tr key={p.user_id} className="text-ink-800">
                  <td className="px-4 py-2">
                    <div className="leading-tight">
                      <div>{p.full_name}</div>
                      {p.email ? <div className="text-xs text-ink-500">{p.email}</div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono">{String(p.device_user_id).padStart(4, "0")}</td>
                  <td className="px-4 py-2 text-xs capitalize text-ink-600">{p.verification_status.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 text-xs text-ink-500">
                    {p.created_at ? formatDateTimeDdMmYyyy(p.created_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[200px] max-w-xl">
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">Data export</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-600">
              Multi-sheet Excel: directory, memberships, payments, and archived attendance for the date range below
              (defaults to last 30 library days). Payments sheet still uses a rolling lookback from today.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              Attendance from
              <input
                type="date"
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                value={exportFromYmd}
                onChange={(e) => setExportFromYmd(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              Attendance to
              <input
                type="date"
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                value={exportToYmd}
                onChange={(e) => setExportToYmd(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => void downloadLibraryWorkbook()}
              disabled={exportBusy}
              className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
            >
              {exportBusy ? "Building…" : "Download Excel"}
            </button>
          </div>
        </div>
        {exportErr ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {exportErr}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setBrowseFilter(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              browseFilter === c.id
                ? "bg-azure-600 text-white"
                : "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="min-w-[260px] flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm"
          placeholder="Search by name, number, seat, Aadhaar last-4, roll, status…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="text-xs text-ink-500">
          {filtered.length} of {chipFiltered.length} rows
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-600">
          {accountOnly.length > 0
            ? "No membership rows in the recent list — new accounts without a plan appear in “No membership yet” above."
            : "No membership rows yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3">Library no.</th>
                <th className="px-4 py-3">Plan</th>
                <th
                  className="px-4 py-3"
                  title="F = long-term, S = short-term. Only active memberships reserve a seat; pending payment shows checkout choice only."
                >
                  Seat
                </th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Created</th>
                <th className="min-w-[6.5rem] px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-sm text-ink-500">
                    No rows match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const p = profiles[r.user_id];
                  const v = p?.verification_status ?? "none";
                  const canVerify = v === "pending";
                  const kycDetails: MemberKycDetails = {
                    verification_status: p?.verification_status ?? "none",
                    aadhaar_last_four: p?.aadhaar_last_four ?? null,
                    student_roll_number: p?.student_roll_number ?? null,
                    institution_type: p?.institution_type ?? null,
                    preparing_for: p?.preparing_for ?? null,
                    device_user_id: p?.device_user_id ?? null,
                  };
                  const modalTitle = p?.full_name
                    ? `${p.full_name}${p?.email ? ` — ${p.email}` : ""}`
                    : (p?.email ?? r.user_id);
                  const hint = windowHint(r);
                  return (
                    <tr key={r.id} className="text-ink-800">
                      <td className="px-4 py-3">
                        <div className="leading-tight">
                          <div>{p?.full_name ?? "—"}</div>
                          {p?.email ? <div className="text-xs text-ink-500">{p.email}</div> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-label={`${canVerify ? "Review" : "View"} KYC for ${p?.full_name ?? p?.email ?? "member"}`}
                          className="text-sm font-medium text-azure-600 underline-offset-2 hover:text-azure-700 hover:underline"
                          onClick={() =>
                            setKycPreview({
                              userId: r.user_id,
                              title: modalTitle,
                              details: kycDetails,
                            })
                          }
                        >
                          {canVerify ? "Review KYC" : "View"}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {p ? String(p.device_user_id).padStart(4, "0") : "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">{r.plan_kind.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3" title={r.plan_kind === "long_term" ? "Long-term" : "Short-term"}>
                        <MembershipSeatTableCell
                          plan_kind={r.plan_kind}
                          seat_number={r.seat_number}
                          status={r.status}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <MembershipStatusBadge s={r.status} windowState={r.window_state} />
                          {hint ? <div className="text-xs text-ink-500">{hint}</div> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-600">{formatMembershipPeriod(r)}</td>
                      <td className="px-4 py-3 text-xs text-ink-500">{formatDateTimeDdMmYyyy(r.created_at)}</td>
                      <td className="px-4 py-3">
                        {v === "approved" ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                            Verified
                          </span>
                        ) : canVerify ? (
                          <span className="text-xs text-amber-800">Awaiting review</span>
                        ) : v === "rejected" ? (
                          <span className="text-xs font-medium text-red-700">Rejected</span>
                        ) : v === "resubmit" ? (
                          <span className="text-xs font-medium text-violet-800">Re-upload</span>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {kycPreview ? (
        <MemberKycDocumentsModal
          userId={kycPreview.userId}
          memberTitle={kycPreview.title}
          details={kycPreview.details}
          onClose={() => setKycPreview(null)}
          onAfterDecision={() => {
            setRefreshKey((k) => k + 1);
            setKycPreview(null);
          }}
        />
      ) : null}
    </div>
  );
}
