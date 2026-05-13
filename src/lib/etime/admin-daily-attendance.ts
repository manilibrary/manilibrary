import { cachedFetch } from "@/lib/etime/cache";
import { dmyToYmd } from "@/lib/etime/attendance-anchor";
import { etimeFetchJson } from "@/lib/etime/fetch-server";
import type {
  EtimeInOutResponse,
  EtimeInOutRow,
  EtimePunchMcidResponse,
  EtimePunchMcidRow,
} from "@/lib/etime/types";
import { deriveDailyFromPunches } from "@/lib/etime/synth";
import {
  buildDownloadInOutPunchDataUrl,
  buildDownloadPunchDataMcidUrl,
} from "@/lib/etime/urls";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import {
  DEFAULT_LIBRARY_TZ,
  pickSeatForLibraryDay,
  type MembershipSeatPickRow,
} from "@/lib/membership/windows";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminDailyAttendanceItem = {
  date: string;
  empcode: string;
  member_number: number | null;
  full_name: string | null;
  seat_number: number | null;
  seat_label: string;
  coverage_warning?: string | null;
  seat_debug?: string;
  in_time: string;
  out_time: string;
  work_time: string;
  /** Raw status from eTime / synth row. */
  status: string;
  remark: string;
  source: "device-summary" | "derived-from-punches";
  /** UI-safe: never treat empty IN as Absent. */
  status_ui: "pending" | "present" | "absent" | "week_off" | "holiday" | "other";
  status_ui_label: string;
};

function parseEmpcodeToMemberNumber(emp: string | null | undefined): number | null {
  if (!emp) return null;
  const cleaned = emp.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

function expandRangeToMcid(fromDate: string, toDate: string): { from: string; to: string } {
  return { from: `${fromDate}_00:01`, to: `${toDate}_23:59` };
}

const SUMMARY_TTL_MS = 30_000;
const PUNCHES_TTL_MS = 30_000;

async function fetchSummary(opts: {
  empcode?: string;
  fromDate: string;
  toDate: string;
}): Promise<EtimeInOutRow[] | null> {
  const key = `summary:${opts.empcode ?? "ALL"}:${opts.fromDate}:${opts.toDate}`;
  return cachedFetch<EtimeInOutRow[] | null>(key, SUMMARY_TTL_MS, async () => {
    try {
      const url = buildDownloadInOutPunchDataUrl(opts);
      const json = await etimeFetchJson<EtimeInOutResponse>(url);
      if (json.Error) return null;
      return json.InOutPunchData ?? [];
    } catch {
      return null;
    }
  });
}

async function fetchPunches(opts: {
  empcode?: string;
  fromDate: string;
  toDate: string;
}): Promise<EtimePunchMcidRow[] | null> {
  const key = `punches:${opts.empcode ?? "ALL"}:${opts.fromDate}:${opts.toDate}`;
  return cachedFetch<EtimePunchMcidRow[] | null>(key, PUNCHES_TTL_MS, async () => {
    try {
      const { from, to } = expandRangeToMcid(opts.fromDate, opts.toDate);
      const url = buildDownloadPunchDataMcidUrl({ empcode: opts.empcode, fromDate: from, toDate: to });
      const json = await etimeFetchJson<EtimePunchMcidResponse>(url);
      if (json.Error) return null;
      return json.PunchData ?? [];
    } catch {
      return null;
    }
  });
}

function isDashTime(t: string | null | undefined): boolean {
  if (!t) return true;
  const trimmed = t.trim();
  return trimmed === "" || trimmed === "--:--";
}

/** True if the device row shows any in/out time (not an empty “not yet” row). */
function rowHasPunchEvidence(r: EtimeInOutRow): boolean {
  return !isDashTime(r.INTime) || !isDashTime(r.OUTTime);
}

function statusUiFromRow(inTime: string, outTime: string, deviceStatus: string): Pick<AdminDailyAttendanceItem, "status_ui" | "status_ui_label"> {
  if (isDashTime(inTime)) {
    return { status_ui: "pending", status_ui_label: "Not yet" };
  }
  const norm = deviceStatus?.toUpperCase().trim() ?? "";
  if (norm === "P") return { status_ui: "present", status_ui_label: "Present" };
  if (norm === "A") return { status_ui: "absent", status_ui_label: "Absent" };
  if (norm === "WO") return { status_ui: "week_off", status_ui_label: "Week off" };
  if (norm === "HLD") return { status_ui: "holiday", status_ui_label: "Holiday" };
  return { status_ui: "other", status_ui_label: deviceStatus?.trim() ? deviceStatus : "—" };
}

export type LoadAdminDailyAttendanceResult =
  | { ok: false; error: "etime_unavailable" }
  | {
      ok: true;
      fromDate: string;
      toDate: string;
      source: "device-summary" | "derived-from-punches";
      items: AdminDailyAttendanceItem[];
      skipped: number;
    };

export async function loadAdminDailyAttendance(
  admin: SupabaseClient,
  opts: { fromDate: string; toDate: string; empcode?: string },
): Promise<LoadAdminDailyAttendanceResult> {
  const { fromDate, toDate, empcode } = opts;
  const [summaryRows, punchRows] = await Promise.all([
    fetchSummary({ empcode, fromDate, toDate }),
    fetchPunches({ empcode, fromDate, toDate }),
  ]);

  let rows: EtimeInOutRow[];
  let source: "device-summary" | "derived-from-punches";

  if (summaryRows && summaryRows.length > 0) {
    source = "device-summary";
    rows = summaryRows;
  } else if (punchRows && punchRows.length > 0) {
    source = "derived-from-punches";
    rows = deriveDailyFromPunches(punchRows).map<EtimeInOutRow>((d) => ({
      Empcode: d.empcode,
      INTime: d.inTime,
      OUTTime: d.outTime,
      WorkTime: d.workTime,
      OverTime: "00:00",
      BreakTime: "00:00",
      Status: d.status,
      DateString: d.date,
      Remark: "synth",
      Erl_Out: "00:00",
      Late_In: "00:00",
      Name: d.name,
    }));
  } else if (summaryRows === null && punchRows === null) {
    return { ok: false, error: "etime_unavailable" };
  } else {
    source = "device-summary";
    rows = [];
  }

  const memberNumbers = Array.from(
    new Set(
      rows
        .map((r) => parseEmpcodeToMemberNumber(r.Empcode))
        .filter((n): n is number => n != null),
    ),
  );

  const profilesById: Record<number, { user_id: string; full_name: string; member_number: number }> = {};
  const userIdsByMember: Record<number, string> = {};
  if (memberNumbers.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("user_id, full_name, member_number")
      .in("member_number", memberNumbers);
    for (const p of profs ?? []) {
      profilesById[p.member_number] = p;
      userIdsByMember[p.member_number] = p.user_id;
    }
  }

  const userIds = Object.values(userIdsByMember);
  const memsByUser: Record<string, MembershipSeatPickRow[]> = {};
  if (userIds.length > 0) {
    const { data: mems } = await admin
      .from("memberships")
      .select(
        "id, user_id, plan_kind, seat_number, valid_from, valid_until, starts_at, ends_at, created_at",
      )
      .in("user_id", userIds)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    for (const m of mems ?? []) {
      const uid = (m as { user_id: string }).user_id;
      if (!uid) continue;
      (memsByUser[uid] ??= []).push(m as MembershipSeatPickRow);
    }
  }

  const isDev = process.env.NODE_ENV === "development";
  const rowsBeforeFilter = rows.length;

  const items: AdminDailyAttendanceItem[] = rows.flatMap((r) => {
    const memberNumber = parseEmpcodeToMemberNumber(r.Empcode);
    if (memberNumber == null) return [];
    const profile = profilesById[memberNumber];
    if (!profile) return [];
    const parsedYmd = dmyToYmd(r.DateString);
    let seat: number | null = null;
    let devReason: string | undefined;
    let seatPlanKind: string | null = null;
    let persistedSeatLabel: string | null = null;
    let coverageWarning: string | null = null;
    if (parsedYmd) {
      const p = pickSeatForLibraryDay(memsByUser[profile.user_id] ?? [], parsedYmd, DEFAULT_LIBRARY_TZ);
      if (p.devReason === "no_membership_covers_day") {
        if (!rowHasPunchEvidence(r)) {
          return [];
        }
        coverageWarning =
          "Punch on this date is outside the member’s active membership window; no seat applies.";
        seat = p.seat;
        seatPlanKind = p.plan_kind;
        persistedSeatLabel = p.persisted_seat_label;
        devReason = p.devReason;
      } else {
        seat = p.seat;
        seatPlanKind = p.plan_kind;
        persistedSeatLabel = p.persisted_seat_label;
        devReason = p.devReason;
      }
    } else {
      coverageWarning =
        "This row’s date could not be read, so membership and seat were not matched.";
    }
    const seatDebugParts: string[] = [];
    if (isDev && seat == null) {
      if (!parsedYmd) seatDebugParts.push("unparseable_row_date");
      if (devReason) seatDebugParts.push(devReason);
    }
    const ui = statusUiFromRow(r.INTime, r.OUTTime, r.Status);
    const item: AdminDailyAttendanceItem = {
      date: r.DateString,
      empcode: r.Empcode,
      member_number: memberNumber,
      full_name: profile.full_name ?? r.Name ?? null,
      seat_number: seat,
      seat_label: resolveMemberSeatDisplayLabel({
        plan_kind: seatPlanKind ?? "",
        seat_number: seat,
        seat_label: persistedSeatLabel,
      }),
      coverage_warning: coverageWarning,
      in_time: r.INTime,
      out_time: r.OUTTime,
      work_time: r.WorkTime,
      status: r.Status,
      remark: r.Remark,
      source,
      status_ui: ui.status_ui,
      status_ui_label: ui.status_ui_label,
    };
    if (isDev && seatDebugParts.length > 0) {
      item.seat_debug = seatDebugParts.join(",");
    }
    return [item];
  });

  return {
    ok: true,
    fromDate,
    toDate,
    source,
    items,
    skipped: rowsBeforeFilter - items.length,
  };
}
