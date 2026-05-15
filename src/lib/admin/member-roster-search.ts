import { displayPersonName } from "@/lib/format-person-name";

export type RosterMember = {
  userId: string;
  name: string;
  libraryNumber: string;
  email: string;
  planKind: string;
  seatNo: string;
  windowLabel: string;
  expiryYmd: string;
  status: string;
  windowState?: string;
  verificationStatus: string;
};

type MembershipRow = {
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  valid_from: string | null;
  valid_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
  window_state?: string;
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
  email: string | null;
  verification_status?: string;
};

function memberRank(row: RosterMember): number {
  let s = 0;
  if (row.planKind) s += 100;
  if (row.status === "active" && row.windowState !== "ended_past") s += 50;
  return s;
}

function expiryYmdFromRow(r: MembershipRow): string {
  if (r.plan_kind === "long_term" && r.valid_until) return r.valid_until.slice(0, 10);
  if (r.plan_kind === "short_term" && r.ends_at) return r.ends_at.slice(0, 10);
  if (r.valid_until) return r.valid_until.slice(0, 10);
  if (r.ends_at) return r.ends_at.slice(0, 10);
  return "";
}

function windowLabelFromRow(r: MembershipRow): string {
  if (r.plan_kind === "long_term") {
    const a = r.valid_from?.slice(0, 10) ?? "";
    const b = r.valid_until?.slice(0, 10) ?? "";
    return a && b ? `${a} → ${b}` : "—";
  }
  if (r.starts_at && r.ends_at) return `${r.starts_at.slice(0, 16)} → ${r.ends_at.slice(0, 16)}`;
  return "—";
}

export function buildRosterMembers(
  rows: MembershipRow[],
  profiles: Record<string, ProfileMini>,
): RosterMember[] {
  const byUser = new Map<string, RosterMember>();

  for (const row of rows) {
    const pr = profiles[row.user_id];
    if (!pr) continue;
    const expiry = expiryYmdFromRow(row);
    const candidate: RosterMember = {
      userId: row.user_id,
      name: displayPersonName(pr.full_name, "Member"),
      libraryNumber: String(pr.device_user_id),
      email: pr.email ?? "",
      planKind: row.plan_kind,
      seatNo: row.seat_number != null ? String(row.seat_number) : "—",
      windowLabel: windowLabelFromRow(row),
      expiryYmd: expiry,
      status: row.status,
      windowState: row.window_state,
      verificationStatus: pr.verification_status ?? "none",
    };
    const existing = byUser.get(row.user_id);
    if (!existing) {
      byUser.set(row.user_id, candidate);
      continue;
    }
    const rankM = memberRank(candidate);
    const rankE = memberRank(existing);
    if (rankM > rankE) byUser.set(row.user_id, candidate);
    else if (rankM === rankE && expiry.localeCompare(existing.expiryYmd) > 0) {
      byUser.set(row.user_id, candidate);
    }
  }

  return Array.from(byUser.values());
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function digitsOnly(q: string): string {
  return q.replace(/\D/g, "");
}

export function searchRosterMembers(members: RosterMember[], query: string, limit = 25): RosterMember[] {
  const t = normalizeQuery(query);
  if (!t) return [];
  const tDigits = digitsOnly(t);
  return members
    .filter((m) => {
      const lib = m.libraryNumber.padStart(4, "0");
      const libPlain = m.libraryNumber.replace(/^0+/, "") || "0";
      if (tDigits && (lib.includes(tDigits) || libPlain.includes(tDigits))) return true;
      if (m.name.toLowerCase().includes(t)) return true;
      if (m.email.toLowerCase().includes(t)) return true;
      if (m.userId.toLowerCase().includes(t)) return true;
      return false;
    })
    .slice(0, limit);
}
