import { apiError, apiSuccess } from "@/lib/api/json-response";
import { addDaysYmd, DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import { ymdToDmy } from "@/lib/etime/attendance-anchor";
import { replaceAttendanceHistoryForDay } from "@/lib/etime/attendance-history-store";
import { loadAdminDailyAttendance } from "@/lib/etime/admin-daily-attendance";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/**
 * Intended for Vercel Cron / external scheduler after library midnight.
 * Archives **yesterday** (library calendar in DEFAULT_LIBRARY_TZ) into attendance_day_snapshots.
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
    const msg = e instanceof Error ? e.message : "Could not create admin client.";
    return apiError(msg, 503);
  }

  const loaded = await loadAdminDailyAttendance(admin, { fromDate: dmy, toDate: dmy, empcode: undefined });
  if (!loaded.ok) {
    return apiError("eTime unavailable; archive skipped.", 502);
  }

  const { error } = await admin.from("attendance_day_snapshots").upsert(
    {
      library_day_ymd: dayYmd,
      device_from_dmy: loaded.fromDate,
      device_to_dmy: loaded.toDate,
      source: loaded.source,
      items: loaded.items as unknown as Record<string, unknown>[],
      skipped_unregistered: loaded.skipped,
      archived_at: new Date().toISOString(),
    },
    { onConflict: "library_day_ymd" },
  );

  if (error) {
    if (error.code === "42P01") {
      return apiError("Run supabase/attendance-day-archive.sql first.", 503);
    }
    return apiError(error.message, 500);
  }

  const hist = await replaceAttendanceHistoryForDay(admin, dayYmd, loaded.items);
  if (!hist.ok) {
    return apiError(hist.message, hist.code === "42P01" ? 503 : 500);
  }

  return apiSuccess(`Cron archived ${dayYmd}.`, { dayYmd, rows: loaded.items.length });
}
