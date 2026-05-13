/**
 * Maps home-page marketing plan ids to the seat-map route where occupancy is shown.
 * Half Day aligns with the short-term row hall; Full Day and 24/7 with the main long-term hall.
 */
export function seatPreviewPathForMarketingPlanId(planId: string): string {
  if (planId === "half-day") {
    return "/membership/short-term#seat-map";
  }
  return "/membership/long-term#seat-map";
}
