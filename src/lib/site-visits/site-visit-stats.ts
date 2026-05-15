import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteVisitOverviewStats = {
  uniqueAllTime: number;
  uniqueToday: number;
  unique30d: number;
  pageViewsToday: number;
  pageViews30d: number;
};

const EMPTY: SiteVisitOverviewStats = {
  uniqueAllTime: 0,
  uniqueToday: 0,
  unique30d: 0,
  pageViewsToday: 0,
  pageViews30d: 0,
};

function rowToStats(row: Record<string, unknown> | null): SiteVisitOverviewStats {
  if (!row) return EMPTY;
  return {
    uniqueAllTime: Number(row.uniqueAllTime ?? 0) || 0,
    uniqueToday: Number(row.uniqueToday ?? 0) || 0,
    unique30d: Number(row.unique30d ?? 0) || 0,
    pageViewsToday: Number(row.pageViewsToday ?? 0) || 0,
    pageViews30d: Number(row.pageViews30d ?? 0) || 0,
  };
}

/** Loads distinct-visitor and page-view counts for the admin overview. */
export async function loadSiteVisitOverviewStats(
  admin: SupabaseClient,
): Promise<SiteVisitOverviewStats> {
  const { data, error } = await admin.rpc("site_visit_overview_stats");
  if (!error && data && typeof data === "object" && !Array.isArray(data)) {
    return rowToStats(data as Record<string, unknown>);
  }

  const thirtyAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const startOfDay = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;

  const [allKeys, todayKeys, keys30d, viewsToday, views30d] = await Promise.all([
    admin.from("site_visits").select("visitor_key").limit(50_000),
    admin.from("site_visits").select("visitor_key").gte("visited_at", startOfDay).limit(20_000),
    admin.from("site_visits").select("visitor_key").gte("visited_at", thirtyAgoIso).limit(50_000),
    admin.from("site_visits").select("id", { count: "exact", head: true }).gte("visited_at", startOfDay),
    admin.from("site_visits").select("id", { count: "exact", head: true }).gte("visited_at", thirtyAgoIso),
  ]);

  const distinct = (rows: { visitor_key: string }[] | null) =>
    new Set((rows ?? []).map((r) => r.visitor_key)).size;

  if (allKeys.error?.message?.includes("does not exist")) return EMPTY;

  return {
    uniqueAllTime: distinct(allKeys.data as { visitor_key: string }[] | null),
    uniqueToday: distinct(todayKeys.data as { visitor_key: string }[] | null),
    unique30d: distinct(keys30d.data as { visitor_key: string }[] | null),
    pageViewsToday: viewsToday.count ?? 0,
    pageViews30d: views30d.count ?? 0,
  };
}
