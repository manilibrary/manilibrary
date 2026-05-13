const DEFAULT_ORIGIN = "https://api.etimeoffice.com";

export function etimeApiOrigin(): string {
  const raw = process.env.ETIME_API_ORIGIN?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : DEFAULT_ORIGIN;
}

function url(path: string, params: Record<string, string>): string {
  const origin = etimeApiOrigin();
  const u = new URL(path.startsWith("/") ? path : `/${path}`, `${origin}/`);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}

/** B1 — UersDataWithPunchInOut */
export function buildDownloadInOutPunchDataUrl(params: {
  empcode?: string;
  fromDate: string;
  toDate: string;
}): string {
  return url("/api/DownloadInOutPunchData", {
    Empcode: params.empcode ?? "ALL",
    FromDate: params.fromDate,
    ToDate: params.toDate,
  });
}

/** B2 — UsersPunchOnlyData2 */
export function buildDownloadPunchDataMcidUrl(params: {
  empcode?: string;
  fromDate: string;
  toDate: string;
}): string {
  return url("/api/DownloadPunchDataMCID", {
    Empcode: params.empcode ?? "ALL",
    FromDate: params.fromDate,
    ToDate: params.toDate,
  });
}

/** B3 — UserLastPunchData */
export function buildDownloadLastPunchDataUrl(params: { empcode?: string; lastRecord?: string }): string {
  const q: Record<string, string> = { Empcode: params.empcode ?? "ALL" };
  if (params.lastRecord && params.lastRecord.length > 0) {
    q.LastRecord = params.lastRecord;
  }
  return url("/api/DownloadLastPunchData", q);
}
