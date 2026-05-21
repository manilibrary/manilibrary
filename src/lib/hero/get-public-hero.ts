import {
  galleryUrlMapForHeroRow,
  HERO_SETTINGS_SELECT,
  resolveHeroImageUrls,
  type HeroRow,
} from "@/lib/hero/hero-settings";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export async function getPublicHeroSettings() {
  try {
    const admin = createSupabaseServiceRoleClient();
    const { data, error } = await admin
      .from("library_settings")
      .select(HERO_SETTINGS_SELECT)
      .eq("id", 1)
      .maybeSingle();

    if (error) return resolveHeroImageUrls(null, new Map());
    const row = data as HeroRow | null;
    const urlMap = await galleryUrlMapForHeroRow(admin, row);
    return resolveHeroImageUrls(row, urlMap);
  } catch {
    return resolveHeroImageUrls(null, new Map());
  }
}
