/**
 * Helpers to synthesize daily in/out summaries and recent-punch feeds from the
 * raw `DownloadPunchDataMCID` endpoint. eTimeOffice's `DownloadInOutPunchData`
 * (B1) and `DownloadLastPunchData` (B3) are not always enabled / can return
 * errors for some accounts; B2 (DownloadPunchDataMCID) is the most reliable
 * source on the package the library uses.
 */

import type { EtimePunchMcidRow } from "./types";

export type DailyDerivedRow = {
  empcode: string;
  name: string;
  date: string; // DD/MM/YYYY
  inTime: string; // HH:mm or ""
  outTime: string; // HH:mm or ""
  workTime: string; // HH:mm
  status: "P" | "A";
};

function parsePunch(p: EtimePunchMcidRow): { dateKey: string; minutes: number; date: string } | null {
  // PunchDate format: "DD/MM/YYYY HH:mm:ss"
  const m = p.PunchDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi] = m;
  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    minutes: parseInt(hh, 10) * 60 + parseInt(mi, 10),
    date: `${dd}/${mm}/${yyyy}`,
  };
}

function minutesToHm(min: number): string {
  if (!Number.isFinite(min) || min < 0) return "00:00";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Group raw punches by (empcode, date) and derive INTime (earliest punch) and
 * OUTTime (latest punch) for each day. Single-punch days return only INTime.
 */
export function deriveDailyFromPunches(
  rows: EtimePunchMcidRow[],
): DailyDerivedRow[] {
  const groups = new Map<
    string,
    { empcode: string; name: string; date: string; min: number; max: number; count: number }
  >();

  for (const r of rows) {
    const parsed = parsePunch(r);
    if (!parsed) continue;
    const key = `${r.Empcode}|${parsed.dateKey}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        empcode: r.Empcode,
        name: r.Name,
        date: parsed.date,
        min: parsed.minutes,
        max: parsed.minutes,
        count: 1,
      });
    } else {
      g.min = Math.min(g.min, parsed.minutes);
      g.max = Math.max(g.max, parsed.minutes);
      g.count += 1;
      if (!g.name && r.Name) g.name = r.Name;
    }
  }

  return Array.from(groups.values()).map((g) => {
    const inTime = minutesToHm(g.min);
    const outTime = g.count > 1 ? minutesToHm(g.max) : "";
    const workTime = g.count > 1 ? minutesToHm(g.max - g.min) : "00:00";
    return {
      empcode: g.empcode,
      name: g.name,
      date: g.date,
      inTime,
      outTime,
      workTime,
      status: "P",
    };
  });
}

/** Return punches sorted by date descending (latest first), as plain rows. */
export function sortPunchesDesc(rows: EtimePunchMcidRow[]): EtimePunchMcidRow[] {
  return [...rows].sort((a, b) => {
    const pa = parsePunch(a);
    const pb = parsePunch(b);
    if (!pa && !pb) return 0;
    if (!pa) return 1;
    if (!pb) return -1;
    if (pa.dateKey !== pb.dateKey) return pa.dateKey < pb.dateKey ? 1 : -1;
    return pb.minutes - pa.minutes;
  });
}
