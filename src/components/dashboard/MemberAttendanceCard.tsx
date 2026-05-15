"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMemberMeBootstrap } from "@/components/dashboard/MemberMeBootstrapProvider";
import { AttendanceTodaySkeleton } from "@/components/ui/ContentSkeletons";
import { attendanceAnchorYmd, ymdToDmy } from "@/lib/etime/attendance-anchor";
import { DEFAULT_LIBRARY_TZ } from "@/lib/membership/windows";

type DailyRow = {
  in_time: string;
  out_time: string;
  work_time: string;
  overtime: string;
  status: string;
  date: string;
  remark: string;
};

type Response = {
  ok: boolean;
  daily: DailyRow | null;
  history?: DailyRow[];
  attendanceDate?: string;
  today?: string;
  historyFromDmy?: string;
  note?: string | null;
  error?: string;
  hasIn?: boolean;
  hasOut?: boolean;
};

const POLL_MS = 5 * 60 * 1000;
const STORAGE_KEY = "manilibrary:me-attendance:v1:current";

type CachedEnvelope = {
  savedAt: number;
  data: Response;
};

function anchorDmyClient(): string {
  return ymdToDmy(attendanceAnchorYmd(new Date(), DEFAULT_LIBRARY_TZ));
}

function isDashTime(t: string | null | undefined): boolean {
  if (!t) return true;
  const trimmed = t.trim();
  return trimmed === "" || trimmed === "--:--";
}

function isPunchedOut(j: Response): boolean {
  if (!j.ok || !j.daily) return false;
  if (j.hasOut === true) return true;
  return !isDashTime(j.daily.out_time);
}

function readCachedForToday(): Response | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { data } = JSON.parse(raw) as CachedEnvelope;
    if (!data?.ok || !data.attendanceDate) return null;
    if (data.attendanceDate.trim() !== anchorDmyClient()) return null;
    if (!isPunchedOut(data)) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: Response): void {
  if (typeof window === "undefined") return;
  if (!data.ok || !data.attendanceDate) return;
  if (data.attendanceDate.trim() !== anchorDmyClient()) return;
  if (!isPunchedOut(data)) return;
  const env: CachedEnvelope = { savedAt: Date.now(), data };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(env));
}

function clearCache(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

function cellTime(t: string | null | undefined): string {
  if (!t || isDashTime(t)) return "—";
  return t.trim();
}

function statusText(s: string): string {
  const norm = s?.toUpperCase().trim();
  if (norm === "P") return "Present";
  if (norm === "A") return "Absent";
  if (norm === "WO") return "Week off";
  if (norm === "HLD") return "Holiday";
  return s?.trim() || "—";
}

function statusClass(s: string): string {
  const norm = s?.toUpperCase().trim();
  if (norm === "P") return "text-emerald-800";
  if (norm === "A") return "text-red-800";
  if (norm === "WO" || norm === "HLD") return "text-ink-600";
  return "text-ink-800";
}

const th =
  "border-b border-ink-200 bg-ink-50 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-500";
const td = "border-b border-ink-100 px-3 py-2.5 text-ink-900 tabular-nums";

function DailyRowCells({ row }: { row: DailyRow }) {
  const remark = row.remark?.trim() ?? "";
  return (
    <>
      <td className={`${td} font-medium text-ink-800`}>{row.date?.trim() || "—"}</td>
      <td className={td}>{cellTime(row.in_time)}</td>
      <td className={td}>{cellTime(row.out_time)}</td>
      <td className={td}>{row.work_time?.trim() || "—"}</td>
      <td className={td}>{row.overtime?.trim() || "—"}</td>
      <td className={`${td} font-medium ${statusClass(row.status ?? "")}`}>{statusText(row.status ?? "")}</td>
      <td className={`${td} max-w-[220px] truncate font-sans text-xs text-ink-600`} title={remark || undefined}>
        {remark || "—"}
      </td>
    </>
  );
}

export default function MemberAttendanceCard() {
  const boot = useMemberMeBootstrap();
  const bootRef = useRef(boot);
  useEffect(() => {
    bootRef.current = boot;
  }, [boot]);
  const [data, setData] = useState<Response | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [servedFromCache, setServedFromCache] = useState(false);
  const pollRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const load = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true;

      if (!force) {
        const cached = readCachedForToday();
        if (cached) {
          setData(cached);
          setErr(null);
          setServedFromCache(true);
          setBusy(false);
          clearPoll();
          return;
        }

        if (bootRef.current.ready && !bootRef.current.skipped && bootRef.current.attendance?.ok) {
          const j = bootRef.current.attendance as Response;
          setData(j);
          setErr(null);
          setServedFromCache(false);
          setBusy(false);
          if (isPunchedOut(j)) {
            writeCache(j);
            clearPoll();
          } else {
            clearCache();
          }
          return;
        }
      }

      setServedFromCache(false);
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch("/api/me/today-attendance", { cache: "no-store" });
        const j = (await res.json()) as Response;
        if (!res.ok || !j.ok) {
          setErr(j.error ?? "Could not load attendance.");
          setData(null);
          clearCache();
          return;
        }
        setData(j);
        if (isPunchedOut(j)) {
          writeCache(j);
          clearPoll();
        } else {
          clearCache();
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Network error.");
        setData(null);
      } finally {
        setBusy(false);
      }
    },
    [clearPoll],
  );

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      void load({ force: true });
    };

    void (async () => {
      await load({ force: false });
      if (cancelled) return;
      const after = () => {
        if (cancelled) return;
        clearPoll();
        const d = readCachedForToday();
        if (d) return;
        pollRef.current = window.setInterval(tick, POLL_MS);
      };
      after();
    })();

    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [clearPoll, load]);

  if (!err && busy && !data) {
    return (
      <div className="space-y-6">
        <AttendanceTodaySkeleton />
        <AttendanceTodaySkeleton />
      </div>
    );
  }

  if (err) {
    return (
      <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/90">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 px-3 py-2">
          <span className="text-xs font-medium text-amber-950">Attendance</span>
          <button
            type="button"
            onClick={() => void load({ force: true })}
            className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
        <p className="px-3 py-3 text-sm text-amber-950">{err}</p>
      </div>
    );
  }

  const dayLabel = data?.attendanceDate ?? data?.today ?? "—";
  const daily = data?.daily ?? null;
  const history = data?.history ?? [];
  const historyFrom = data?.historyFromDmy;
  const dayComplete = data ? isPunchedOut(data) : false;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-ink-200 bg-ink-50/90 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-semibold text-ink-800">Today · {dayLabel}</span>
            <p className="text-[11px] leading-snug text-ink-500">
              In / out for the active attendance day. After 12:30 AM (library time) this row shows the new day; the
              previous day moves to the table below.
            </p>
            {servedFromCache ? (
              <p className="mt-1 text-[11px] text-ink-500">
                Loaded from this browser (punch-out complete for today). Use Refresh to sync with the server.
              </p>
            ) : dayComplete ? (
              <p className="mt-1 text-[11px] text-ink-500">
                Punch-out recorded — auto-refresh is off for today. Use Refresh if you need the latest from the
                server.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-ink-500">Updates every 5 minutes until punch-out, or use Refresh.</p>
            )}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load({ force: true })}
            className="shrink-0 self-start text-xs font-semibold text-ink-600 underline-offset-2 hover:text-ink-900 hover:underline disabled:opacity-50 sm:self-auto"
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>In</th>
                <th className={th}>Out</th>
                <th className={th}>Work</th>
                <th className={th}>OT</th>
                <th className={th}>Status</th>
                <th className={th}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {daily ? (
                <tr className="bg-white">
                  <DailyRowCells row={daily} />
                </tr>
              ) : (
                <tr className="bg-white">
                  <td className={`${td} text-ink-500`} colSpan={7}>
                    No summary row yet for this day.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data?.note ? (
          <p className="border-t border-ink-100 bg-ink-50/40 px-3 py-2 text-xs leading-relaxed text-ink-600">
            {data.note}
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
        <div className="border-b border-ink-200 bg-ink-50/90 px-3 py-2">
          <span className="text-xs font-semibold text-ink-800">Past attendance</span>
          <p className="text-[11px] text-ink-500">
            {historyFrom ? `Since ${historyFrom} · filler “Absent” rows with no punch are hidden.` : "Earlier days with real activity only."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>In</th>
                <th className={th}>Out</th>
                <th className={th}>Work</th>
                <th className={th}>OT</th>
                <th className={th}>Status</th>
                <th className={th}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr className="bg-white">
                  <td className={`${td} text-ink-500`} colSpan={7}>
                    No earlier days in this window.
                  </td>
                </tr>
              ) : (
                history.map((row, i) => (
                  <tr key={`${row.date}-${i}`} className="bg-white">
                    <DailyRowCells row={row} />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
