/** F = long-term (full-day style). S = short-term (limited hours). */
export function formatMemberSeatLabel(planKind: string, seatNumber: number | null): string {
  if (seatNumber == null) return "—";
  if (planKind === "long_term") return `F(${seatNumber})`;
  if (planKind === "short_term") return `S(${seatNumber})`;
  return String(seatNumber);
}

/** Row fields used when reading `seat_label` from DB or composing it from plan + number. */
export type MembershipSeatLabelSource = {
  plan_kind: string;
  seat_number: number | null;
  seat_label?: string | null;
};

/**
 * Prefer persisted `seat_label` (set at purchase/finalize); otherwise derive F(n)/S(n)
 * from `plan_kind` + `seat_number` (legacy rows).
 */
export function resolveMemberSeatDisplayLabel(row: MembershipSeatLabelSource): string {
  const persisted = row.seat_label?.trim();
  if (persisted) return persisted;
  return formatMemberSeatLabel(row.plan_kind, row.seat_number);
}
