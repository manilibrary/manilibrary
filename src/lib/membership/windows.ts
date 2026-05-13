/**
 * Membership window math for checkout (library calendar in Asia/Kolkata by default).
 * Long-term uses inclusive date ranges (valid_from … valid_until).
 * Short-term uses wall-clock instants (starts_at … ends_at).
 */

export const DEFAULT_LIBRARY_TZ = process.env.LIBRARY_TIMEZONE?.trim() || "Asia/Kolkata";

/** YYYY-MM-DD in the given IANA time zone (calendar day, not UTC midnight). */
export function todayYmdInTz(timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return new Date().toISOString().slice(0, 10);
  return `${y}-${m}-${d}`;
}

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Start of the library calendar day for `ymd` (timestamptz).
 * India uses fixed +05:30 (no DST). Other zones fall back to UTC midnight — set LIBRARY_TIMEZONE=Asia/Kolkata for Madhubani.
 */
export function membershipDayStartIso(ymd: string, timeZone: string): string {
  if (!isYmd(ymd)) throw new Error("Invalid date (expected YYYY-MM-DD).");
  if (timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta") {
    return `${ymd}T00:00:00+05:30`;
  }
  return `${ymd}T00:00:00Z`;
}

/** Inclusive calendar end date: N whole months after start month, minus one day. */
export function longTermInclusiveUntil(validFromYmd: string, months: number): string {
  if (!isYmd(validFromYmd)) throw new Error("Invalid valid_from.");
  const [y, mo, d] = validFromYmd.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) throw new Error("Invalid valid_from.");
  const endExclusive = new Date(Date.UTC(y, mo - 1 + months, d));
  const inclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
  return inclusive.toISOString().slice(0, 10);
}

export function addWallClockHours(isoStart: string, hours: number): string {
  const t = Date.parse(isoStart);
  if (!Number.isFinite(t)) throw new Error("Invalid start instant.");
  return new Date(t + hours * 60 * 60 * 1000).toISOString();
}

/** true if `candidateYmd` is on or after `floorYmd` (same string compare works for ISO dates). */
export function isOnOrAfterYmd(candidateYmd: string, floorYmd: string): boolean {
  return candidateYmd >= floorYmd;
}

/** Add whole calendar days to a YYYY-MM-DD string (UTC date math). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Normalize Postgres `date` or timestamptz string to YYYY-MM-DD for comparisons. */
export function toYmdBoundary(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return null;
}

export type MembershipSeatPickRow = {
  plan_kind: string;
  seat_number: number | null;
  /** Persisted at purchase; optional on legacy rows. */
  seat_label?: string | null;
  valid_from: string | null;
  valid_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at?: string | null;
  id?: string | null;
};

/**
 * True if this membership overlaps the library calendar day `attendanceYmd` (YYYY-MM-DD).
 * Long-term: inclusive valid_from … valid_until (calendar).
 * Short-term: wall-clock interval overlaps that library-local civil day.
 */
export function membershipCoversLibraryDay(
  m: MembershipSeatPickRow,
  attendanceYmd: string,
  timeZone: string,
): boolean {
  if (m.plan_kind === "long_term") {
    const vf = toYmdBoundary(m.valid_from);
    const vu = toYmdBoundary(m.valid_until);
    if (!vf || !vu) return false;
    return vf <= attendanceYmd && vu >= attendanceYmd;
  }
  if (m.plan_kind === "short_term") {
    if (!m.starts_at || !m.ends_at) return false;
    const dayStartIso = membershipDayStartIso(attendanceYmd, timeZone);
    const nextYmd = addDaysYmd(attendanceYmd, 1);
    const nextDayStartIso = membershipDayStartIso(nextYmd, timeZone);
    const dayStartMs = Date.parse(dayStartIso);
    const nextStartMs = Date.parse(nextDayStartIso);
    if (!Number.isFinite(dayStartMs) || !Number.isFinite(nextStartMs)) return false;
    const dayEndMs = nextStartMs - 1;
    const sm = Date.parse(m.starts_at);
    const em = Date.parse(m.ends_at);
    if (!Number.isFinite(sm) || !Number.isFinite(em)) return false;
    return sm <= dayEndMs && em >= dayStartMs;
  }
  return false;
}

export type SeatPickDevReason = "no_membership_covers_day" | "membership_without_seat";

/**
 * Among active memberships overlapping the attendance day, pick a seat deterministically:
 * prefer rows with a seat number, then newest created_at (then id).
 */
export function pickSeatForLibraryDay(
  memberships: MembershipSeatPickRow[],
  attendanceYmd: string,
  timeZone: string,
): {
  seat: number | null;
  plan_kind: string | null;
  persisted_seat_label: string | null;
  devReason?: SeatPickDevReason;
} {
  const covering = memberships.filter((row) => membershipCoversLibraryDay(row, attendanceYmd, timeZone));
  if (covering.length === 0) {
    return { seat: null, plan_kind: null, persisted_seat_label: null, devReason: "no_membership_covers_day" };
  }
  const withSeat = covering.filter(
    (c) => c.seat_number != null && Number.isFinite(Number(c.seat_number)),
  );
  const pool = withSeat.length > 0 ? withSeat : covering;
  const sorted = [...pool].sort((a, b) => {
    const ca = a.created_at ? Date.parse(a.created_at) : 0;
    const cb = b.created_at ? Date.parse(b.created_at) : 0;
    if (cb !== ca) return cb - ca;
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });
  const chosen = sorted[0];
  const pk = chosen.plan_kind?.trim() ? chosen.plan_kind : null;
  const sn = chosen.seat_number;
  const rawLabel = chosen.seat_label;
  const persisted =
    typeof rawLabel === "string" && rawLabel.trim().length > 0 ? rawLabel.trim() : null;
  if (sn == null || !Number.isFinite(Number(sn))) {
    return { seat: null, plan_kind: pk, persisted_seat_label: persisted, devReason: "membership_without_seat" };
  }
  return { seat: Math.round(Number(sn)), plan_kind: pk, persisted_seat_label: persisted };
}
