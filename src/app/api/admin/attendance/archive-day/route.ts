import { apiError, apiSuccess } from "@/lib/api/json-response";
import { ymdToDmy } from "@/lib/etime/attendance-anchor";
import { replaceAttendanceHistoryForDay } from "@/lib/etime/attendance-history-store";
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
    const msg = e instanceof Error ? e.message : "Could not create admin client.";
    return apiError(msg, 503);
  }

  const loaded = await loadAdminDailyAttendance(admin, { fromDate: dmy, toDate: dmy, empcode: undefined });
  if (!loaded.ok) {
    return apiError("eTime did not return data for that day; snapshot not saved.", 502);
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
    if (error.message.includes("attendance_day_snapshots") || error.code === "42P01") {
      return apiError(
        "Table attendance_day_snapshots missing. Run supabase/attendance-day-archive.sql in the Supabase SQL editor.",
        503,
      );
    }
    return apiError(error.message, 500);
  }

  const hist = await replaceAttendanceHistoryForDay(admin, dayYmd, loaded.items);
  if (!hist.ok) {
    return apiError(hist.message, hist.code === "42P01" ? 503 : 500);
  }

  return apiSuccess(`Archived snapshot and history for ${dayYmd}.`, {
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
    const msg = e instanceof Error ? e.message : "Could not create admin client.";
    return apiError(msg, 503);
  }

  const { data, error } = await admin
    .from("attendance_day_snapshots")
    .select("library_day_ymd, source, skipped_unregistered, archived_at")
    .order("library_day_ymd", { ascending: false })
    .limit(60);

  if (error) {
    if (error.code === "42P01") {
      return apiSuccess("No archive table yet.", { rows: [] });
    }
    return apiError(error.message, 500);
  }

  return apiSuccess("Archive index loaded.", { rows: data ?? [] });
}
