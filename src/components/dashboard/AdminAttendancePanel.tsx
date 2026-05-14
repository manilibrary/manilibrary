"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import {
  ADMIN_ATTENDANCE_SESSION_TTL_MS,
  adminAttendancePanelDailyKey,
  adminAttendancePanelPunchesKey,
  readAdminAttendanceSessionCache,
  writeAdminAttendanceSessionCache,
} from "@/lib/client/admin-attendance-session-cache";
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

const control =
  "h-10 w-full min-w-0 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 shadow-sm outline-none transition focus:border-azure-500 focus:ring-2 focus:ring-azure-500/20";

const btnPrimary =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-azure-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-azure-600 disabled:pointer-events-none disabled:opacity-50";

const btnOutline =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-800 shadow-sm transition hover:bg-ink-50 disabled:pointer-events-none disabled:opacity-50";

const fieldLabel = "mb-1.5 block text-xs font-medium text-ink-700";

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

  useLayoutEffect(() => {
    const dKey = adminAttendancePanelDailyKey(fromIso, toIso, empcode);
    const pKey = adminAttendancePanelPunchesKey(fromIso, toIso);
    const cachedDaily = readAdminAttendanceSessionCache<{
      items: DailyItem[];
      skippedDaily: number;
      info: string | null;
    }>(dKey, ADMIN_ATTENDANCE_SESSION_TTL_MS);
    if (cachedDaily) {
      setItems(cachedDaily.items);
      setSkippedDaily(cachedDaily.skippedDaily);
      setInfo(cachedDaily.info);
    } else {
      setItems([]);
      setSkippedDaily(0);
      setInfo(null);
    }
    const cachedPunches = readAdminAttendanceSessionCache<{
      items: PunchItem[];
      skippedPunches: number;
    }>(pKey, ADMIN_ATTENDANCE_SESSION_TTL_MS);
    if (cachedPunches) {
      setLivePunches(cachedPunches.items);
      setSkippedPunches(cachedPunches.skippedPunches);
    } else {
      setLivePunches([]);
      setSkippedPunches(0);
    }
    setErr(null);
    setLiveErr(null);
  }, [fromIso, toIso, empcode]);

  const loadDaily = useCallback(async () => {
    setBusy(true);
    setErr(null);
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
        setItems((prev) => (prev.length > 0 ? prev : []));
        return;
      }
      const nextItems = j.items ?? [];
      const nextSkipped = j.skipped_unregistered ?? 0;
      let nextInfo: string | null = null;
      if (nextItems.length === 0) {
        nextInfo =
          "No gate activity for that date range yet. If someone just checked in, wait a short while and tap Refresh.";
      } else if (j.source === "derived-from-punches") {
        nextInfo =
          "The gate did not return a ready-made day summary for this range, so in and out times were worked out from individual check-ins (first tap of the day treated as in, last as out).";
      }
      setItems(nextItems);
      setSkippedDaily(nextSkipped);
      setInfo(nextInfo);
      writeAdminAttendanceSessionCache(adminAttendancePanelDailyKey(fromIso, toIso, empcode), {
        items: nextItems,
        skippedDaily: nextSkipped,
        info: nextInfo,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
      setItems((prev) => (prev.length > 0 ? prev : []));
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
        setLivePunches((prev) => (prev.length > 0 ? prev : []));
        return;
      }
      const nextPunches = j.items ?? [];
      const nextSkippedP = j.skipped_unregistered ?? 0;
      setLivePunches(nextPunches);
      setSkippedPunches(nextSkippedP);
      writeAdminAttendanceSessionCache(adminAttendancePanelPunchesKey(fromIso, toIso), {
        items: nextPunches,
        skippedPunches: nextSkippedP,
      });
    } catch (e) {
      setLiveErr(e instanceof Error ? e.message : "Network error.");
      setLivePunches((prev) => (prev.length > 0 ? prev : []));
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <header className="border-b border-ink-100 pb-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">Daily summary</h2>
          <p className="mt-1 text-xs text-ink-500">Members only</p>
        </header>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-1 lg:flex-wrap lg:gap-4">
            <div className="w-full sm:max-w-[11.5rem]">
              <label htmlFor="att-from" className={fieldLabel}>
                From
              </label>
              <input
                id="att-from"
                type="date"
                className={control}
                value={fromIso}
                onChange={(e) => setFromIso(e.target.value)}
              />
            </div>
            <div className="w-full sm:max-w-[11.5rem]">
              <label htmlFor="att-to" className={fieldLabel}>
                To
              </label>
              <input
                id="att-to"
                type="date"
                className={control}
                value={toIso}
                onChange={(e) => setToIso(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0 sm:col-span-2 sm:max-w-xs lg:min-w-[12rem] lg:max-w-[14rem]">
              <label htmlFor="att-filter" className={fieldLabel}>
                Filter by member number <span className="font-normal text-ink-500">(optional)</span>
              </label>
              <input
                id="att-filter"
                className={`${control} font-mono`}
                placeholder="Leave blank for everyone"
                value={empcode}
                onChange={(e) => setEmpcode(e.target.value)}
              />
            </div>
          </div>
          <div className="flex shrink-0">
            <button
              type="button"
              onClick={() => {
                void loadDaily();
                void loadLatest();
              }}
              disabled={busy}
              aria-busy={busy}
              className={btnPrimary}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden
                  />
                  Refreshing
                </span>
              ) : (
                "Refresh"
              )}
            </button>
          </div>
        </div>

        {err ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {err}
          </p>
        ) : null}
        {info ? (
          <p className="mt-4 rounded-lg border border-azure-100 bg-azure-50 px-4 py-3 text-sm text-azure-900">
            {info}
          </p>
        ) : null}
        {skippedDaily > 0 ? (
          <p className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-700">
            Not shown: {skippedDaily} row{skippedDaily === 1 ? "" : "s"} from people on the gate who are not signed up
            as library members.
          </p>
        ) : null}
        {busy && items.length > 0 ? (
          <p className="mt-3 text-xs text-ink-500" role="status">
            Syncing with the server — table below is from this browser session until the refresh finishes.
          </p>
        ) : null}

        <div className="mt-5 overflow-x-auto rounded-lg border border-ink-100">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-surface-muted/90 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Date</th>
                <th className="whitespace-nowrap px-4 py-3">Member</th>
                <th className="whitespace-nowrap px-4 py-3">Library no.</th>
                <th className="whitespace-nowrap px-4 py-3">On reader</th>
                <th className="whitespace-nowrap px-4 py-3">Seat</th>
                <th className="whitespace-nowrap px-4 py-3">In</th>
                <th className="whitespace-nowrap px-4 py-3">Out</th>
                <th className="whitespace-nowrap px-4 py-3">Work</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-500">
                    {busy ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span
                          className="h-5 w-5 animate-spin rounded-full border-2 border-azure-200 border-t-azure-600"
                          aria-hidden
                        />
                        Loading…
                      </span>
                    ) : (
                      "No rows for this range."
                    )}
                  </td>
                </tr>
              ) : (
                items.map((r, i) => (
                  <tr key={`${r.empcode}-${r.date}-${i}`} className="text-ink-800">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.date}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3">{r.full_name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {r.device_user_id != null ? String(r.device_user_id).padStart(4, "0") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.empcode}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-mono text-xs">{r.seat_label ?? "—"}</div>
                      {r.coverage_warning ? (
                        <p
                          className="mt-1 max-w-[12rem] text-[10px] font-normal leading-snug text-amber-800"
                          role="status"
                        >
                          {r.coverage_warning}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-emerald-700">
                      {isDashTime(r.in_time) ? "—" : r.in_time}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-red-700">
                      {isDashTime(r.out_time) ? "—" : r.out_time}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.work_time || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
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

      <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 border-b border-ink-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <header>
            <h2 className="text-lg font-semibold tracking-tight text-ink-900">Recent check-ins</h2>
            <p className="mt-1 text-xs text-ink-500">Uses the same dates as above · Auto-refresh about every 30 seconds</p>
          </header>
          <button
            type="button"
            onClick={() => void loadLatest()}
            disabled={liveBusy}
            aria-busy={liveBusy}
            className={btnOutline}
          >
            {liveBusy ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-ink-700"
                  aria-hidden
                />
                Refreshing
              </span>
            ) : (
              "Refresh list"
            )}
          </button>
        </div>

        {liveErr ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {liveErr}
          </p>
        ) : null}
        {skippedPunches > 0 ? (
          <p className="mt-4 rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-700">
            Not shown: {skippedPunches} punch{skippedPunches === 1 ? "" : "es"} from people on the gate who are not
            library members.
          </p>
        ) : null}
        {liveBusy && livePunches.length > 0 ? (
          <p className="mt-3 text-xs text-ink-500" role="status">
            Updating check-ins from the server…
          </p>
        ) : null}

        <div className="mt-5 overflow-x-auto rounded-lg border border-ink-100">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-surface-muted/90 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Time</th>
                <th className="whitespace-nowrap px-4 py-3">Member</th>
                <th className="whitespace-nowrap px-4 py-3">Library no.</th>
                <th className="whitespace-nowrap px-4 py-3">On reader</th>
                <th className="whitespace-nowrap px-4 py-3">Flag</th>
                <th className="whitespace-nowrap px-4 py-3">Card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {livePunches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-500">
                    {liveBusy ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span
                          className="h-5 w-5 animate-spin rounded-full border-2 border-azure-200 border-t-azure-600"
                          aria-hidden
                        />
                        Loading…
                      </span>
                    ) : (
                      "No recent check-ins."
                    )}
                  </td>
                </tr>
              ) : (
                livePunches.map((r, i) => (
                  <tr
                    key={`${r.empcode}-${r.punch_date}-${r.id ?? i}`}
                    className="text-ink-800"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.punch_date}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3">{r.full_name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {r.device_user_id != null ? String(r.device_user_id).padStart(4, "0") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.empcode}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                        {r.flag ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.empcard || "—"}</td>
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
