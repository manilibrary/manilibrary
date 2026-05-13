/** Human-readable member line for admin tables (name + padded device user id). */
export function formatProfileMemberLabel(row: {
  full_name: string | null | undefined;
  device_user_id: number;
}): string {
  const name = String(row.full_name ?? "").trim() || "Member";
  return `${name} (#${String(row.device_user_id).padStart(4, "0")})`;
}
