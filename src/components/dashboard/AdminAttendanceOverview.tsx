"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useState } from "react";

import {
  ADMIN_ATTENDANCE_SESSION_TTL_MS,
  adminAttendanceOverviewDailyKey,
  adminAttendanceOverviewPunchesKey,
  readAdminAttendanceSessionCache,
  writeAdminAttendanceSessionCache,
} from "@/lib/client/admin-attendance-session-cache";

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
};

type PunchItem = {
  empcode: string;
  device_user_id: number | null;
  full_name: string | null;
  punch_date: string;
  flag: string | null;
};

function isDashTime(t: string | null | undefined): boolean {
  if (!t) return true;
  const trimmed = t.trim();
  return trimmed === "" || trimmed === "--:--";
}

export default function AdminAttendanceOverview() {
  const [daily, setDaily] = useState<DailyItem[] | null>(null);
  const [dailyErr, setDailyErr] = useState<string | null>(null);
  const [punches, setPunches] = useState<PunchItem[] | null>(null);
  const [punchErr, setPunchErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dailyRes, punchRes] = await Promise.all([
        fetch("/api/admin/attendance/daily", { cache: "no-store" }),
        fetch("/api/admin/attendance/last-punches", { cache: "no-store" }),
      ]);
      const dailyJson = (await dailyRes.json()) as { ok?: boolean; error?: string; items?: DailyItem[] };
      const punchJson = (await punchRes.json()) as { ok?: boolean; error?: string; items?: PunchItem[] };

      if (!dailyRes.ok || !dailyJson.ok) {
        setDailyErr(dailyJson.error ?? "Could not load today's attendance.");
        setDaily((prev) => (prev != null && prev.length > 0 ? prev : []));
      } else {
        setDailyErr(null);
        const next = dailyJson.items ?? [];
        setDaily(next);
        writeAdminAttendanceSessionCache(adminAttendanceOverviewDailyKey, next);
      }

      if (!punchRes.ok || !punchJson.ok) {
        setPunchErr(punchJson.error ?? "Could not load latest punches.");
        setPunches((prev) => (prev != null && prev.length > 0 ? prev : []));
      } else {
        setPunchErr(null);
        const nextP = punchJson.items ?? [];
        setPunches(nextP);
        writeAdminAttendanceSessionCache(adminAttendanceOverviewPunchesKey, nextP);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error.";
      setDailyErr(msg);
      setPunchErr(msg);
      setDaily((prev) => (prev != null && prev.length > 0 ? prev : []));
      setPunches((prev) => (prev != null && prev.length > 0 ? prev : []));
    }
  }, []);

  useEffect(() => {
    const cachedDaily = readAdminAttendanceSessionCache<DailyItem[]>(
      adminAttendanceOverviewDailyKey,
      ADMIN_ATTENDANCE_SESSION_TTL_MS,
    );
    const cachedPunches = readAdminAttendanceSessionCache<PunchItem[]>(
      adminAttendanceOverviewPunchesKey,
      ADMIN_ATTENDANCE_SESSION_TTL_MS,
    );
    if (cachedDaily != null) setDaily(cachedDaily);
    if (cachedPunches != null) setPunches(cachedPunches);

    startTransition(() => {
      void load();
    });
    const id = window.setInterval(() => {
      startTransition(() => {
        void load();
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const present = (daily ?? []).filter((r) => !isDashTime(r.in_time));
  const stillIn = present.filter((r) => isDashTime(r.out_time));
  const lastPunch = punches && punches.length > 0 ? punches[0] : null;

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Attendance today</p>
          <p className="mt-1 text-sm text-ink-600">Biometric sync. Refreshes every minute.</p>
        </div>
        <Link href="/dashboard/attendance" className="text-xs font-medium text-azure-600 hover:text-azure-700">
          Full view →
        </Link>
      </div>

      {(dailyErr || punchErr) && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {[dailyErr, punchErr].filter(Boolean).join(" ")}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Present</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{daily === null ? "…" : present.length}</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Still in</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{daily === null ? "…" : stillIn.length}</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3 sm:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">Latest punch</p>
          {lastPunch ? (
            <>
              <p className="mt-1 truncate text-sm font-medium text-ink-900">{lastPunch.full_name ?? "Unknown"}</p>
              <p className="mt-0.5 font-mono text-[10px] text-ink-500">
                #{lastPunch.device_user_id ?? lastPunch.empcode} · {lastPunch.punch_date}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-500">{punches === null ? "…" : "No punches yet."}</p>
          )}
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {(daily ?? []).slice(0, 3).map((r, i) => (
          <li
            key={`${r.empcode}-${i}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink-900">{r.full_name ?? "Unknown member"}</p>
              <p className="truncate font-mono text-[10px] text-ink-500">
                #{r.device_user_id ?? r.empcode}
                {r.seat_label && r.seat_label !== "—" ? ` · ${r.seat_label}` : ""}
              </p>
              {r.coverage_warning ? <p className="mt-0.5 text-[10px] text-amber-800">{r.coverage_warning}</p> : null}
            </div>
            <div className="flex flex-shrink-0 gap-2 font-mono text-[11px] text-ink-600">
              <span>{isDashTime(r.in_time) ? "—" : r.in_time}</span>
              <span className="text-ink-300">/</span>
              <span>{isDashTime(r.out_time) ? "—" : r.out_time}</span>
            </div>
          </li>
        ))}
        {daily !== null && daily.length === 0 ? (
          <li className="rounded-lg border border-dashed border-ink-200 p-3 text-center text-xs text-ink-500">
            No punches yet today.
          </li>
        ) : null}
      </ul>
    </section>
  );
}
