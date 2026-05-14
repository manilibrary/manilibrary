import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminDailyAttendanceItem, LoadAdminDailyAttendanceResult } from "@/lib/etime/admin-daily-attendance";

/** One flattened member row stored in `attendance_days.member_rows` (jsonb). */
export type AttendanceMemberRowJson = {
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
};

const str = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Parse `attendance_days.member_rows` jsonb into typed rows (skips invalid entries). */
export function parseAttendanceMemberRowsJson(json: unknown): AttendanceMemberRowJson[] {
  if (!Array.isArray(json)) return [];
  const out: AttendanceMemberRowJson[] = [];
  for (const x of json) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const deviceUserId = num(o.device_user_id);
    if (deviceUserId == null) continue;
    out.push({
      library_day_ymd: str(o.library_day_ymd),
      date_dmy: str(o.date_dmy),
      device_user_id: deviceUserId,
      empcode: str(o.empcode),
      full_name: o.full_name === null || typeof o.full_name === "string" ? (o.full_name as string | null) : null,
      seat_label: str(o.seat_label),
      in_time: str(o.in_time),
      out_time: str(o.out_time),
      work_time: str(o.work_time),
      status: str(o.status),
      status_ui: str(o.status_ui),
      status_ui_label: str(o.status_ui_label),
      remark: str(o.remark),
      source: str(o.source),
    });
  }
  return out;
}

function buildMemberRows(dayYmd: string, items: AdminDailyAttendanceItem[]): AttendanceMemberRowJson[] {
  const rows: AttendanceMemberRowJson[] = [];
  for (const it of items) {
    if (it.device_user_id == null || !Number.isFinite(it.device_user_id)) continue;
    rows.push({
      library_day_ymd: dayYmd,
      date_dmy: it.date,
      device_user_id: it.device_user_id,
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
  return rows;
}

type LoadedOk = Extract<LoadAdminDailyAttendanceResult, { ok: true }>;

/**
 * Upserts one `attendance_days` row: raw `items` plus flattened `member_rows` for history/export.
 */
export async function upsertAttendanceDayArchive(
  admin: SupabaseClient,
  dayYmd: string,
  loaded: LoadedOk,
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const memberRows = buildMemberRows(dayYmd, loaded.items);
  const archivedAt = new Date().toISOString();
  const { error } = await admin.from("attendance_days").upsert(
    {
      library_day_ymd: dayYmd,
      device_from_dmy: loaded.fromDate,
      device_to_dmy: loaded.toDate,
      source: loaded.source,
      items: loaded.items as unknown as Record<string, unknown>[],
      member_rows: memberRows as unknown as Record<string, unknown>[],
      skipped_unregistered: loaded.skipped,
      archived_at: archivedAt,
    },
    { onConflict: "library_day_ymd" },
  );

  if (error) {
    if (error.code === "42P01") {
      return {
        ok: false,
        code: "42P01",
        message:
          "Table attendance_days missing. Apply supabase/new-database-schema-rls-encryption.sql (or attendance section) in Supabase.",
      };
    }
    return { ok: false, message: error.message, code: error.code };
  }

  return { ok: true };
}
