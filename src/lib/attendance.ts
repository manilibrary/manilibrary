export type PunchRecord = {
  Empcode: string;
  Name: string;
  INTime: string;
  OUTTime: string;
  WorkTime: string;
  OverTime: string;
  BreakTime: string;
  Status: "P" | "A" | "HD" | "WO" | "H" | string;
  DateString: string;
  Remark: string;
  Erl_Out: string;
  Late_In: string;
};

export type AttendanceResponse = {
  InOutPunchData: PunchRecord[];
};

/** Human-readable status label */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    P: "Present",
    A: "Absent",
    HD: "Half Day",
    WO: "Week Off",
    H: "Holiday",
  };
  return map[status] ?? status;
}

/** Is "HH:MM" a real punch (not "--:--" or "00:00")? */
export function hasTime(t: string): boolean {
  return Boolean(t) && t !== "--:--" && t !== "00:00";
}

/** Parse "DD/MM/YYYY" → Date */
export function parseDMY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, m - 1, d);
}

/** Format "DD/MM/YYYY" → "03 May 2026" */
export function formatDMY(s: string): string {
  try {
    return parseDMY(s).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

/** Format a Date → "DD/MM/YYYY" as required by the API query params */
function toApiDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Build today's DateString in DD/MM/YYYY to match API response */
export function todayDMY(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Construct the external API URL for a given range */
export function buildApiUrl(fromDate: Date, toDate: Date): string {
  const base =
    "https://api.etimeoffice.com/api/DownloadInOutPunchData";
  return `${base}?Empcode=ALL&FromDate=${toApiDate(fromDate)}&ToDate=${toApiDate(toDate)}`;
}

/** Group records by Empcode, keeping the latest date per employee */
export function groupByEmployee(
  records: PunchRecord[]
): Map<string, PunchRecord[]> {
  const map = new Map<string, PunchRecord[]>();
  for (const r of records) {
    const list = map.get(r.Empcode) ?? [];
    list.push(r);
    map.set(r.Empcode, list);
  }
  return map;
}

/** Filter to today's records only */
export function todayRecords(records: PunchRecord[]): PunchRecord[] {
  const today = todayDMY();
  return records.filter((r) => r.DateString === today);
}

/** Sort: Present first, then Absent; by Name within groups */
export function sortRecords(records: PunchRecord[]): PunchRecord[] {
  return [...records].sort((a, b) => {
    if (a.Status === b.Status) return a.Name.localeCompare(b.Name);
    if (a.Status === "P") return -1;
    if (b.Status === "P") return 1;
    return a.Name.localeCompare(b.Name);
  });
}
