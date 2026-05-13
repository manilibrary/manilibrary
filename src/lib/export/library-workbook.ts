import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { DEFAULT_LIBRARY_TZ, membershipCoversLibraryDay } from "@/lib/membership/windows";

const HEADER_FILL = "FF1F4E79";
const HEADER_FONT = "FFFFFFFF";
const TITLE_COLOR = "FF1F4E79";
const ZEBRA_FILL = "FFF2F5F9";
const ATTENDANCE_CAP = 15_000;
const PAYMENT_CAP = 6_000;
const IN_CHUNK = 120;

export type LibraryWorkbookStats = {
  fromYmd: string;
  toYmd: string;
  directoryRows: number;
  membershipRows: number;
  paymentRows: number;
  attendanceRows: number;
  attendanceCapped: boolean;
  workbookBytes: number;
};

type ProfileRow = {
  user_id: string;
  device_user_id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  verification_status: string | null;
  created_at: string;
  device_enrolled_at: string | null;
  is_admin: boolean | null;
  is_superadmin: boolean | null;
};

type MembershipRow = {
  id: string;
  user_id: string;
  plan_kind: string;
  status: string;
  seat_number: string | number | null;
  starts_at: string | null;
  ends_at: string | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
};

function membershipSeatDisplay(m: MembershipRow): string {
  return resolveMemberSeatDisplayLabel({
    plan_kind: m.plan_kind,
    seat_number: m.seat_number,
  });
}

type PaymentRow = {
  id: string;
  user_id: string;
  membership_id: string | null;
  amount_rupees: number;
  currency: string;
  provider: string | null;
  provider_payment_id: string | null;
  status: string;
  created_at: string;
};

type AttendanceHistoryRow = {
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

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function empcodeFromDeviceUserId(n: number): string {
  return String(n).padStart(4, "0");
}

function formatInLibraryTz(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: DEFAULT_LIBRARY_TZ,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 19);
  }
}

function formatYmdInLibraryTz(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_LIBRARY_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function membershipWindowLabel(m: MembershipRow): string {
  if (m.plan_kind === "long_term" && m.valid_from && m.valid_until) {
    return `${m.valid_from} → ${m.valid_until} (long-term)`;
  }
  if (m.plan_kind === "short_term" && m.starts_at && m.ends_at) {
    return `${formatInLibraryTz(m.starts_at)} → ${formatInLibraryTz(m.ends_at)} (short-term)`;
  }
  return m.plan_kind ?? "—";
}

function pickDirectoryMembership(
  userId: string,
  memberships: MembershipRow[],
  libraryTodayYmd: string,
): MembershipRow | null {
  const mine = memberships.filter((m) => m.user_id === userId);
  if (mine.length === 0) return null;
  const active = mine.filter((m) => m.status === "active");
  const covering = active.filter((m) => membershipCoversLibraryDay(m, libraryTodayYmd, DEFAULT_LIBRARY_TZ));
  const pickNewest = (rows: MembershipRow[]) =>
    [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
  if (covering.length > 0) return pickNewest(covering);
  if (active.length > 0) return pickNewest(active);
  return pickNewest(mine);
}

function applyHeaderRow(sheet: ExcelJS.Worksheet, rowNum: number) {
  const row = sheet.getRow(rowNum);
  row.height = 22;
  row.font = { bold: true, size: 11, color: { argb: HEADER_FONT } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = {
      top: { style: "thin", color: { argb: HEADER_FILL } },
      left: { style: "thin", color: { argb: HEADER_FILL } },
      bottom: { style: "thin", color: { argb: HEADER_FILL } },
      right: { style: "thin", color: { argb: HEADER_FILL } },
    };
  });
}

function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

function zebraBody(sheet: ExcelJS.Worksheet, firstDataRow: number, lastRow: number) {
  for (let r = firstDataRow; r <= lastRow; r += 2) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (!cell.fill || cell.fill.type !== "pattern") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA_FILL } };
      }
    });
  }
}

async function fetchAllAttendanceForRange(
  admin: SupabaseClient,
  lo: string,
  hi: string,
): Promise<{ rows: AttendanceHistoryRow[]; capped: boolean }> {
  const rows: AttendanceHistoryRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < ATTENDANCE_CAP; offset += pageSize) {
    const limit = Math.min(pageSize, ATTENDANCE_CAP - offset);
    const { data, error } = await admin
      .from("attendance_history_entries")
      .select(
        "library_day_ymd, date_dmy, device_user_id, empcode, full_name, seat_label, in_time, out_time, work_time, status, status_ui, status_ui_label, remark, source, archived_at",
      )
      .gte("library_day_ymd", lo)
      .lte("library_day_ymd", hi)
      .order("library_day_ymd", { ascending: true })
      .order("device_user_id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      if (error.code === "42P01") {
        return { rows: [], capped: false };
      }
      throw new Error(error.message);
    }
    const batch = (data ?? []) as AttendanceHistoryRow[];
    rows.push(...batch);
    if (rows.length >= ATTENDANCE_CAP) {
      return { rows: rows.slice(0, ATTENDANCE_CAP), capped: true };
    }
    if (batch.length < limit) break;
  }
  return { rows, capped: false };
}

export async function buildLibraryExportWorkbook(
  admin: SupabaseClient,
  opts: {
    fromYmd: string;
    toYmd: string;
    /** Payments with created_at on or after this ISO date (UTC) are included, up to PAYMENT_CAP. */
    paymentSinceIso: string;
  },
): Promise<{ buffer: Buffer; stats: LibraryWorkbookStats }> {
  const lo = opts.fromYmd <= opts.toYmd ? opts.fromYmd : opts.toYmd;
  const hi = opts.fromYmd <= opts.toYmd ? opts.toYmd : opts.fromYmd;

  const { data: profilesRaw, error: pe } = await admin
    .from("profiles")
    .select(
      "user_id, device_user_id, full_name, phone, email, verification_status, created_at, device_enrolled_at, is_admin, is_superadmin",
    )
    .or("is_superadmin.is.null,is_superadmin.eq.false")
    .order("device_user_id", { ascending: true });

  if (pe) throw new Error(pe.message);
  const profiles = (profilesRaw ?? []) as ProfileRow[];

  const userIds = profiles.map((p) => p.user_id);
  const memberships: MembershipRow[] = [];
  for (const chunk of chunkArray(userIds, IN_CHUNK)) {
    if (chunk.length === 0) continue;
    const { data, error } = await admin
      .from("memberships")
      .select(
        "id, user_id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, notes, created_at",
      )
      .in("user_id", chunk)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    memberships.push(...((data ?? []) as MembershipRow[]));
  }

  const { data: paymentsRaw, error: payErr } = await admin
    .from("payments")
    .select(
      "id, user_id, membership_id, amount_rupees, currency, provider, provider_payment_id, status, created_at",
    )
    .gte("created_at", opts.paymentSinceIso)
    .order("created_at", { ascending: false })
    .limit(PAYMENT_CAP);

  if (payErr) throw new Error(payErr.message);
  const payments = (paymentsRaw ?? []) as PaymentRow[];

  const paidSumByUser = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== "paid") continue;
    paidSumByUser.set(p.user_id, (paidSumByUser.get(p.user_id) ?? 0) + Number(p.amount_rupees));
  }

  const libraryToday = formatYmdInLibraryTz(new Date().toISOString());

  const { rows: attendanceRows, capped: attendanceCapped } = await fetchAllAttendanceForRange(admin, lo, hi);

  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));
  const profileByMember = new Map(profiles.map((p) => [p.device_user_id, p]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mani Library";
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  // --- Summary ---
  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: true }],
  });
  summary.mergeCells("A1:F1");
  const t1 = summary.getCell("A1");
  t1.value = "Mani Library — data export";
  t1.font = { size: 20, bold: true, color: { argb: TITLE_COLOR } };
  t1.alignment = { vertical: "middle" };

  summary.getCell("A3").value = "Attendance period (archived history)";
  summary.getCell("B3").value = `${lo}  →  ${hi}`;
  summary.getCell("A4").value = "Library calendar";
  summary.getCell("B4").value = DEFAULT_LIBRARY_TZ;
  summary.getCell("A5").value = "Generated (library-local)";
  summary.getCell("B5").value = formatInLibraryTz(new Date().toISOString());
  summary.getCell("A6").value = "Payments included from (UTC)";
  summary.getCell("B6").value = opts.paymentSinceIso.slice(0, 10);
  summary.getCell("A8").value =
    "Sheets: Directory (one row per member), Memberships, Payments, Attendance detail, Attendance summary. " +
    "Attendance rows come from archived days only — run daily archive/cron for complete history.";
  summary.getCell("A8").font = { italic: true, size: 10, color: { argb: "FF595959" } };
  summary.mergeCells("A8:F10");
  summary.getRow(8).height = 48;
  summary.getCell("A8").alignment = { wrapText: true, vertical: "top" };

  ["A3", "A4", "A5", "A6"].forEach((addr) => {
    summary.getCell(addr).font = { bold: true };
  });
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 42;

  // --- Directory ---
  const dir = workbook.addWorksheet("Directory", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });
  const dirHeaders = [
    "Empcode",
    "Full name",
    "Device user ID",
    "Email",
    "Phone",
    "Verification",
    "Staff admin",
    "Joined (profile)",
    "Device enrolled",
    "Primary membership (today)",
    "Seat (primary)",
    "Membership status",
    "Total paid (₹)",
  ];
  dir.addRow(dirHeaders);
  applyHeaderRow(dir, 1);
  setColumnWidths(dir, [10, 26, 10, 30, 14, 12, 11, 20, 20, 36, 14, 16, 14]);

  const dirRows: (string | number)[][] = [];
  for (const p of profiles) {
    const m = pickDirectoryMembership(p.user_id, memberships, libraryToday);
    const seat = m ? membershipSeatDisplay(m) : "—";
    dirRows.push([
      empcodeFromDeviceUserId(p.device_user_id),
      p.full_name,
      p.device_user_id,
      p.email ?? "",
      p.phone ?? "",
      p.verification_status ?? "",
      p.is_admin === true ? "Yes" : "No",
      formatInLibraryTz(p.created_at),
      p.device_enrolled_at ? formatInLibraryTz(p.device_enrolled_at) : "",
      m ? `${m.plan_kind} · ${membershipWindowLabel(m)}` : "—",
      seat,
      m?.status ?? "—",
      paidSumByUser.get(p.user_id) ?? 0,
    ]);
  }
  dir.addRows(dirRows);
  dir.getColumn(13).numFmt = "₹#,##0";
  if (dirRows.length > 0) {
    dir.autoFilter = { from: "A1", to: `M${dirRows.length + 1}` };
    zebraBody(dir, 2, dirRows.length + 1);
  }

  // --- Memberships ---
  const memSheet = workbook.addWorksheet("Memberships", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });
  const memHeaders = [
    "Full name",
    "Plan",
    "Device user ID",
    "Status",
    "Seat",
    "Window",
    "Created",
    "Notes",
  ];
  memSheet.addRow(memHeaders);
  applyHeaderRow(memSheet, 1);
  setColumnWidths(memSheet, [24, 12, 10, 14, 14, 42, 20, 36]);

  const memBody = memberships
    .map((m) => {
      const prof = profileByUser.get(m.user_id);
      return {
        deviceUserId: prof?.device_user_id ?? "",
        fullName: prof?.full_name ?? "",
        plan: m.plan_kind,
        status: m.status,
        seat: membershipSeatDisplay(m),
        window: membershipWindowLabel(m),
        created: formatInLibraryTz(m.created_at),
        notes: (m.notes ?? "").replace(/\s+/g, " ").slice(0, 500),
      };
    })
    .sort((a, b) => {
      const an = Number(a.deviceUserId) || 0;
      const bn = Number(b.deviceUserId) || 0;
      if (an !== bn) return an - bn;
      return String(b.created).localeCompare(String(a.created));
    });
  memSheet.addRows(
    memBody.map((row) => [
      row.fullName,
      row.plan,
      row.deviceUserId,
      row.status,
      row.seat,
      row.window,
      row.created,
      row.notes,
    ]),
  );
  if (memBody.length > 0) {
    memSheet.autoFilter = { from: "A1", to: `H${memBody.length + 1}` };
    zebraBody(memSheet, 2, memBody.length + 1);
  }

  // --- Payments ---
  const paySheet = workbook.addWorksheet("Payments", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });
  const payHeaders = [
    "Date",
    "Name",
    "Device user ID",
    "Amount (₹)",
    "Currency",
    "Status",
    "Provider",
    "Provider ref",
    "Membership id",
  ];
  paySheet.addRow(payHeaders);
  applyHeaderRow(paySheet, 1);
  setColumnWidths(paySheet, [20, 22, 10, 12, 8, 10, 14, 28, 38]);

  const payBody = payments.map((p) => {
    const prof = profileByUser.get(p.user_id);
    return {
      dt: formatInLibraryTz(p.created_at),
      deviceUserId: prof?.device_user_id ?? "",
      nm: prof?.full_name ?? "",
      amt: Number(p.amount_rupees),
      cur: p.currency,
      st: p.status,
      pr: p.provider ?? "",
      ref: p.provider_payment_id ?? "",
      mid: p.membership_id ?? "",
    };
  });
  paySheet.addRows(
    payBody.map((row) => [row.dt, row.nm, row.deviceUserId, row.amt, row.cur, row.st, row.pr, row.ref, row.mid]),
  );
  paySheet.getColumn(4).numFmt = "₹#,##0";
  if (payBody.length > 0) {
    paySheet.autoFilter = { from: "A1", to: `I${payBody.length + 1}` };
    zebraBody(paySheet, 2, payBody.length + 1);
  }

  // --- Attendance detail ---
  const att = workbook.addWorksheet("Attendance detail", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });
  const attHeaders = [
    "Library date",
    "Device date",
    "Empcode",
    "Device user ID",
    "Name",
    "Seat",
    "In",
    "Out",
    "Work",
    "Status (device)",
    "Status (display)",
    "Remark",
    "Source",
    "Archived at",
  ];
  att.addRow(attHeaders);
  applyHeaderRow(att, 1);
  setColumnWidths(att, [12, 12, 10, 10, 22, 12, 10, 10, 10, 12, 14, 14, 22, 20]);

  const attBody = attendanceRows.map((r) => ({
    d: r.library_day_ymd,
    dd: r.date_dmy,
    mn: r.device_user_id,
    ec: r.empcode,
    nm: r.full_name ?? "",
    st: r.seat_label,
    in: r.in_time,
    out: r.out_time,
    wk: r.work_time,
    raw: r.status,
    ui: r.status_ui_label,
    rm: r.remark,
    src: r.source,
    ar: formatInLibraryTz(r.archived_at),
  }));
  att.addRows(
    attBody.map((row) => [row.d, row.dd, row.ec, row.mn, row.nm, row.st, row.in, row.out, row.wk, row.raw, row.ui, row.rm, row.src, row.ar]),
  );
  if (attBody.length > 0) {
    att.autoFilter = { from: "A1", to: `N${attBody.length + 1}` };
    zebraBody(att, 2, attBody.length + 1);
  }

  const rowCountByMember = new Map<number, number>();
  for (const r of attendanceRows) {
    rowCountByMember.set(r.device_user_id, (rowCountByMember.get(r.device_user_id) ?? 0) + 1);
  }

  // --- Attendance summary (per member in range) ---
  const sumSheet = workbook.addWorksheet("Attendance summary", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });
  const sumHeaders = [
    "Empcode",
    "Name",
    "Device user ID",
    "Rows in period",
    "Distinct days",
    "Days present",
    "Days pending / not yet",
    "First date",
    "Last date",
  ];
  sumSheet.addRow(sumHeaders);
  applyHeaderRow(sumSheet, 1);
  setColumnWidths(sumSheet, [10, 24, 10, 14, 14, 14, 18, 12, 12]);

  type Agg = {
    device_user_id: number;
    name: string;
    days: Set<string>;
    presentDays: Set<string>;
    pendingDays: Set<string>;
  };
  const agg = new Map<number, Agg>();
  for (const r of attendanceRows) {
    let a = agg.get(r.device_user_id);
    if (!a) {
      a = {
        device_user_id: r.device_user_id,
        name: r.full_name ?? profileByMember.get(r.device_user_id)?.full_name ?? "",
        days: new Set(),
        presentDays: new Set(),
        pendingDays: new Set(),
      };
      agg.set(r.device_user_id, a);
    }
    a.days.add(r.library_day_ymd);
    if (r.status_ui === "present") a.presentDays.add(r.library_day_ymd);
    if (r.status_ui === "pending") a.pendingDays.add(r.library_day_ymd);
    if (r.full_name?.trim()) a.name = r.full_name.trim();
  }

  const sumRows = Array.from(agg.values())
    .map((a) => {
      const sortedDays = [...a.days].sort();
      return {
        mn: a.device_user_id,
        ec: empcodeFromDeviceUserId(a.device_user_id),
        nm: a.name,
        rows: rowCountByMember.get(a.device_user_id) ?? 0,
        days: a.days.size,
        pres: a.presentDays.size,
        pend: a.pendingDays.size,
        fd: sortedDays[0] ?? "",
        ld: sortedDays[sortedDays.length - 1] ?? "",
      };
    })
    .sort((a, b) => a.mn - b.mn);

  sumSheet.addRows(sumRows.map((row) => [row.ec, row.nm, row.mn, row.rows, row.days, row.pres, row.pend, row.fd, row.ld]));
  if (sumRows.length > 0) {
    sumSheet.autoFilter = { from: "A1", to: `I${sumRows.length + 1}` };
    zebraBody(sumSheet, 2, sumRows.length + 1);
  }

  summary.getCell("A12").value = "Row counts (this file)";
  summary.getCell("A12").font = { bold: true };
  summary.getCell("A13").value = "Directory";
  summary.getCell("B13").value = dirRows.length;
  summary.getCell("A14").value = "Memberships";
  summary.getCell("B14").value = memBody.length;
  summary.getCell("A15").value = "Payments";
  summary.getCell("B15").value = payBody.length;
  summary.getCell("C15").value = payments.length >= PAYMENT_CAP ? `Capped at ${PAYMENT_CAP} newest` : "";
  summary.getCell("A16").value = "Attendance detail";
  summary.getCell("B16").value = attBody.length;
  summary.getCell("C16").value = attendanceCapped ? `Capped at ${ATTENDANCE_CAP}` : "";

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const stats: LibraryWorkbookStats = {
    fromYmd: lo,
    toYmd: hi,
    directoryRows: dirRows.length,
    membershipRows: memBody.length,
    paymentRows: payBody.length,
    attendanceRows: attBody.length,
    attendanceCapped: attendanceCapped,
    workbookBytes: buffer.length,
  };

  return { buffer, stats };
}
