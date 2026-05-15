/** Shared admin members browse payload (/api/admin/members/list). */

export type MembershipWindowState = "current" | "starts_future" | "ended_past" | "unknown" | "inactive";

export type AdminMembershipRow = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  window_state?: MembershipWindowState;
  current_on_library_day?: boolean;
};

export type AdminProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
  email: string | null;
  verification_status?: string;
  aadhaar_last_four?: string | null;
  student_roll_number?: string | null;
  institution_type?: string | null;
  preparing_for?: string | null;
  created_at?: string;
};

export type AdminMembersListCache = {
  rows: AdminMembershipRow[];
  profiles: Record<string, AdminProfileMini>;
  account_only_profiles: AdminProfileMini[];
};

export async function fetchAdminMembersList(): Promise<AdminMembersListCache> {
  const res = await fetch("/api/admin/members/list", { cache: "no-store" });
  const j = (await res.json()) as {
    ok?: boolean;
    error?: string;
    rows?: AdminMembershipRow[];
    profiles?: Record<string, AdminProfileMini>;
    account_only_profiles?: AdminProfileMini[];
  };
  if (!res.ok || !j.ok) {
    throw new Error(j.error ?? "Could not load members.");
  }
  return {
    rows: j.rows ?? [],
    profiles: j.profiles ?? {},
    account_only_profiles: j.account_only_profiles ?? [],
  };
}
