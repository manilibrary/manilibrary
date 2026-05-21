import type { HeroSlot } from "@/lib/hero/constants";
import { heroSlotColumnPrefix } from "@/lib/hero/constants";

export type HeroGalleryRow = {
  hero_1_gallery_image_id: string | null;
  hero_2_gallery_image_id: string | null;
  hero_3_gallery_image_id: string | null;
};

export function heroGalleryIdColumn(slot: HeroSlot): keyof HeroGalleryRow {
  return `${heroSlotColumnPrefix(slot)}_gallery_image_id` as keyof HeroGalleryRow;
}

export function heroGalleryIdUsedOnOtherSlot(
  row: HeroGalleryRow,
  slot: HeroSlot,
  galleryImageId: string,
): boolean {
  for (const s of [1, 2, 3] as const) {
    if (s === slot) continue;
    if (row[heroGalleryIdColumn(s)] === galleryImageId) return true;
  }
  return false;
}
