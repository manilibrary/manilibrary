import { apiError } from "@/lib/api/json-response";

import { EtimeHttpError } from "./fetch-server";

export function etimeErrorResponse(e: unknown) {
  if (e instanceof EtimeHttpError) {
    return apiError(e.message, 502, { snippet: e.bodySnippet });
  }
  const msg = e instanceof Error ? e.message : "eTime request failed";
  if (msg.includes("credentials missing")) {
    return apiError(msg, 503);
  }
  return apiError(msg, 500);
}
