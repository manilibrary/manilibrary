import { apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { getPublicHeroSettings } from "@/lib/hero/get-public-hero";

export const runtime = "nodejs";

export async function GET() {
  try {
    const hero = await getPublicHeroSettings();
    return apiSuccess("OK.", { hero });
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not load hero.");
  }
}
