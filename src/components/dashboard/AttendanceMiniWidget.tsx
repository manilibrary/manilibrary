"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusBadge from "./StatusBadge";
import { hasTime, sortRecords, statusLabel, todayDMY, type PunchRecord } from "@/lib/attendance";

type State = "loading" | "ok" | "error";

function todayStr() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${now.getFullYear()}`;
}

const T = todayStr();
const MOCK: PunchRecord[] = [
  { Empcode: "0001", Name: "Aditya Raj", INTime: "08:12", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "P", DateString: T, Remark: "M-EI", Erl_Out: "00:00", Late_In: "00:12" },
  { Empcode: "0002", Name: "Priya Singh", INTime: "07:55", OUTTime: "18:10", WorkTime: "10:15", OverTime: "00:15", BreakTime: "00:00", Status: "P", DateString: T, Remark: "M-EI-OT", Erl_Out: "00:00", Late_In: "00:00" },
  { Empcode: "0003", Name: "Rohit Kumar", INTime: "--:--", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "A", DateString: T, Remark: "--", Erl_Out: "00:00", Late_In: "00:00" },
  { Empcode: "0004", Name: "Neha Sharma", INTime: "09:02", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "P", DateString: T, Remark: "M-EI", Erl_Out: "00:00", Late_In: "01:02" },
  { Empcode: "0005", Name: "Vikram Mishra", INTime: "07:30", OUTTime: "14:00", WorkTime: "06:30", OverTime: "00:00", BreakTime: "00:00", Status: "HD", DateString: T, Remark: "M-EI", Erl_Out: "04:00", Late_In: "00:00" },
  { Empcode: "0006", Name: "Anjali Verma", INTime: "08:00", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "P", DateString: T, Remark: "M-EI", Erl_Out: "00:00", Late_In: "00:00" },
  { Empcode: "0007", Name: "Saurav Gupta", INTime: "--:--", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "A", DateString: T, Remark: "--", Erl_Out: "00:00", Late_In: "00:00" },
  { Empcode: "0008", Name: "Megha Pandey", INTime: "08:45", OUTTime: "--:--", WorkTime: "00:00", OverTime: "00:00", BreakTime: "00:00", Status: "P", DateString: T, Remark: "M-EI", Erl_Out: "00:00", Late_In: "00:45" },
];

export default function AttendanceMiniWidget() {
  const [state, setState] = useState<State>("loading");
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [source, setSource] = useState<"live" | "mock">("mock");

  useEffect(() => {
    const now = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const from30 = new Date(now); from30.setDate(now.getDate() - 30);
    fetch(`/api/attendance?from=${fmt(from30)}&to=${fmt(now)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rows: PunchRecord[] = data.InOutPunchData ?? [];
        setRecords(rows);
        setSource("live");
        setState("ok");
      })
      .catch(() => {
        setRecords(MOCK);
        setSource("mock");
        setState("ok");
      });
  }, []);

  const today = todayDMY();

  // pick the most recent date that has records
  const latestDate = records.reduce<string | null>((best, r) => {
    if (!best) return r.DateString;
    const toMs = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(y, m - 1, d).getTime(); };
    return toMs(r.DateString) > toMs(best) ? r.DateString : best;
  }, null) ?? today;

  const todayRecords = sortRecords(records.filter((r) => r.DateString === latestDate));
  const present = todayRecords.filter((r) => r.Status === "P");
  const absent = todayRecords.filter((r) => r.Status === "A");
  const preview = todayRecords.slice(0, 6);

  return (
    <section className="rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink-900">
            Today&rsquo;s attendance
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {state === "loading"
              ? "Loading biometric data…"
              : `${present.length} present · ${absent.length} absent · ${latestDate}`}
            {source === "mock" && state === "ok" && (
              <span className="ml-2 font-semibold text-azure-600">(sample data)</span>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/attendance"
          className="text-xs font-semibold text-azure-500 hover:text-azure-600"
        >
          Full report →
        </Link>
      </div>

      {state === "loading" ? (
        <div className="flex items-center justify-center py-16 text-sm text-ink-400">
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
          </svg>
          Fetching punch data…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left font-mono text-[10px] uppercase tracking-widest text-ink-500">
                <th className="px-6 py-3 font-medium">Employee</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Check In</th>
                <th className="px-3 py-3 font-medium">Check Out</th>
                <th className="px-6 py-3 font-medium">Work Time</th>
              </tr>
            </thead>
            <tbody>
              {preview.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-ink-500">
                    No punch records for today.
                  </td>
                </tr>
              ) : (
                preview.map((r, i) => (
                  <tr key={`${r.Empcode}-${i}`} className="border-b border-ink-50 last:border-0 hover:bg-surface-muted">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ${r.Status === "P" ? "bg-azure-100 text-azure-700" : "bg-ink-100 text-ink-600"}`}>
                          {r.Name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </span>
                        <div>
                          <p className="font-medium text-ink-900">{r.Name}</p>
                          <p className="font-mono text-[11px] text-ink-500">#{r.Empcode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge tone={r.Status === "P" ? "azure" : r.Status === "A" ? "danger" : "neutral"} dot>
                        {statusLabel(r.Status)}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-3 font-mono text-ink-800">
                      {hasTime(r.INTime) ? r.INTime : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-ink-800">
                      {hasTime(r.OUTTime) ? r.OUTTime : r.Status === "P" ? (
                        <span className="text-[11px] text-ink-400">Still in</span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono text-ink-700">
                      {hasTime(r.WorkTime) ? r.WorkTime : <span className="text-ink-300">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {todayRecords.length > 6 && (
        <div className="border-t border-ink-100 px-6 py-3 text-center">
          <Link href="/dashboard/attendance" className="text-xs font-semibold text-azure-500 hover:text-azure-600">
            View all {todayRecords.length} records →
          </Link>
        </div>
      )}
    </section>
  );
}
