import {
  PENDING_MEMBERSHIP_SEAT_PLACEHOLDER,
  pendingMembershipSeatIntentLabel,
  resolveMemberSeatDisplayLabel,
} from "@/lib/membership/seat-label";

type Props = {
  plan_kind: string;
  seat_number: string | number | null;
  status: string | null | undefined;
};

/**
 * Staff / superadmin tables: `memberships.seat_number` for pending checkout is
 * stored as "Not applicable"; real F(n)/S(n) is applied when payment succeeds.
 */
export function MembershipSeatTableCell({ plan_kind, seat_number, status }: Props) {
  const primary = resolveMemberSeatDisplayLabel({ plan_kind, seat_number });
  const sub = pendingMembershipSeatIntentLabel({ plan_kind, seat_number, status });
  const isPending = status === "pending_payment";
  const title =
    isPending && primary === PENDING_MEMBERSHIP_SEAT_PLACEHOLDER
      ? "Seat is assigned only after payment succeeds (see payments.metadata.planned_seat_token)."
      : sub && primary === "—"
        ? "Does not reserve this seat for others until payment succeeds."
        : undefined;
  return (
    <div className="font-mono">
      <span title={title}>{primary}</span>
      {sub ? (
        <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-ink-500">{sub}</div>
      ) : null}
    </div>
  );
}
