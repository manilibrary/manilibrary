"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import MemberKycDocumentsModal, { type MemberKycDetails } from "@/components/dashboard/MemberKycDocumentsModal";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from "@/lib/date-format";
import { MembershipSeatTableCell } from "@/components/membership/MembershipSeatTableCell";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { addDaysYmd, DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";

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

type MemberBrowseFilter = "all" | "verified" | "pending" | "unverified" | "pending_payment" | "expired";

function matchesMemberBrowseFilter(v: string | undefined, f: MemberBrowseFilter, r: MembershipRow): boolean {
  const expired = isMembershipWindowExpired(r);
  const pendingPay = isPendingPaymentMembership(r);

  if (f === "expired") return expired;
  if (f === "pending_payment") return pendingPay;

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
  { id: "verified", label: "Verified" },
  { id: "pending", label: "Pending review" },
  { id: "unverified", label: "Unverified" },
  { id: "pending_payment", label: "Pending payments" },
  { id: "expired", label: "Expired" },
];

export default function StaffMembershipsPanel() {
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [browseFilter, setBrowseFilter] = useState<MemberBrowseFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [kycPreview, setKycPreview] = useState<{
    userId: string;
    title: string;
    details: MemberKycDetails;
  } | null>(null);

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
    };
    if (!res.ok || !j.ok) {
      throw new Error(j.error ?? "Could not load members.");
    }
    setErr(null);
    setRows(j.rows ?? []);
    setProfiles(j.profiles ?? {});
  }, []);

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
      const member = p
        ? `${p.full_name} ${String(p.device_user_id).padStart(4, "0")} ${p.email ?? ""} ${p.aadhaar_last_four ?? ""} ${p.student_roll_number ?? ""} ${p.institution_type ?? ""} ${p.preparing_for ?? ""} ${v} ${expiredTag} ${pendingPayTag}`
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
        <p className="text-sm text-ink-600">No membership rows yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3">Device user ID</th>
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
