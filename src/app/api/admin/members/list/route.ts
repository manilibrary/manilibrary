import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { displayPersonName } from "@/lib/format-person-name";
import {
  addDaysYmd,
  DEFAULT_LIBRARY_TZ,
  membershipCoversLibraryDay,
  membershipDayStartIso,
  todayYmdInTz,
  toYmdBoundary,
} from "@/lib/membership/windows";
import { extrasToDisplayFields } from "@/lib/profiles/profile-extras";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { deriveUiVerificationStatus, mapLatestVerificationWithDocsByUserId } from "@/lib/verification/verification-repo";

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
  created_at?: string;
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

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
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
    return apiErrorSafe(me, 500);
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
      .select("user_id, full_name, device_user_id, email, is_verified, profile_extras")
      .in("user_id", ids);
    if (pe) {
      return apiErrorSafe(pe, 500);
    }
    const verByUser = await mapLatestVerificationWithDocsByUserId(admin, ids);
    for (const raw of profs ?? []) {
      const p = raw as {
        user_id: string;
        full_name: string;
        device_user_id: number;
        email: string | null;
        is_verified: boolean | null;
        profile_extras: unknown;
      };
      const x = extrasToDisplayFields(p.profile_extras);
      const bundle = verByUser.get(p.user_id);
      profiles[p.user_id] = {
        user_id: p.user_id,
        full_name: displayPersonName(p.full_name, "Member"),
        device_user_id: p.device_user_id,
        email: p.email,
        verification_status: deriveUiVerificationStatus(p.is_verified === true, bundle?.row ?? null, bundle?.docs ?? []),
        aadhaar_last_four: x.aadhaar_last_four,
        student_roll_number: x.student_roll_number,
        institution_type: x.institution_type,
        preparing_for: x.preparing_for,
      };
    }
  }

  const { data: recentProfiles, error: rpe } = await admin
    .from("profiles")
    .select("user_id, full_name, device_user_id, email, is_verified, is_admin, is_superadmin, profile_extras, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(120);

  let account_only_profiles: ProfileMini[] = [];
  if (!rpe && recentProfiles && recentProfiles.length > 0) {
    const candIds = Array.from(new Set(recentProfiles.map((p) => (p as { user_id: string }).user_id)));
    const { data: memLinks, error: mle } = await admin.from("memberships").select("user_id").in("user_id", candIds);
    if (!mle) {
      const hasMembership = new Set((memLinks ?? []).map((r) => (r as { user_id: string }).user_id));
      const orphanRaw = recentProfiles
        .filter((p) => {
          const row = p as {
            user_id: string;
            is_admin?: boolean | null;
            is_superadmin?: boolean | null;
          };
          if (row.is_admin === true || row.is_superadmin === true) {
            return false;
          }
          return !hasMembership.has(row.user_id);
        })
        .slice(0, 40);
      const orphanIds = orphanRaw.map((p) => (p as { user_id: string }).user_id);
      const verOrphans = await mapLatestVerificationWithDocsByUserId(admin, orphanIds);
      account_only_profiles = orphanRaw.map((raw) => {
        const p = raw as {
          user_id: string;
          full_name: string;
          device_user_id: number;
          email: string | null;
          is_verified: boolean | null;
          profile_extras: unknown;
          created_at: string;
        };
        const x = extrasToDisplayFields(p.profile_extras);
        const bundle = verOrphans.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: displayPersonName(p.full_name, "Member"),
          device_user_id: p.device_user_id,
          email: p.email,
          verification_status: deriveUiVerificationStatus(p.is_verified === true, bundle?.row ?? null, bundle?.docs ?? []),
          aadhaar_last_four: x.aadhaar_last_four,
          student_roll_number: x.student_roll_number,
          institution_type: x.institution_type,
          preparing_for: x.preparing_for,
          created_at: p.created_at,
        };
      });
    }
  }

  return apiSuccess(`Loaded ${rows.length} recent membership row(s) with linked profiles.`, {
    rows,
    profiles,
    library_today: libraryToday,
    account_only_profiles,
  });
}
