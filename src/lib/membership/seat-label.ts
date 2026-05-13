/** Stored on `memberships.seat_number` while `status = pending_payment` (checkout not completed). */
export const PENDING_MEMBERSHIP_SEAT_PLACEHOLDER = "Not applicable";

/** `payments.metadata` key holding the F(n)/S(n) token until checkout completes. */
export const PAYMENT_METADATA_PLANNED_SEAT_KEY = "planned_seat_token";

export function isPendingMembershipSeatPlaceholder(stored: string | number | null | undefined): boolean {
  if (stored == null) return false;
  return String(stored).trim().toLowerCase() === PENDING_MEMBERSHIP_SEAT_PLACEHOLDER.toLowerCase();
}

/** F = long-term (full-day style). S = short-term (limited hours). */
export function formatMemberSeatLabel(planKind: string, seatNumber: number | null): string {
  if (seatNumber == null) return "—";
  if (planKind === "long_term") return `F(${seatNumber})`;
  if (planKind === "short_term") return `S(${seatNumber})`;
  return String(seatNumber);
}

/** Canonical token stored in `memberships.seat_number` (e.g. F(12), S(12)). */
export function formatMemberSeatToken(planKind: string, seatNumeric: number): string {
  if (planKind === "long_term") return `F(${seatNumeric})`;
  if (planKind === "short_term") return `S(${seatNumeric})`;
  return String(seatNumeric);
}

/**
 * Parse numeric seat from stored `seat_number` text (F(12), S(12)) or legacy plain integer / digits.
 */
export function parseNumericSeatFromStoredSeat(stored: string | number | null | undefined): number | null {
  if (stored == null) return null;
  if (isPendingMembershipSeatPlaceholder(stored)) return null;
  if (typeof stored === "number" && Number.isFinite(stored)) return Math.round(stored);
  const t = String(stored).trim();
  if (!t) return null;
  const m = t.match(/^[FS]\s*\(\s*(\d+)\s*\)\s*$/i);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

/** Row fields for displaying a membership seat (single `seat_number` column: text token or legacy number from cache). */
export type MembershipSeatLabelSource = {
  plan_kind: string;
  seat_number: string | number | null;
};

/**
 * Display label: prefers stored F(n)/S(n) text; otherwise derives from plan_kind + numeric seat.
 */
export function resolveMemberSeatDisplayLabel(row: MembershipSeatLabelSource): string {
  const raw = row.seat_number;
  if (raw === null || raw === undefined) return "—";
  if (isPendingMembershipSeatPlaceholder(raw)) return PENDING_MEMBERSHIP_SEAT_PLACEHOLDER;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "—";
    return formatMemberSeatLabel(row.plan_kind, raw);
  }
  const t = String(raw).trim();
  if (!t) return "—";
  if (/^[FS]\s*\(/i.test(t)) return t.replace(/\s/g, "");
  const parsed = parseNumericSeatFromStoredSeat(t);
  if (parsed != null) return formatMemberSeatLabel(row.plan_kind, parsed);
  return t;
}

export type MembershipSeatWithStatus = MembershipSeatLabelSource & {
  status?: string | null;
};

/** Admin hint when a real seat token was kept on the row (legacy); new checkouts use `payments.metadata.planned_seat_token`. */
export function pendingMembershipSeatIntentLabel(row: MembershipSeatWithStatus): string | null {
  if (row.status !== "pending_payment") return null;
  if (isPendingMembershipSeatPlaceholder(row.seat_number)) return null;
  const ch = resolveMemberSeatDisplayLabel(row);
  if (!ch || ch === "—") return null;
  return `Chosen if paid: ${ch}`;
}
