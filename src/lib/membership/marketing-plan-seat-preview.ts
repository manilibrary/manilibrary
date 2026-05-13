/**
 * Maps home-page marketing plan ids to the seat-map route where occupancy is shown.
 * Row hall → short-term map; main hall → long-term map.
 */
export function seatPreviewPathForMarketingPlanId(planId: string): string {
  if (planId === "row-hall" || planId === "half-day") {
    return "/membership/short-term#seat-map";
  }
  return "/membership/long-term#seat-map";
}
