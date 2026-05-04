"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import TableScroll from "@/components/dashboard/TableScroll";
import {
  formatDMY,
  hasTime,
  statusLabel,
  type PunchRecord,
} from "@/lib/attendance";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type Employee = {
  empcode: string;
  name: string;
  /** keyed by DateString, value = that day's record */
  records: Map<string, PunchRecord>;
};

type State =
  | { phase: "loading" }
  | { phase: "ok"; employees: Employee[]; latestDate: string; source: "live" | "mock" }
  | { phase: "error"; message: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function buildEmployees(records: PunchRecord[]): { employees: Employee[]; latestDate: string } {
  const map = new Map<string, Employee>();
  let latestMs = 0;
  let latestDate = "";

  for (const r of records) {
    if (!map.has(r.Empcode)) {
      map.set(r.Empcode, { empcode: r.Empcode, name: r.Name, records: new Map() });
    }
    map.get(r.Empcode)!.records.set(r.DateString, r);

    const [d, m, y] = r.DateString.split("/").map(Number);
    const ms = new Date(y, m - 1, d).getTime();
    if (ms > latestMs) { latestMs = ms; latestDate = r.DateString; }
  }

  return {
    employees: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)),
    latestDate,
  };
}

function toneFor(status: string): "azure" | "danger" | "warn" | "neutral" {
  if (status === "P") return "azure";
  if (status === "A") return "danger";
  if (status === "HD") return "warn";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function MembersClient() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    const now = new Date();
    const from30 = new Date(now);
    from30.setDate(now.getDate() - 30);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    try {
      const res = await fetch(`/api/attendance?from=${fmt(from30)}&to=${fmt(now)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const records: PunchRecord[] = data.InOutPunchData ?? [];
      const { employees, latestDate } = buildEmployees(records);
      setState({ phase: "ok", employees, latestDate, source: "live" });
    } catch {
      const { employees, latestDate } = buildEmployees(MOCK_RECORDS);
      setState({ phase: "ok", employees, latestDate, source: "mock" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { employees, latestDate, source } =
    state.phase === "ok"
      ? state
      : { employees: [], latestDate: "", source: "mock" as const };

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (query) {
        const q = query.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.empcode.toLowerCase().includes(q))
          return false;
      }
      if (statusFilter !== "all") {
        const latest = latestDate ? e.records.get(latestDate) : undefined;
        const s = latest?.Status ?? "A";
        if (statusFilter === "WO" && s !== "WO" && s !== "H") return false;
        if (statusFilter !== "WO" && s !== statusFilter) return false;
      }
      return true;
    });
  }, [employees, query, statusFilter, latestDate]);

  const countFor = (sf: string) =>
    sf === "all"
      ? employees.length
      : employees.filter((e) => {
          const s = latestDate ? (e.records.get(latestDate)?.Status ?? "A") : "A";
          if (sf === "WO") return s === "WO" || s === "H";
          return s === sf;
        }).length;

  if (state.phase === "loading") return <Skeleton />;

  return (
    <div className="space-y-4">
      {source === "mock" && (
        <div className="rounded-xl border border-dashed border-azure-200 bg-azure-50/60 px-5 py-3 text-sm text-azure-800">
          Biometric API offline — showing sample data.
        </div>
      )}

      <div className="rounded-2xl border border-ink-100 bg-white shadow-card">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
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
                    : s === "P" ? `Present (${countFor("P")})`
                    : s === "A" ? `Absent (${countFor("A")})`
                    : s === "HD" ? `Half (${countFor("HD")})`
                    : `WO (${countFor("WO")})`}
                </button>
              ))}
            </div>
            {latestDate && (
              <span className="hidden shrink-0 rounded-full border border-azure-200 bg-azure-50 px-3 py-1.5 font-mono text-[10px] font-semibold text-azure-700 md:inline-block">
                as of {formatDMY(latestDate)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="relative block w-full lg:w-72">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or code…"
                className="w-full rounded-full border border-ink-200 bg-white py-2 pl-10 pr-4 text-sm text-ink-800 placeholder-ink-400 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
              />
            </label>
            <button
              type="button"
              onClick={load}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-600 hover:bg-ink-50"
              title="Refresh"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 3" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable table with sticky first column */}
        <TableScroll>
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <th className="sticky-col border-b border-ink-100 px-5 py-3 font-medium">Employee</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Latest status</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Check in</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Check out</th>
                <th className="border-b border-ink-100 px-3 py-3 font-medium">Work time</th>
                <th className="border-b border-ink-100 px-5 py-3 font-medium">Remark</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-ink-500">
                    No members match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const latest = latestDate ? e.records.get(latestDate) : undefined;
                  const status = latest?.Status ?? "—";
                  return (
                    <tr key={e.empcode}>
                      <td className="sticky-col whitespace-nowrap border-b border-ink-50 px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={e.name} status={status} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">{e.name}</p>
                            <p className="truncate font-mono text-[11px] text-ink-500">
                              #{e.empcode}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5">
                        {latest ? (
                          <StatusBadge tone={toneFor(latest.Status)} dot>
                            {statusLabel(latest.Status)}
                          </StatusBadge>
                        ) : (
                          <span className="text-ink-300 text-xs">No data</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5 font-mono text-ink-800">
                        {latest && hasTime(latest.INTime)
                          ? latest.INTime
                          : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5 font-mono text-ink-800">
                        {latest && hasTime(latest.OUTTime)
                          ? latest.OUTTime
                          : latest?.Status === "P"
                          ? <span className="text-[11px] text-ink-400">Still in</span>
                          : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-ink-50 px-3 py-3.5 font-mono text-ink-700">
                        {latest && hasTime(latest.WorkTime)
                          ? latest.WorkTime
                          : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-ink-50 px-5 py-3.5 font-mono text-[11px] text-ink-500">
                        {latest?.Remark && latest.Remark !== "--"
                          ? latest.Remark
                          : ""}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableScroll>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
          <span className="font-mono">
            {filtered.length} of {employees.length} employees
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-azure-200 bg-azure-50 px-2.5 py-1 font-mono text-[10px] font-semibold text-azure-700">
            <span className="h-1.5 w-1.5 rounded-full bg-azure-500" />
            {source === "live" ? "live data" : "sample data"}
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

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 rounded-2xl bg-ink-100" />
      <div className="h-72 rounded-2xl bg-ink-100" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock data fallback                                                  */
/* ------------------------------------------------------------------ */

function todayStr() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${now.getFullYear()}`;
}

const T = todayStr();
const MOCK_RECORDS: PunchRecord[] = [
  { Empcode: "0001", Name: "Aditya Raj", INTime: "08:12", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "P", DateString: T, Remark: "M-EI", Erl_Out: "00:00", Late_In: "00:12" },
  { Empcode: "0002", Name: "Priya Singh", INTime: "07:55", OUTTime: "18:10", WorkTime: "10:15", OverTime: "00:15", BreakTime: "00:00", Status: "P", DateString: T, Remark: "M-EI-OT", Erl_Out: "00:00", Late_In: "00:00" },
  { Empcode: "0003", Name: "Rohit Kumar", INTime: "--:--", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "A", DateString: T, Remark: "--", Erl_Out: "00:00", Late_In: "00:00" },
  { Empcode: "0004", Name: "Neha Sharma", INTime: "09:02", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "P", DateString: T, Remark: "M-EI", Erl_Out: "00:00", Late_In: "01:02" },
  { Empcode: "0005", Name: "Vikram Mishra", INTime: "07:30", OUTTime: "14:00", WorkTime: "06:30", OverTime: "00:00", BreakTime: "00:00", Status: "HD", DateString: T, Remark: "M-EI", Erl_Out: "04:00", Late_In: "00:00" },
];
