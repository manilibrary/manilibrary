import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { ymdToDmy } from "@/lib/etime/attendance-anchor";
import { upsertAttendanceDayArchive } from "@/lib/etime/attendance-history-store";
import { loadAdminDailyAttendance } from "@/lib/etime/admin-daily-attendance";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const gate = await requireLibraryAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Expected JSON body with { dayYmd: \"YYYY-MM-DD\" }.", 400);
  }

  const dayYmd = typeof (body as { dayYmd?: unknown }).dayYmd === "string" ? (body as { dayYmd: string }).dayYmd.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYmd)) {
    return apiError("dayYmd must be YYYY-MM-DD.", 400);
  }

  const dmy = ymdToDmy(dayYmd);
  if (!dmy) {
    return apiError("Invalid dayYmd.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create admin client.");
  }

  const loaded = await loadAdminDailyAttendance(admin, { fromDate: dmy, toDate: dmy, empcode: undefined });
  if (!loaded.ok) {
    return apiError("eTime did not return data for that day; snapshot not saved.", 502);
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

  return apiSuccess(`Archived attendance day ${dayYmd} (items + member_rows).`, {
    dayYmd,
    rows: loaded.items.length,
  });
}

export async function GET() {
  const gate = await requireLibraryAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create admin client.");
  }

  const { data, error } = await admin
    .from("attendance_days")
    .select("library_day_ymd, source, skipped_unregistered, archived_at")
    .is("deleted_at", null)
    .order("library_day_ymd", { ascending: false })
    .limit(60);

  if (error) {
    if (error.code === "42P01") {
      return apiSuccess("No archive table yet.", { rows: [] });
    }
    return apiErrorSafe(error, 500);
  }

  return apiSuccess("Archive index loaded.", { rows: data ?? [] });
}
