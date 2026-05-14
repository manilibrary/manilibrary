"use client";

import { useCallback, useMemo, useState } from "react";

import { dayBoundsForPunchMcid, formatDateDMY } from "@/lib/etime/dates";

function todayDMY(): string {
  return formatDateDMY(new Date());
}

export default function EtimeAttendanceStaffPanel({ isAdmin }: { isAdmin: boolean }) {
  const [inOutFrom, setInOutFrom] = useState(todayDMY);
  const [inOutTo, setInOutTo] = useState(todayDMY);
  const bounds = useMemo(() => dayBoundsForPunchMcid(new Date()), []);
  const [mcFrom, setMcFrom] = useState(bounds.from);
  const [mcTo, setMcTo] = useState(bounds.to);
  const [lastRecord, setLastRecord] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async (label: string, url: string) => {
    setBusy(label);
    setErr(null);
    setOut(null);
    try {
      const res = await fetch(url, { credentials: "include" });
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        throw new Error(text.slice(0, 240) || `HTTP ${res.status}`);
      }
      if (!res.ok) {
        const e = body as { error?: string };
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      setOut(JSON.stringify(body, null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }, []);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Member view</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          When attendance is saved from the library gate, your summary will show here. Managers use the full
          Attendance page for detailed lists and tools.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-azure-600">Staff · Gate link test</p>
        <h2 className="mt-1 text-lg font-semibold text-ink-900">Check biometric connection</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          These buttons talk to the gate system from the library server (not from your browser). Use them only when
          you are checking that the gate supplier connection is working.
        </p>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-900">Daily in / out (pick dates)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            From (DD/MM/YYYY)
            <input
              className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
              value={inOutFrom}
              onChange={(e) => setInOutFrom(e.target.value)}
              placeholder="DD/MM/YYYY"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-600">
            To (DD/MM/YYYY)
            <input
              className="rounded-lg border border-ink-200 px-3 py-2 text-sm"
              value={inOutTo}
              onChange={(e) => setInOutTo(e.target.value)}
              placeholder="DD/MM/YYYY"
            />
          </label>
          <button
            type="button"
            disabled={busy != null}
            onClick={() =>
              void run(
                "in-out",
                `/api/integrations/etime/in-out?fromDate=${encodeURIComponent(inOutFrom)}&toDate=${encodeURIComponent(inOutTo)}`,
              )
            }
            className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
          >
            {busy === "in-out" ? "Loading…" : "Fetch in/out"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-900">Punch list (pick dates)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-ink-600">
            From (DD/MM/YYYY)
            <input
              className="rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
              value={mcFrom}
              onChange={(e) => setMcFrom(e.target.value)}
            />
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-ink-600">
            To (DD/MM/YYYY)
            <input
              className="rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
              value={mcTo}
              onChange={(e) => setMcTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy != null}
            onClick={() =>
              void run(
                "mcid",
                `/api/integrations/etime/punch-mcid?fromDate=${encodeURIComponent(mcFrom)}&toDate=${encodeURIComponent(mcTo)}`,
              )
            }
            className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
          >
            {busy === "mcid" ? "Loading…" : "Fetch raw punches"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-900">Latest punches (optional bookmark)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-ink-600">
            Bookmark from last run (optional)
            <input
              className="rounded-lg border border-ink-200 px-3 py-2 font-mono text-sm"
              value={lastRecord}
              onChange={(e) => setLastRecord(e.target.value)}
              placeholder="Paste value from last response if continuing"
            />
          </label>
          <button
            type="button"
            disabled={busy != null}
            onClick={() => {
              const q = lastRecord.trim()
                ? `?lastRecord=${encodeURIComponent(lastRecord.trim())}`
                : "";
              void run("last", `/api/integrations/etime/last-punch${q}`);
            }}
            className="rounded-full bg-azure-500 px-4 py-2 text-sm font-semibold text-white hover:bg-azure-600 disabled:opacity-50"
          >
            {busy === "last" ? "Loading…" : "Fetch last punches"}
          </button>
        </div>
      </section>

      {out ? (
        <pre className="max-h-[420px] overflow-auto rounded-lg border border-ink-100 bg-surface-muted p-4 text-xs leading-relaxed text-ink-800">
          {out}
        </pre>
      ) : null}
    </div>
  );
}
