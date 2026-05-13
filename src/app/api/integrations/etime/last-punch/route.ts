import { apiError, apiSuccessWithEnvelope } from "@/lib/api/json-response";
import { etimeErrorResponse } from "@/lib/etime/etime-route-errors";
import { etimeFetchJson } from "@/lib/etime/fetch-server";
import type { EtimeLastPunchResponse } from "@/lib/etime/types";
import { buildDownloadLastPunchDataUrl } from "@/lib/etime/urls";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { searchParams } = new URL(request.url);
  const empcode = searchParams.get("empcode") ?? undefined;
  const lastRecord = searchParams.get("lastRecord") ?? undefined;

  try {
    const url = buildDownloadLastPunchDataUrl({ empcode, lastRecord });
    const json = await etimeFetchJson<EtimeLastPunchResponse>(url);
    return apiSuccessWithEnvelope("eTime last punch data returned (vendor JSON).", json as Record<string, unknown>);
  } catch (e) {
    return etimeErrorResponse(e);
  }
}
