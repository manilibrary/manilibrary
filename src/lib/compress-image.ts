/**
 * Browser-only image compressor.
 *
 * Iteratively scales/re-encodes a raster image until it fits under `targetBytes`.
 * Non-image files (e.g. PDFs) and already-small files are returned unchanged.
 */
const DEFAULT_TARGET_BYTES = 100 * 1024;
const MAX_DIMENSION = 1280;
const MIN_QUALITY = 0.35;
const MAX_ITERATIONS = 14;

export async function compressImageUnder(
  file: File,
  targetBytes: number = DEFAULT_TARGET_BYTES,
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= targetBytes) return file;

  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const outType: "image/jpeg" | "image/webp" =
    file.type === "image/webp" ? "image/webp" : "image/jpeg";

  let quality = 0.85;
  let blob: Blob | null = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, quality),
    );
    if (!blob) break;
    if (blob.size <= targetBytes) break;
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
    } else {
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }
  }

  bitmap.close?.();
  if (!blob || blob.size > file.size) return file;

  const ext = outType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.${ext}`, {
    type: outType,
    lastModified: Date.now(),
  });
}
