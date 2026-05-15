import { displayPersonName } from "@/lib/format-person-name";

/** Human-readable member line for admin tables (name + padded device user id). */
export function formatProfileMemberLabel(row: {
  full_name: string | null | undefined;
  device_user_id: number;
}): string {
  const name = displayPersonName(row.full_name, "Member");
  return `${name} (#${String(row.device_user_id).padStart(4, "0")})`;
}
