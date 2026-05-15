export type MembershipWindowState = "current" | "starts_future" | "ended_past" | "unknown" | "inactive";

/** Human-readable membership status for admin tables (DB status + library-day window). */
export function membershipDisplayStatusLabel(
  status: string,
  windowState?: MembershipWindowState | string,
): string {
  const s = status.toLowerCase();
  if (s === "active" && windowState === "starts_future") return "Upcoming";
  if (s === "active" && windowState === "ended_past") return "Expired";
  return status.replace(/_/g, " ");
}
