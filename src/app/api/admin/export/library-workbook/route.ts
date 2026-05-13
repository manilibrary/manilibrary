import { NextResponse } from "next/server";

import { apiError } from "@/lib/api/json-response";
import { buildLibraryExportWorkbook } from "@/lib/export/library-workbook";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const url = new URL(request.url);
  const fromYmd = url.searchParams.get("fromYmd")?.trim() ?? "";
  const toYmd = url.searchParams.get("toYmd")?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    return apiError("fromYmd and toYmd are required (YYYY-MM-DD).", 400);
  }

  const lo = fromYmd <= toYmd ? fromYmd : toYmd;
  const hi = fromYmd <= toYmd ? toYmd : fromYmd;
  const spanDays = Math.ceil((Date.parse(`${hi}T12:00:00Z`) - Date.parse(`${lo}T12:00:00Z`)) / 86_400_000) + 1;
  if (spanDays > 400) {
    return apiError("Date range too wide (max 400 days).", 400);
  }

  const paymentDaysBack = clamp(parseInt(url.searchParams.get("paymentDaysBack") ?? "450", 10) || 450, 30, 730);
  const paymentSince = new Date();
  paymentSince.setUTCDate(paymentSince.getUTCDate() - paymentDaysBack);
  const paymentSinceIso = paymentSince.toISOString();

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfiguration.";
    return apiError(msg, 503);
  }

  let buffer: Buffer;
  let stats: Awaited<ReturnType<typeof buildLibraryExportWorkbook>>["stats"];
  try {
    const out = await buildLibraryExportWorkbook(admin, { fromYmd: lo, toYmd: hi, paymentSinceIso });
    buffer = out.buffer;
    stats = out.stats;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed.";
    return apiError(msg, 500);
  }

  try {
    await admin.from("library_export_audit").insert({
      created_by: gate.userId,
      from_ymd: lo,
      to_ymd: hi,
      directory_rows: stats.directoryRows,
      membership_rows: stats.membershipRows,
      payment_rows: stats.paymentRows,
      attendance_rows: stats.attendanceRows,
      attendance_capped: stats.attendanceCapped,
      workbook_bytes: stats.workbookBytes,
    });
  } catch {
    // Table optional until supabase/library-export-audit.sql is applied.
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `mani-library-export_${lo}_${hi}_${stamp}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
