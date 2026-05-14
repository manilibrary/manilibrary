"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useLayoutEffect, useState } from "react";

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

  useLayoutEffect(() => {
    const d = readAdminAttendanceSessionCache<DailyItem[]>(
      adminAttendanceOverviewDailyKey,
      ADMIN_ATTENDANCE_SESSION_TTL_MS,
    );
    if (d != null) {
      setDaily(d);
    }
    const p = readAdminAttendanceSessionCache<PunchItem[]>(
      adminAttendanceOverviewPunchesKey,
      ADMIN_ATTENDANCE_SESSION_TTL_MS,
    );
    if (p != null) {
      setPunches(p);
    }
    setDailyErr(null);
    setPunchErr(null);
  }, []);

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

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
              Attendance today
            </p>
            <p className="mt-0.5 text-sm text-ink-600">
              Punches synced from the biometric device.
            </p>
          </div>
          <Link
            href="/dashboard/attendance"
            className="text-xs font-medium text-azure-600 hover:text-azure-700"
          >
            Open page →
          </Link>
        </div>

        {dailyErr ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {dailyErr}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">
              Members present
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-800">
              {daily === null ? "…" : present.length}
            </p>
          </div>
          <div className="rounded-xl bg-azure-50 p-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure-700">
              Still on seat
            </p>
            <p className="mt-1 text-2xl font-semibold text-azure-800">
              {daily === null ? "…" : stillIn.length}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 text-sm">
          {(daily ?? []).slice(0, 5).map((r, i) => (
            <li
              key={`${r.empcode}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 bg-surface-muted/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">
                  {r.full_name ?? "Unknown member"}
                </p>
                <p className="truncate font-mono text-[10px] text-ink-500">
                  #{r.device_user_id ?? r.empcode}
                  {r.seat_label && r.seat_label !== "—" ? ` · seat ${r.seat_label}` : ""}
                </p>
                {r.coverage_warning ? (
                  <p className="mt-0.5 text-[10px] leading-snug text-amber-800">{r.coverage_warning}</p>
                ) : null}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2 text-[11px] font-mono">
                <span className="text-emerald-700">
                  in {isDashTime(r.in_time) ? "—" : r.in_time}
                </span>
                <span className="text-red-700">
                  out {isDashTime(r.out_time) ? "—" : r.out_time}
                </span>
              </div>
            </li>
          ))}
          {daily !== null && daily.length === 0 ? (
            <li className="rounded-lg border border-dashed border-ink-200 p-3 text-center text-xs text-ink-500">
              No punches yet today.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">
              Latest punches
            </p>
            <p className="mt-0.5 text-sm text-ink-600">
              Auto-refreshes every minute.
            </p>
          </div>
          <Link
            href="/dashboard/attendance"
            className="text-xs font-medium text-azure-600 hover:text-azure-700"
          >
            Full attendance →
          </Link>
        </div>

        {punchErr ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {punchErr}
          </p>
        ) : null}

        <ul className="mt-4 space-y-2 text-sm">
          {(punches ?? []).slice(0, 6).map((r, i) => (
            <li
              key={`${r.empcode}-${i}-${r.punch_date}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 bg-surface-muted/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">
                  {r.full_name ?? "Unknown member"}
                </p>
                <p className="truncate font-mono text-[10px] text-ink-500">
                  #{r.device_user_id ?? r.empcode}
                </p>
              </div>
              <span className="flex-shrink-0 font-mono text-xs text-ink-700">
                {r.punch_date}
              </span>
            </li>
          ))}
          {punches !== null && punches.length === 0 ? (
            <li className="rounded-lg border border-dashed border-ink-200 p-3 text-center text-xs text-ink-500">
              No recent punches.
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
