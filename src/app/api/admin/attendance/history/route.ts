import { apiError, apiSuccess } from "@/lib/api/json-response";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const url = new URL(request.url);
  const fromYmd = url.searchParams.get("fromYmd")?.trim();
  const toYmd = url.searchParams.get("toYmd")?.trim();
  if (!fromYmd || !toYmd || !/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    return apiError("Query fromYmd and toYmd are required (YYYY-MM-DD).", 400);
  }
  const lo = fromYmd <= toYmd ? fromYmd : toYmd;
  const hi = fromYmd <= toYmd ? toYmd : fromYmd;

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create admin client.";
    return apiError(msg, 503);
  }

  const { data, error } = await admin
    .from("attendance_history_entries")
    .select(
      "library_day_ymd, date_dmy, device_user_id, empcode, full_name, seat_label, in_time, out_time, work_time, status, status_ui, status_ui_label, remark, source, archived_at",
    )
    .gte("library_day_ymd", lo)
    .lte("library_day_ymd", hi)
    .order("library_day_ymd", { ascending: false })
    .order("device_user_id", { ascending: true })
    .limit(2000);

  if (error) {
    if (error.code === "42P01") {
      return apiSuccess("No history table yet.", { rows: [] });
    }
    return apiError(error.message, 500);
  }

  return apiSuccess(`Loaded ${(data ?? []).length} history row(s).`, { fromYmd: lo, toYmd: hi, rows: data ?? [] });
}
