import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { displayPersonName } from "@/lib/format-person-name";
import { parseAttendanceMemberRowsJson } from "@/lib/etime/attendance-history-store";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const ROW_CAP = 2000;

function ymdFromDb(d: unknown): string {
  if (typeof d === "string") return d.slice(0, 10);
  return String(d ?? "").slice(0, 10);
}

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
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
    return apiErrorSafe(e, 503, "Could not create admin client.");
  }

  const { data, error } = await admin
    .from("attendance_days")
    .select("library_day_ymd, member_rows, archived_at")
    .is("deleted_at", null)
    .gte("library_day_ymd", lo)
    .lte("library_day_ymd", hi)
    .order("library_day_ymd", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return apiSuccess("No attendance_days table yet.", { rows: [] });
    }
    return apiErrorSafe(error, 500);
  }

  type Out = {
    library_day_ymd: string;
    date_dmy: string;
    device_user_id: number;
    empcode: string;
    full_name: string | null;
    seat_label: string;
    in_time: string;
    out_time: string;
    work_time: string;
    status: string;
    status_ui: string;
    status_ui_label: string;
    remark: string;
    source: string;
    archived_at: string;
  };

  const rows: Out[] = [];
  outer: for (const day of data ?? []) {
    const dayYmd = ymdFromDb((day as { library_day_ymd?: unknown }).library_day_ymd);
    const archivedAt = String((day as { archived_at?: string }).archived_at ?? "");
    const parsed = parseAttendanceMemberRowsJson((day as { member_rows?: unknown }).member_rows).slice();
    parsed.sort((a, b) => a.device_user_id - b.device_user_id);
    for (const r of parsed) {
      rows.push({
        library_day_ymd: r.library_day_ymd || dayYmd,
        date_dmy: r.date_dmy,
        device_user_id: r.device_user_id,
        empcode: r.empcode,
        full_name: r.full_name ? displayPersonName(r.full_name, "—") : null,
        seat_label: r.seat_label,
        in_time: r.in_time,
        out_time: r.out_time,
        work_time: r.work_time,
        status: r.status,
        status_ui: r.status_ui,
        status_ui_label: r.status_ui_label,
        remark: r.remark,
        source: r.source,
        archived_at: archivedAt,
      });
      if (rows.length >= ROW_CAP) break outer;
    }
  }

  return apiSuccess(`Loaded ${rows.length} history row(s).`, { fromYmd: lo, toYmd: hi, rows });
}
