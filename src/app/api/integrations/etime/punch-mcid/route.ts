import { apiError, apiSuccessWithEnvelope } from "@/lib/api/json-response";
import { etimeErrorResponse } from "@/lib/etime/etime-route-errors";
import { etimeFetchJson } from "@/lib/etime/fetch-server";
import type { EtimePunchMcidResponse } from "@/lib/etime/types";
import { buildDownloadPunchDataMcidUrl } from "@/lib/etime/urls";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const empcode = searchParams.get("empcode") ?? undefined;

  if (!fromDate || !toDate) {
    return apiError(
      "Query params fromDate and toDate are required (e.g. 11/05/2026_00:01 and 11/05/2026_23:59).",
      400,
    );
  }

  try {
    const url = buildDownloadPunchDataMcidUrl({ empcode, fromDate, toDate });
    const json = await etimeFetchJson<EtimePunchMcidResponse>(url);
    return apiSuccessWithEnvelope("eTime MCID punch data returned (vendor JSON).", json as Record<string, unknown>);
  } catch (e) {
    return etimeErrorResponse(e);
  }
}
