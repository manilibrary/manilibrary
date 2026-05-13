import { apiError, apiSuccess } from "@/lib/api/json-response";
import {
  addDaysYmd,
  DEFAULT_LIBRARY_TZ,
  membershipCoversLibraryDay,
  membershipDayStartIso,
  todayYmdInTz,
  toYmdBoundary,
} from "@/lib/membership/windows";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type MembershipWindowState = "current" | "starts_future" | "ended_past" | "unknown" | "inactive";

type MembershipRow = {
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
};

type MembershipListRow = MembershipRow & {
  window_state: MembershipWindowState;
  current_on_library_day: boolean;
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
  email: string | null;
  verification_status: string;
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
};

function compareShortTermWindowToDay(row: MembershipRow, todayYmd: string): MembershipWindowState {
  if (!row.starts_at || !row.ends_at) return "unknown";
  const dayStartMs = Date.parse(membershipDayStartIso(todayYmd, DEFAULT_LIBRARY_TZ));
  const nextDayStartMs = Date.parse(membershipDayStartIso(addDaysYmd(todayYmd, 1), DEFAULT_LIBRARY_TZ));
  const startsMs = Date.parse(row.starts_at);
  const endsMs = Date.parse(row.ends_at);
  if (
    !Number.isFinite(dayStartMs) ||
    !Number.isFinite(nextDayStartMs) ||
    !Number.isFinite(startsMs) ||
    !Number.isFinite(endsMs)
  ) {
    return "unknown";
  }
  const dayEndMs = nextDayStartMs - 1;
  if (startsMs > dayEndMs) return "starts_future";
  if (endsMs < dayStartMs) return "ended_past";
  return "current";
}

function membershipWindowState(row: MembershipRow, todayYmd: string): MembershipWindowState {
  if (row.status !== "active") return "inactive";
  if (membershipCoversLibraryDay(row, todayYmd, DEFAULT_LIBRARY_TZ)) return "current";

  if (row.plan_kind === "long_term") {
    const validFrom = toYmdBoundary(row.valid_from);
    const validUntil = toYmdBoundary(row.valid_until);
    if (!validFrom || !validUntil) return "unknown";
    if (validFrom > todayYmd) return "starts_future";
    if (validUntil < todayYmd) return "ended_past";
  }

  if (row.plan_kind === "short_term") {
    return compareShortTermWindowToDay(row, todayYmd);
  }

  return "unknown";
}

export async function GET() {
  const gate = await requireLibraryAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const admin = createSupabaseServiceRoleClient();

  const { data: mem, error: me } = await admin
    .from("memberships")
    .select(
      "id, user_id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  if (me) {
    return apiError(me.message, 500);
  }
  const libraryToday = todayYmdInTz(DEFAULT_LIBRARY_TZ);
  const rows = ((mem ?? []) as MembershipRow[]).map<MembershipListRow>((row) => {
    const windowState = membershipWindowState(row, libraryToday);
    return {
      ...row,
      window_state: windowState,
      current_on_library_day: windowState === "current",
    };
  });

  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const profiles: Record<string, ProfileMini> = {};
  if (ids.length > 0) {
    const { data: profs, error: pe } = await admin
      .from("profiles")
      .select(
        "user_id, full_name, device_user_id, email, verification_status, aadhaar_last_four, student_roll_number, institution_type, preparing_for",
      )
      .in("user_id", ids);
    if (pe) {
      return apiError(pe.message, 500);
    }
    for (const p of (profs ?? []) as ProfileMini[]) {
      profiles[p.user_id] = p;
    }
  }

  return apiSuccess(`Loaded ${rows.length} recent membership row(s) with linked profiles.`, {
    rows,
    profiles,
    library_today: libraryToday,
  });
}
