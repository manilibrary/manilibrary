/** Strip fields that must not appear in browser JSON (staff UI still gets labels, not gateway ids). */

export type AdminRecentPaymentClient = {
  id: string;
  user_id: string;
  membership_id: string | null;
  amount_rupees: number;
  status: string;
  created_at: string;
  plan_kind: string | null;
  member_label: string;
  device_user_id: number | null;
};

export function toAdminRecentPaymentClient(row: {
  id: string;
  user_id: string;
  membership_id: string | null;
  amount_rupees: number;
  status: string;
  created_at: string;
  plan_kind: string | null;
  member_label: string;
  device_user_id: number | null;
}): AdminRecentPaymentClient {
  return {
    id: row.id,
    user_id: row.user_id,
    membership_id: row.membership_id,
    amount_rupees: row.amount_rupees,
    status: row.status,
    created_at: row.created_at,
    plan_kind: row.plan_kind,
    member_label: row.member_label,
    device_user_id: row.device_user_id,
  };
}

/** Mask email for roster lists (full email only on explicit member detail screens). */
export function maskEmailForList(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const e = email.trim();
  const at = e.indexOf("@");
  if (at < 1) return "•••";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const maskedLocal = local.length <= 2 ? "••" : `${local[0]}•••${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}
