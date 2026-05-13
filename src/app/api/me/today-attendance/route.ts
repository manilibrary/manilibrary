import { apiError, apiSuccess } from "@/lib/api/json-response";

import {
  attendanceAnchorYmd,
  dmyToYmd,
  maxYmd,
  parseDmyToSortKey,
  punchBoundsFromDmy,
  ymdOnCalendarInTz,
  ymdToDmy,
} from "@/lib/etime/attendance-anchor";
import { cachedFetch } from "@/lib/etime/cache";
import { etimeFetchJson } from "@/lib/etime/fetch-server";
import { deriveDailyFromPunches } from "@/lib/etime/synth";
import type { EtimeInOutResponse, EtimePunchMcidResponse, EtimePunchMcidRow } from "@/lib/etime/types";
import { buildDownloadInOutPunchDataUrl, buildDownloadPunchDataMcidUrl } from "@/lib/etime/urls";
import { addDaysYmd, DEFAULT_LIBRARY_TZ } from "@/lib/membership/windows";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type DailyRow = {
  in_time: string;
  out_time: string;
  work_time: string;
  overtime: string;
  status: string;
  date: string;
  remark: string;
};

type MembershipRow = {
  plan_kind: string;
  starts_at: string | null;
  valid_from: string | null;
};

function isDashTime(t: string | null | undefined): boolean {
  if (!t) return true;
  const trimmed = t.trim();
  if (trimmed === "" || trimmed === "--:--" || trimmed === "00:00") return true;
  return false;
}

function isWorkZeroish(w: string | null | undefined): boolean {
  const t = (w ?? "").trim();
  return t === "" || t === "00:00" || t === "0:00";
}

/**
 * eTime often emits one row per calendar day with Absent / empty punches even when the member
 * had no real activity (e.g. before they joined). Drop those so history matches reality.
 */
function isSyntheticPadRow(row: DailyRow): boolean {
  if (!isDashTime(row.in_time) || !isDashTime(row.out_time)) return false;
  if (!isWorkZeroish(row.work_time)) return false;
  const ot = (row.overtime ?? "").trim();
  if (ot && ot !== "00:00" && ot !== "0:00") return false;
  const st = (row.status ?? "").trim().toUpperCase();
  const absentish = st === "A" || st === "ABS" || st === "ABSENT" || st === "";
  if (!absentish) return false;
  const rm = (row.remark ?? "").trim();
  const trivial =
    rm === "" || rm === "--" || rm === "-" || rm === "—" || rm.toUpperCase() === "NA" || rm.toUpperCase() === "N/A";
  return trivial;
}

function empcodeMatches(rowEmp: string, deviceUserId: number): boolean {
  const cleaned = rowEmp.replace(/[^0-9]/g, "");
  if (!cleaned) return false;
  return parseInt(cleaned, 10) === deviceUserId;
}

function rowToDaily(r: {
  INTime: string;
  OUTTime: string;
  WorkTime: string;
  OverTime: string;
  Status: string;
  DateString: string;
  Remark: string;
}): DailyRow {
  return {
    in_time: r.INTime,
    out_time: r.OUTTime,
    work_time: r.WorkTime,
    overtime: r.OverTime,
    status: r.Status,
    date: r.DateString,
    remark: r.Remark,
  };
}

function normDmy(s: string): string {
  return s.trim();
}

function membershipStartYmd(m: MembershipRow | null, tz: string): string | null {
  if (!m) return null;
  if (m.plan_kind === "long_term" && m.valid_from) {
    return m.valid_from.slice(0, 10);
  }
  if (m.plan_kind === "short_term" && m.starts_at) {
    return ymdOnCalendarInTz(new Date(m.starts_at), tz);
  }
  return null;
}

function historyFloorYmd(anchorYmd: string, tz: string, membership: MembershipRow | null, profileCreatedAt: string | null): string {
  const cap30 = addDaysYmd(anchorYmd, -30);
  const memStart = membershipStartYmd(membership, tz);
  if (memStart) {
    return maxYmd(cap30, memStart);
  }
  if (profileCreatedAt) {
    const acct = ymdOnCalendarInTz(new Date(profileCreatedAt), tz);
    return maxYmd(cap30, acct);
  }
  return cap30;
}

const SUMMARY_TTL_MS = 30_000;
const PUNCHES_TTL_MS = 30_000;

async function summaryForRange(
  deviceUserId: number,
  fromDMY: string,
  toDMY: string,
): Promise<DailyRow[]> {
  const summaryKey = `me-summary:ALL:${fromDMY}:${toDMY}`;
  const all = await cachedFetch<EtimeInOutResponse | null>(summaryKey, SUMMARY_TTL_MS, async () => {
    try {
      const url = buildDownloadInOutPunchDataUrl({ empcode: "ALL", fromDate: fromDMY, toDate: toDMY });
      const json = await etimeFetchJson<EtimeInOutResponse>(url);
      if (json.Error) return null;
      return json;
    } catch {
      return null;
    }
  });
  if (!all) return [];
  return (all.InOutPunchData ?? [])
    .filter((r) => empcodeMatches(r.Empcode, deviceUserId))
    .map((r) => rowToDaily(r));
}

async function punchesForAnchorDmy(deviceUserId: number, anchorDMY: string): Promise<EtimePunchMcidRow[]> {
  const bounds = punchBoundsFromDmy(anchorDMY);
  const key = `me-punches:ALL:${bounds.from}:${bounds.to}`;
  const all = await cachedFetch<EtimePunchMcidRow[] | null>(key, PUNCHES_TTL_MS, async () => {
    try {
      const url = buildDownloadPunchDataMcidUrl({ empcode: "ALL", fromDate: bounds.from, toDate: bounds.to });
      const json = await etimeFetchJson<EtimePunchMcidResponse>(url);
      if (json.Error) return null;
      return json.PunchData ?? [];
    } catch {
      return null;
    }
  });
  if (!all) return [];
  return all.filter((r) => empcodeMatches(r.Empcode, deviceUserId));
}

export async function GET() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load profile.";
    return apiError(msg, 503);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("device_user_id, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.device_user_id) {
    return apiError("No device_user_id on your profile.", 400);
  }

  const { data: membership } = await admin
    .from("memberships")
    .select("plan_kind, starts_at, valid_from")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const deviceUserId = profile.device_user_id as number;
  const tz = DEFAULT_LIBRARY_TZ;
  const anchorYmd = attendanceAnchorYmd(new Date(), tz);
  const anchorDMY = ymdToDmy(anchorYmd);
  const floorYmd = historyFloorYmd(anchorYmd, tz, membership as MembershipRow | null, profile.created_at ?? null);
  const fromDMY = ymdToDmy(floorYmd);

  const rangeRows = await summaryForRange(deviceUserId, fromDMY, anchorDMY);
  const anchorNorm = normDmy(anchorDMY);

  let daily: DailyRow | null =
    rangeRows.find((r) => normDmy(r.date) === anchorNorm) ?? null;

  const anchorPunches = await punchesForAnchorDmy(deviceUserId, anchorDMY);
  const summaryEmpty = !daily || (isDashTime(daily.in_time) && isDashTime(daily.out_time));
  if (summaryEmpty && anchorPunches.length > 0) {
    const derivedList = deriveDailyFromPunches(anchorPunches);
    const derived = derivedList.find((d) => normDmy(d.date) === anchorNorm) ?? null;
    if (derived) {
      daily = {
        in_time: derived.inTime,
        out_time: derived.outTime,
        work_time: derived.workTime,
        overtime: "00:00",
        status: derived.status,
        date: derived.date,
        remark: "derived",
      };
    }
  }

  const floorForRow = floorYmd;
  const history = rangeRows
    .filter((r) => normDmy(r.date) !== anchorNorm)
    .filter((r) => {
      const ry = dmyToYmd(normDmy(r.date));
      return ry && ry >= floorForRow;
    })
    .filter((r) => !isSyntheticPadRow(r))
    .sort((a, b) => parseDmyToSortKey(b.date) - parseDmyToSortKey(a.date));

  const hasIn = daily ? !isDashTime(daily.in_time) : false;
  const hasOut = daily ? !isDashTime(daily.out_time) : false;

  return apiSuccess("Today's attendance summary loaded.", {
    deviceUserId,
    attendanceDate: anchorDMY,
    today: anchorDMY,
    historyFromYmd: floorYmd,
    historyFromDmy: fromDMY,
    daily,
    history,
    punches: [],
    hasIn,
    hasOut,
    note: daily
      ? null
      : "No punch yet for this attendance day. Tap your finger on the device, then refresh.",
  });
}
