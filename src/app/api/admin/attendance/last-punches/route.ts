import { apiError, apiSuccess } from "@/lib/api/json-response";
import { displayPersonName } from "@/lib/format-person-name";

import { ymdToDmy } from "@/lib/etime/attendance-anchor";
import { cachedFetch } from "@/lib/etime/cache";
import { formatDateDMY, formatDateDMYDaysBefore } from "@/lib/etime/dates";
import { etimeFetchJson } from "@/lib/etime/fetch-server";
import { sortPunchesDesc } from "@/lib/etime/synth";
import type {
  EtimeLastPunchResponse,
  EtimeLastPunchRow,
  EtimePunchMcidResponse,
  EtimePunchMcidRow,
} from "@/lib/etime/types";
import {
  buildDownloadLastPunchDataUrl,
  buildDownloadPunchDataMcidUrl,
} from "@/lib/etime/urls";
import { etimeErrorResponse } from "@/lib/etime/etime-route-errors";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type PunchItem = {
  empcode: string;
  device_user_id: number | null;
  full_name: string | null;
  punch_date: string;
  flag: string | null;
  table: string;
  empcard: string;
  id: number | null;
  source: "device-last-punch" | "device-mcid";
};

function parseEmpcodeToDeviceUserId(emp: string | null | undefined): number | null {
  if (!emp) return null;
  const cleaned = emp.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

/** PunchDate like "DD/MM/YYYY HH:mm:ss" → YYYY-MM-DD (library row day). */
function punchDateToYmd(punchDate: string): string | null {
  const m = punchDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

const LAST_PUNCH_TTL_MS = 20_000;
const RECENT_PUNCH_TTL_MS = 30_000;

async function fetchLastPunchData(
  empcode: string | undefined,
  lastRecord: string | undefined,
): Promise<{ rows: EtimeLastPunchRow[]; maxRecord: string | null; tableName: string | null } | null> {
  const key = `last-punch:${empcode ?? "ALL"}:${lastRecord ?? ""}`;
  return cachedFetch(key, LAST_PUNCH_TTL_MS, async () => {
    try {
      const target = buildDownloadLastPunchDataUrl({ empcode, lastRecord });
      const json = await etimeFetchJson<EtimeLastPunchResponse>(target);
      if (json.Error) return null;
      return {
        rows: json.PunchData ?? [],
        maxRecord: json.MaxRecord ?? null,
        tableName: json.TableName ?? null,
      };
    } catch {
      return null;
    }
  });
}

function expandRangeToMcid(fromDmy: string, toDmy: string): { from: string; to: string } {
  return { from: `${fromDmy}_00:01`, to: `${toDmy}_23:59` };
}

async function fetchRecentPunches(
  empcode: string | undefined,
  range: { fromDmy: string; toDmy: string },
): Promise<EtimePunchMcidRow[] | null> {
  const key = `recent-punches:${empcode ?? "ALL"}:${range.fromDmy}:${range.toDmy}`;
  return cachedFetch<EtimePunchMcidRow[] | null>(key, RECENT_PUNCH_TTL_MS, async () => {
    const { from, to } = expandRangeToMcid(range.fromDmy, range.toDmy);
    try {
      const target = buildDownloadPunchDataMcidUrl({ empcode, fromDate: from, toDate: to });
      const json = await etimeFetchJson<EtimePunchMcidResponse>(target);
      if (json.Error) return null;
      return json.PunchData ?? [];
    } catch {
      return null;
    }
  });
}

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const url = new URL(request.url);
  const empcode = url.searchParams.get("empcode") ?? undefined;
  const lastRecord = url.searchParams.get("lastRecord") ?? undefined;
  const forYmd = url.searchParams.get("forYmd")?.trim();
  const fromYmd = url.searchParams.get("fromYmd")?.trim();
  const toYmd = url.searchParams.get("toYmd")?.trim();

  const now = new Date();
  let mcidFromDmy: string;
  let mcidToDmy: string;
  if (fromYmd && toYmd && /^\d{4}-\d{2}-\d{2}$/.test(fromYmd) && /^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    const a = ymdToDmy(fromYmd);
    const b = ymdToDmy(toYmd);
    if (!a || !b) {
      return apiError("Invalid fromYmd / toYmd.", 400);
    }
    mcidFromDmy = fromYmd <= toYmd ? a : b;
    mcidToDmy = fromYmd <= toYmd ? b : a;
  } else if (forYmd && /^\d{4}-\d{2}-\d{2}$/.test(forYmd)) {
    const d = ymdToDmy(forYmd);
    if (!d) return apiError("Invalid forYmd.", 400);
    mcidFromDmy = d;
    mcidToDmy = d;
  } else {
    mcidToDmy = formatDateDMY(now);
    mcidFromDmy = formatDateDMYDaysBefore(now, 10);
  }

  // Fire both endpoints in parallel; prefer the streaming endpoint when it has
  // data, fall back to DownloadPunchDataMCID otherwise.
  const [primary, fallbackPunches] = await Promise.all([
    fetchLastPunchData(empcode, lastRecord),
    fetchRecentPunches(empcode, { fromDmy: mcidFromDmy, toDmy: mcidToDmy }),
  ]);

  let source: "device-last-punch" | "device-mcid" = "device-last-punch";
  let maxRecord: string | null = null;
  let tableName: string | null = null;
  let mappedRows: { empcode: string; name: string; punchDate: string; flag: string | null; table: string; card: string; id: number | null }[] = [];

  if (primary && primary.rows.length > 0) {
    maxRecord = primary.maxRecord;
    tableName = primary.tableName;
    mappedRows = primary.rows.map((r) => ({
      empcode: r.Empcode,
      name: r.Name,
      punchDate: r.PunchDate,
      flag: r.M_Flag,
      table: r.Table,
      card: r.EmpcardNo,
      id: r.ID,
    }));
  } else if (fallbackPunches && fallbackPunches.length > 0) {
    source = "device-mcid";
    const sorted = sortPunchesDesc(fallbackPunches);
    mappedRows = sorted.slice(0, 120).map((r) => ({
      empcode: r.Empcode,
      name: r.Name,
      punchDate: r.PunchDate,
      flag: r.M_Flag,
      table: "",
      card: "",
      id: null,
    }));
  } else if (primary === null && fallbackPunches === null) {
    return etimeErrorResponse(
      new Error(
        "eTime did not return punches. Both DownloadLastPunchData and DownloadPunchDataMCID failed. Check ETIME_BASIC_USER and that the eTime service is reachable.",
      ),
    );
  }

  const admin = createSupabaseServiceRoleClient();
  const deviceUserIds = Array.from(
    new Set(
      mappedRows
        .map((r) => parseEmpcodeToDeviceUserId(r.empcode))
        .filter((n): n is number => n != null),
    ),
  );

  const profilesById: Record<number, { full_name: string; device_user_id: number }> = {};
  if (deviceUserIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("full_name, device_user_id")
      .in("device_user_id", deviceUserIds);
    for (const p of profs ?? []) {
      profilesById[p.device_user_id] = p;
    }
  }

  // Drop punches from people enrolled on the device but not registered with
  // the library (no matching profiles.device_user_id).
  const before = mappedRows.length;
  const items: PunchItem[] = mappedRows.flatMap((r) => {
    const deviceUserId = parseEmpcodeToDeviceUserId(r.empcode);
    if (deviceUserId == null) return [];
    const profile = profilesById[deviceUserId];
    if (!profile) return [];
    return [
      {
        empcode: r.empcode,
        device_user_id: deviceUserId,
        full_name: displayPersonName(profile.full_name ?? r.name ?? "", "—") || null,
        punch_date: r.punchDate,
        flag: r.flag,
        table: r.table,
        empcard: r.card,
        id: r.id,
        source,
      },
    ];
  });

  let filtered = items;
  if (forYmd && /^\d{4}-\d{2}-\d{2}$/.test(forYmd)) {
    filtered = items.filter((it) => punchDateToYmd(it.punch_date) === forYmd);
  } else if (fromYmd && toYmd && /^\d{4}-\d{2}-\d{2}$/.test(fromYmd) && /^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    const lo = fromYmd <= toYmd ? fromYmd : toYmd;
    const hi = fromYmd <= toYmd ? toYmd : fromYmd;
    filtered = items.filter((it) => {
      const y = punchDateToYmd(it.punch_date);
      return y != null && y >= lo && y <= hi;
    });
  }

  const skippedUnregistered = before - items.length;

  return apiSuccess(`Last punches loaded (${filtered.length} row(s); source: ${source}).`, {
    items: filtered,
    source,
    maxRecord,
    tableName,
    skipped_unregistered: skippedUnregistered,
    skipped_outside_filter: items.length - filtered.length,
  });
}
