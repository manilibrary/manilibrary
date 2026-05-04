"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import TableScroll from "@/components/dashboard/TableScroll";
import {
  formatDMY,
  hasTime,
  sortRecords,
  statusLabel,
  todayDMY,
  type PunchRecord,
} from "@/lib/attendance";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

type Tone = "azure" | "ok" | "warn" | "danger" | "neutral";

function statusTone(status: string): Tone {
  switch (status) {
    case "P":  return "azure";
    case "A":  return "danger";
    case "HD": return "warn";
    default:   return "neutral";
  }
}

type FetchState =
  | { state: "loading" }
  | { state: "ok"; records: PunchRecord[]; source: "live" | "mock" };

function getDateRange(daysBack: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - daysBack);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export default function AttendanceClient() {
  const [fetchState, setFetchState] = useState<FetchState>({ state: "loading" });
  const [selectedDate, setSelectedDate] = useState(todayDMY());
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async (daysBack = 30) => {
    setFetchState({ state: "loading" });
    const { from, to } = getDateRange(daysBack);
    try {
      const res = await fetch(`/api/attendance?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFetchState({ state: "ok", records: data.InOutPunchData ?? [], source: "live" });
    } catch {
      setFetchState({ state: "ok", records: MOCK_RECORDS, source: "mock" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const records = fetchState.state === "ok" ? sortRecords(fetchState.records) : [];
  const source  = fetchState.state === "ok" ? fetchState.source : "mock";

  const uniqueDates = useMemo(() => {
    const toMs = (s: string) => {
      const [d, m, y] = s.split("/").map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    return [...new Set(records.map((r) => r.DateString))].sort((a, b) => toMs(b) - toMs(a));
  }, [records]);

  useEffect(() => {
    if (uniqueDates.length > 0) setSelectedDate(uniqueDates[0]);
  }, [uniqueDates]);

  const forDate = useMemo(
    () => records.filter((r) => r.DateString === selectedDate),
    [records, selectedDate]
  );

  const displayed = useMemo(() => {
    return forDate.filter((r) => {
      if (statusFilter !== "all") {
        if (statusFilter === "WO" && r.Status !== "WO" && r.Status !== "H") return false;
        if (statusFilter !== "WO" && r.Status !== statusFilter) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        if (
          !r.Name.toLowerCase().includes(q) &&
          !r.Empcode.toLowerCase().includes(q) &&
          !r.Remark.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [forDate, statusFilter, query]);

  const countFor = (s: string) =>
    s === "all" ? forDate.length
    : s === "WO" ? forDate.filter((r) => r.Status === "WO" || r.Status === "H").length
    : forDate.filter((r) => r.Status === s).length;

  const today = todayDMY();

  if (fetchState.state === "loading") return <Skeleton />;

  return (
    <div className="space-y-5">
      {source === "mock" && (
        <p className="rounded-xl border border-dashed border-azure-200 bg-azure-50/60 px-4 py-3 text-sm font-semibold text-azure-800">
          Biometric API offline — showing sample data.
        </p>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Present"          value={countFor("P")}  hint={formatDMY(selectedDate)} accent="azure" />
        <Kpi label="Absent"           value={countFor("A")}  hint={formatDMY(selectedDate)} />
        <Kpi label="Half day"         value={countFor("HD")} hint={formatDMY(selectedDate)} />
        <Kpi label="Week off / Hol."  value={countFor("WO")} hint={formatDMY(selectedDate)} />
      </section>

      <div className="rounded-2xl border border-ink-100 bg-white shadow-card">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            {uniqueDates.length > 0 && (
              <div className="relative min-w-0 flex-1 lg:flex-none">
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full appearance-none rounded-full border border-ink-200 bg-white py-2 pl-4 pr-8 text-sm font-medium text-ink-800 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
                >
                  {uniqueDates.map((d) => (
                    <option key={d} value={d}>
                      {d === today ? `Today (${formatDMY(d)})` : formatDMY(d)}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 8 4 4 4-4" />
                  </svg>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-50"
              title="Refresh"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 3" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-full border border-ink-100 bg-surface-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(["all", "P", "A", "HD", "WO"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {s === "all" ? `All (${countFor("all")})`
                  : s === "P"  ? `Present (${countFor("P")})`
                  : s === "A"  ? `Absent (${countFor("A")})`
                  : s === "HD" ? `Half (${countFor("HD")})`
                  : `WO (${countFor("WO")})`}
              </button>
            ))}
          </div>

          <label className="relative block lg:w-72">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, code, remark…"
              className="w-full rounded-full border border-ink-200 bg-white py-2 pl-10 pr-4 text-sm text-ink-800 placeholder-ink-400 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
            />
          </label>
        </div>

        {/* Scrollable table with sticky first column */}
        <TableScroll>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <th className="sticky-col border-b border-ink-100 px-5 py-3 font-medium">Employee</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Status</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Check In</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Check Out</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Work Time</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Late In</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Early Out</th>
                <th className="border-b border-ink-100 px-5 py-3 font-medium">Remark</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-sm text-ink-500">
                    No records for this date / filter.
                  </td>
                </tr>
              ) : (
                displayed.map((r, i) => (
                  <tr key={`${r.Empcode}-${i}`}>
                    <td className="sticky-col whitespace-nowrap border-b border-ink-50 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.Name} status={r.Status} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900">{r.Name}</p>
                          <p className="truncate font-mono text-[11px] text-ink-500">#{r.Empcode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5">
                      <StatusBadge tone={statusTone(r.Status)} dot>{statusLabel(r.Status)}</StatusBadge>
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5 font-mono text-ink-900">
                      {hasTime(r.INTime) ? r.INTime : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5 font-mono text-ink-900">
                      {hasTime(r.OUTTime) ? r.OUTTime
                        : r.Status === "P" ? <span className="text-[11px] text-ink-400">Still in</span>
                        : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5 font-mono text-ink-700">
                      {hasTime(r.WorkTime) ? r.WorkTime : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5 font-mono">
                      {hasTime(r.Late_In)
                        ? <span className="text-azure-600">{r.Late_In}</span>
                        : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5 font-mono">
                      {hasTime(r.Erl_Out) ? r.Erl_Out : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap border-b border-ink-50 px-5 py-3.5 font-mono text-[11px] text-ink-500">
                      {r.Remark !== "--" ? r.Remark : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
          <span className="font-mono">
            {displayed.length} of {forDate.length} · {formatDMY(selectedDate)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-azure-200 bg-azure-50 px-2.5 py-1 font-mono text-[10px] font-semibold text-azure-700">
            <span className="h-1.5 w-1.5 rounded-full bg-azure-500" />
            {source === "live" ? "live" : "sample data"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Avatar({ name, status }: { name: string; status: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
      status === "P" ? "bg-azure-100 text-azure-700" : "bg-ink-100 text-ink-600"
    }`}>
      {initials || "?"}
    </span>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: number; hint?: string; accent?: "azure" }) {
  return (
    <article className={`rounded-2xl border p-4 shadow-card md:p-5 ${
      accent === "azure" ? "border-azure-200 bg-azure-50/50" : "border-ink-100 bg-white"
    }`}>
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">{value}</p>
      {hint && <p className="mt-1 font-mono text-[10px] text-ink-400">{hint}</p>}
    </article>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-ink-100" />)}
      </div>
      <div className="h-72 rounded-2xl bg-ink-100" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

function todayStr() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${now.getFullYear()}`;
}

const T = todayStr();
const MOCK_RECORDS: PunchRecord[] = [
  { Empcode: "0001", Name: "Aditya Raj",    INTime: "08:12", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "P",  DateString: T, Remark: "M-EI",    Erl_Out: "00:00", Late_In: "00:12" },
  { Empcode: "0002", Name: "Priya Singh",   INTime: "07:55", OUTTime: "18:10", WorkTime: "10:15", OverTime: "00:15", BreakTime: "00:00", Status: "P",  DateString: T, Remark: "M-EI-OT", Erl_Out: "00:00", Late_In: "00:00" },
  { Empcode: "0003", Name: "Rohit Kumar",   INTime: "--:--", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "A",  DateString: T, Remark: "--",       Erl_Out: "00:00", Late_In: "00:00" },
  { Empcode: "0004", Name: "Neha Sharma",   INTime: "09:02", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "P",  DateString: T, Remark: "M-EI",    Erl_Out: "00:00", Late_In: "01:02" },
  { Empcode: "0005", Name: "Vikram Mishra", INTime: "07:30", OUTTime: "14:00", WorkTime: "06:30", OverTime: "00:00", BreakTime: "00:00", Status: "HD", DateString: T, Remark: "M-EI",    Erl_Out: "04:00", Late_In: "00:00" },
];
