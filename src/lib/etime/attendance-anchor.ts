import { addDaysYmd, DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";

/** DD/MM/YYYY from YYYY-MM-DD (eTime B1 format). */
export function ymdToDmy(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/**
 * Library calendar day used for "today" on the member attendance screen.
 * Between midnight and 12:29 AM (library time), the previous calendar day is still treated as the active attendance day.
 */
export function attendanceAnchorYmd(now: Date = new Date(), timeZone: string = DEFAULT_LIBRARY_TZ): string {
  const today = todayYmdInTz(timeZone);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const mi = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  if (h === 0 && mi < 30) {
    return addDaysYmd(today, -1);
  }
  return today;
}

/** B2 punch window for one calendar day in DD/MM/YYYY (eTime). */
export function punchBoundsFromDmy(dmy: string): { from: string; to: string } {
  const trimmed = dmy.trim();
  return {
    from: `${trimmed}_00:01`,
    to: `${trimmed}_23:59`,
  };
}

export function parseDmyToSortKey(dmy: string): number {
  const m = dmy.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 0;
  const [, dd, mm, yyyy] = m;
  return Date.UTC(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
}

/** Calendar YYYY-MM-DD for an instant in a given IANA zone. */
export function ymdOnCalendarInTz(d: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

/** Parse DD/MM/YYYY → YYYY-MM-DD for comparisons. */
export function dmyToYmd(dmy: string): string | null {
  const m = dmy.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}
