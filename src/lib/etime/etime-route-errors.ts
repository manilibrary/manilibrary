import { apiError, safeClientErrorMessage } from "@/lib/api/json-response";

import { EtimeHttpError } from "./fetch-server";

export function etimeErrorResponse(e: unknown) {
  if (e instanceof EtimeHttpError) {
    return apiError(safeClientErrorMessage(e, "The gate service did not respond."), 502, { snippet: e.bodySnippet });
  }
  const msg = safeClientErrorMessage(e, "The gate service returned an error.");
  if (e instanceof Error && e.message.includes("credentials missing")) {
    return apiError(msg, 503);
  }
  return apiError(msg, 500);
}
