export const GALLERY_STORAGE_BUCKET =
  process.env.GALLERY_STORAGE_BUCKET?.trim() || "gallery";

export const GALLERY_MAX_IMAGES = 50;

export const GALLERY_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedGalleryMime(type: string): boolean {
  return ALLOWED.has(type.toLowerCase());
}

export function galleryPublicObjectUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  return `${base}/storage/v1/object/public/${GALLERY_STORAGE_BUCKET}/${storagePath}`;
}
