"use client";

import { useCallback, useEffect, useState } from "react";

import { formatDateDMY } from "@/lib/etime/dates";

type DailyItem = {
  date: string;
  empcode: string;
  device_user_id: number | null;
  full_name: string | null;
  seat_number: number | null;
  seat_label: string;
  coverage_warning?: string | null;
  in_time: string;
  out_time: string;
  work_time: string;
  status: string;
  status_ui?: string;
  status_ui_label?: string;
  remark: string;
  source?: "device-summary" | "derived-from-punches";
};

type PunchItem = {
  empcode: string;
  device_user_id: number | null;
  full_name: string | null;
  punch_date: string;
  flag: string | null;
  table: string;
  empcard: string;
  id: number | null;
  source?: "device-last-punch" | "device-mcid";
};

function isDashTime(t: string | null | undefined): boolean {
  if (!t) return true;
  const trimmed = t.trim();
  return trimmed === "" || trimmed === "--:--";
}

function isoToDMY(iso: string): string {
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function dmyToIso(dmy: string): string {
  const [dd, mm, yyyy] = dmy.split("/");
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function statusBadge(s: string): string {
  const norm = s?.toUpperCase().trim();
  if (norm === "P") return "bg-emerald-100 text-emerald-800";
  if (norm === "A") return "bg-red-100 text-red-800";
  if (norm === "WO") return "bg-ink-100 text-ink-700";
  if (norm === "HLD") return "bg-amber-100 text-amber-800";
  return "bg-ink-100 text-ink-700";
}

function statusLabel(s: string): string {
  const norm = s?.toUpperCase().trim();
  if (norm === "P") return "Present";
  if (norm === "A") return "Absent";
  if (norm === "WO") return "Week off";
  if (norm === "HLD") return "Holiday";
  return s || "—";
}

function statusBadgeUi(ui: string | undefined, deviceStatus: string): string {
  const u = ui?.trim();
  if (u === "pending") return "bg-azure-100 text-azure-800";
  if (u === "present") return "bg-emerald-100 text-emerald-800";
  if (u === "absent") return "bg-red-100 text-red-800";
  if (u === "week_off") return "bg-ink-100 text-ink-700";
  if (u === "holiday") return "bg-amber-100 text-amber-800";
  if (u === "other") return "bg-ink-100 text-ink-700";
  return statusBadge(deviceStatus);
}

function statusLabelUi(item: DailyItem): string {
  if (item.status_ui_label?.trim()) return item.status_ui_label;
  return statusLabel(item.status);
}

export default function AdminAttendancePanel() {
  const today = formatDateDMY(new Date());
  const todayIso = dmyToIso(today);

  const [fromIso, setFromIso] = useState(todayIso);
  const [toIso, setToIso] = useState(todayIso);
  const [empcode, setEmpcode] = useState("");
  const [items, setItems] = useState<DailyItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [livePunches, setLivePunches] = useState<PunchItem[]>([]);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveErr, setLiveErr] = useState<string | null>(null);
  const [skippedDaily, setSkippedDaily] = useState(0);
  const [skippedPunches, setSkippedPunches] = useState(0);

  const loadDaily = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const params = new URLSearchParams({
        fromDate: isoToDMY(fromIso),
        toDate: isoToDMY(toIso),
      });
      const trimmed = empcode.trim();
      if (trimmed) params.set("empcode", trimmed);
      const res = await fetch(`/api/admin/attendance/daily?${params.toString()}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        items?: DailyItem[];
        source?: "device-summary" | "derived-from-punches";
        skipped_unregistered?: number;
      };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load attendance.");
        setItems([]);
        setSkippedDaily(0);
        return;
      }
      setItems(j.items ?? []);
      setSkippedDaily(j.skipped_unregistered ?? 0);
      if ((j.items ?? []).length === 0) {
        setInfo(
          "No punches recorded by the device for that range. If a member just tapped in, it can take a minute to sync to the cloud.",
        );
      } else if (j.source === "derived-from-punches") {
        setInfo(
          "The device’s daily in/out summary was unavailable for this range, so the table was computed from raw punches (earliest = IN, latest = OUT).",
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }, [fromIso, toIso, empcode]);

  const loadLatest = useCallback(async () => {
    setLiveBusy(true);
    setLiveErr(null);
    try {
      const params = new URLSearchParams();
      if (fromIso === toIso && /^\d{4}-\d{2}-\d{2}$/.test(fromIso)) {
        params.set("forYmd", fromIso);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(fromIso) && /^\d{4}-\d{2}-\d{2}$/.test(toIso)) {
        params.set("fromYmd", fromIso);
        params.set("toYmd", toIso);
      }
      const res = await fetch(`/api/admin/attendance/last-punches?${params.toString()}`, { cache: "no-store" });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        items?: PunchItem[];
        source?: "device-last-punch" | "device-mcid";
        skipped_unregistered?: number;
      };
      if (!res.ok || !j.ok) {
        setLiveErr(j.error ?? "Could not load latest punches.");
        setLivePunches([]);
        setSkippedPunches(0);
        return;
      }
      setLivePunches(j.items ?? []);
      setSkippedPunches(j.skipped_unregistered ?? 0);
    } catch (e) {
      setLiveErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLiveBusy(false);
    }
  }, [fromIso, toIso]);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void loadDaily();
      void loadLatest();
    }, 0);
    const id = window.setInterval(() => void loadLatest(), 30_000);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(id);
    };
  }, [loadDaily, loadLatest]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
              In / Out summary
            </p>
            <p className="mt-0.5 text-sm text-ink-600">
              Pulled from eTimeOffice. Only library members (matched to{" "}
              <span className="font-mono">profiles.device_user_id</span>) are shown — device-only enrolments are hidden.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              From
              <input
                type="date"
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                value={fromIso}
                onChange={(e) => setFromIso(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              To
              <input
                type="date"
                className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
                value={toIso}
                onChange={(e) => setToIso(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-600">
              Empcode (optional)
              <input
                className="w-40 rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
                placeholder="ALL"
                value={empcode}
                onChange={(e) => setEmpcode(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                void loadDaily();
                void loadLatest();
              }}
              disabled={busy}
              className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
            >
              {busy ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {err ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {err}
          </p>
        ) : null}
        {info ? (
          <p className="mt-4 rounded-lg border border-azure-100 bg-azure-50 px-4 py-3 text-sm text-azure-800">
            {info}
          </p>
        ) : null}
        {skippedDaily > 0 ? (
          <p className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-700">
            Hidden: {skippedDaily} row{skippedDaily === 1 ? "" : "s"} from people enrolled on the
            device but not registered with the library.
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Device user ID</th>
                <th className="px-4 py-3">Empcode</th>
                <th className="px-4 py-3">Seat</th>
                <th className="px-4 py-3">In</th>
                <th className="px-4 py-3">Out</th>
                <th className="px-4 py-3">Work</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-sm text-ink-500">
                    {busy ? "Loading…" : "No rows yet."}
                  </td>
                </tr>
              ) : (
                items.map((r, i) => (
                  <tr key={`${r.empcode}-${r.date}-${i}`} className="text-ink-800">
                    <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                    <td className="px-4 py-3">{r.full_name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.device_user_id != null ? String(r.device_user_id).padStart(4, "0") : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.empcode}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono">{r.seat_label ?? "—"}</div>
                      {r.coverage_warning ? (
                        <p
                          className="mt-1 max-w-[12rem] text-[10px] font-sans font-normal leading-snug text-amber-800"
                          role="status"
                        >
                          {r.coverage_warning}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-700">
                      {isDashTime(r.in_time) ? "—" : r.in_time}
                    </td>
                    <td className="px-4 py-3 font-mono text-red-700">
                      {isDashTime(r.out_time) ? "—" : r.out_time}
                    </td>
                    <td className="px-4 py-3 font-mono">{r.work_time || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeUi(r.status_ui, r.status)}`}
                      >
                        {statusLabelUi(r)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
              Latest device punches
            </p>
            <p className="mt-0.5 text-sm text-ink-600">
              Live tail of the biometric device. Only library members are shown. When From and To are the same date,
              punches are limited to that day; otherwise the range matches From–To. Auto-refreshes every 30 seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadLatest()}
            disabled={liveBusy}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            {liveBusy ? "Loading…" : "Refresh now"}
          </button>
        </div>

        {liveErr ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {liveErr}
          </p>
        ) : null}
        {skippedPunches > 0 ? (
          <p className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-700">
            Hidden: {skippedPunches} punch{skippedPunches === 1 ? "" : "es"} from device-only enrolments.
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-surface-muted/80 font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Device user ID</th>
                <th className="px-4 py-3">Empcode</th>
                <th className="px-4 py-3">Flag</th>
                <th className="px-4 py-3">Card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {livePunches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-ink-500">
                    {liveBusy ? "Loading…" : "No recent punches."}
                  </td>
                </tr>
              ) : (
                livePunches.map((r, i) => (
                  <tr
                    key={`${r.empcode}-${r.punch_date}-${r.id ?? i}`}
                    className="text-ink-800"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.punch_date}</td>
                    <td className="px-4 py-3">{r.full_name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.device_user_id != null ? String(r.device_user_id).padStart(4, "0") : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.empcode}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                        {r.flag ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.empcard || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
