import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { addDaysYmd, DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import { ymdToDmy } from "@/lib/etime/attendance-anchor";
import { upsertAttendanceDayArchive } from "@/lib/etime/attendance-history-store";
import { loadAdminDailyAttendance } from "@/lib/etime/admin-daily-attendance";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Intended for Vercel Cron / external scheduler after library midnight.
 * Archives **yesterday** (library calendar in DEFAULT_LIBRARY_TZ) into `attendance_days`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return apiError("CRON_SECRET is not configured.", 503);
  }
  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return apiError("Unauthorized.", 401);
  }

  const today = todayYmdInTz(DEFAULT_LIBRARY_TZ);
  const dayYmd = addDaysYmd(today, -1);
  const dmy = ymdToDmy(dayYmd);
  if (!dmy) {
    return apiError("Could not derive DMY for archive day.", 500);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create admin client.");
  }

  const loaded = await loadAdminDailyAttendance(admin, { fromDate: dmy, toDate: dmy, empcode: undefined });
  if (!loaded.ok) {
    return apiError("eTime unavailable; archive skipped.", 502);
  }

  const up = await upsertAttendanceDayArchive(admin, dayYmd, loaded);
  if (!up.ok) {
    const status = up.code === "42P01" ? 503 : 500;
    return apiErrorSafe(
      up.message,
      status,
      status === 503
        ? "Attendance archive is not set up yet."
        : "Could not save the attendance snapshot.",
    );
  }

  return apiSuccess(`Cron archived ${dayYmd}.`, { dayYmd, rows: loaded.items.length });
}
