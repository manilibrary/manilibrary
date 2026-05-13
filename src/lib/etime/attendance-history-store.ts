import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminDailyAttendanceItem } from "@/lib/etime/admin-daily-attendance";

type HistoryRow = {
  library_day_ymd: string;
  date_dmy: string;
  member_number: number;
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
};

/**
 * Replaces all stored history rows for `dayYmd` with the given processed daily items.
 */
export async function replaceAttendanceHistoryForDay(
  admin: SupabaseClient,
  dayYmd: string,
  items: AdminDailyAttendanceItem[],
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const { error: delErr } = await admin.from("attendance_history_entries").delete().eq("library_day_ymd", dayYmd);
  if (delErr) {
    if (delErr.code === "42P01") {
      return {
        ok: false,
        code: "42P01",
        message:
          "Table attendance_history_entries missing. Re-run supabase/attendance-day-archive.sql (includes history DDL).",
      };
    }
    return { ok: false, message: delErr.message, code: delErr.code };
  }

  const rows: HistoryRow[] = [];
  for (const it of items) {
    if (it.member_number == null || !Number.isFinite(it.member_number)) continue;
    rows.push({
      library_day_ymd: dayYmd,
      date_dmy: it.date,
      member_number: it.member_number,
      empcode: it.empcode,
      full_name: it.full_name,
      seat_label: it.seat_label,
      in_time: it.in_time,
      out_time: it.out_time,
      work_time: it.work_time,
      status: it.status,
      status_ui: it.status_ui,
      status_ui_label: it.status_ui_label,
      remark: it.remark,
      source: it.source,
    });
  }

  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await admin.from("attendance_history_entries").insert(slice);
    if (error) {
      return { ok: false, message: error.message, code: error.code };
    }
  }

  return { ok: true };
}
