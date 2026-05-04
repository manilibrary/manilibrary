"use client";

import { useMemo, useState } from "react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import {
  formatDMY,
  hasTime,
  statusLabel,
  todayDMY,
  type PunchRecord,
} from "@/lib/attendance";

type Tone = "azure" | "ok" | "warn" | "danger" | "neutral";

function statusTone(status: string): Tone {
  switch (status) {
    case "P": return "azure";
    case "A": return "danger";
    case "HD": return "warn";
    default: return "neutral";
  }
}

export default function AttendanceTable({
  records,
  dates,
}: {
  records: PunchRecord[];
  dates: string[];
}) {
  const today = todayDMY();
  const [selectedDate, setSelectedDate] = useState(today);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const displayed = useMemo(() => {
    return records.filter((r) => {
      if (r.DateString !== selectedDate) return false;
      if (statusFilter !== "all" && r.Status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !r.Name.toLowerCase().includes(q) &&
          !r.Empcode.toLowerCase().includes(q) &&
          !r.Remark.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [records, selectedDate, statusFilter, query]);

  const counts = useMemo(() => {
    const forDate = records.filter((r) => r.DateString === selectedDate);
    return {
      all: forDate.length,
      P: forDate.filter((r) => r.Status === "P").length,
      A: forDate.filter((r) => r.Status === "A").length,
      HD: forDate.filter((r) => r.Status === "HD").length,
    };
  }, [records, selectedDate]);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white shadow-card">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 border-b border-ink-100 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date picker */}
          <div className="relative">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="appearance-none rounded-full border border-ink-200 bg-white py-2 pl-4 pr-8 text-sm font-medium text-ink-800 outline-none focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
            >
              {dates.map((d) => (
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

          {/* Status filter pills */}
          <div className="flex gap-1 rounded-full border border-ink-100 bg-surface-muted p-1">
            {(["all", "P", "A", "HD"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {s === "all" ? `All (${counts.all})` : s === "P" ? `Present (${counts.P})` : s === "A" ? `Absent (${counts.A})` : `Half day (${counts.HD})`}
              </button>
            ))}
          </div>
        </div>

        <label className="relative block w-full md:max-w-xs">
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
              <th className="px-6 py-3 font-medium">Employee</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Check In</th>
              <th className="px-3 py-3 font-medium">Check Out</th>
              <th className="px-3 py-3 font-medium">Work Time</th>
              <th className="px-3 py-3 font-medium">Late In</th>
              <th className="px-3 py-3 font-medium">Early Out</th>
              <th className="px-6 py-3 font-medium">Remark</th>
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
                <tr
                  key={`${r.Empcode}-${i}`}
                  className="border-b border-ink-50 last:border-0 transition-colors hover:bg-surface-muted"
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.Name} status={r.Status} />
                      <div>
                        <p className="font-medium text-ink-900">{r.Name}</p>
                        <p className="font-mono text-[11px] text-ink-500">
                          #{r.Empcode}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <StatusBadge tone={statusTone(r.Status)} dot>
                      {statusLabel(r.Status)}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3.5">
                    {hasTime(r.INTime) ? (
                      <span className="font-mono text-ink-900">{r.INTime}</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    {hasTime(r.OUTTime) ? (
                      <span className="font-mono text-ink-900">{r.OUTTime}</span>
                    ) : (
                      <span className="text-ink-400 text-[11px] font-mono">Still in</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 font-mono text-ink-700">
                    {hasTime(r.WorkTime) ? r.WorkTime : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="px-3 py-3.5 font-mono">
                    {hasTime(r.Late_In) ? (
                      <span className="text-azure-600">{r.Late_In}</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 font-mono">
                    {hasTime(r.Erl_Out) ? (
                      <span className="text-ink-700">{r.Erl_Out}</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-[11px] text-ink-500">
                    {r.Remark !== "--" ? r.Remark : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 px-6 py-3 text-xs text-ink-500">
        <span className="font-mono">
          showing {displayed.length} of {counts.all} · {formatDMY(selectedDate)}
        </span>
        {selectedDate === today && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-azure-200 bg-azure-50 px-2.5 py-1 font-mono text-[10px] font-semibold text-azure-700">
            <span className="h-1.5 w-1.5 rounded-full bg-azure-500" />
            live · updates every 5 min
          </span>
        )}
      </div>
    </div>
  );
}

function Avatar({ name, status }: { name: string; status: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${
        status === "P"
          ? "bg-azure-100 text-azure-700"
          : status === "A"
          ? "bg-ink-100 text-ink-600"
          : "bg-ink-50 text-ink-500"
      }`}
    >
      {initials}
    </span>
  );
}
