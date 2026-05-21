/** Shared input limits — keep in sync with `student-app/lib/fieldLimits.ts`. */

export const FIELD_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  emailMax: 254,
  phoneMax: 40,
  passwordMin: 8,
  passwordMax: 128,
  preparingForMax: 200,
  adminMessageMax: 2000,
  searchMax: 120,
  rollMaxDigits: 8,
  aadhaarLast4Len: 4,
} as const;

export const JSON_BODY_MAX_BYTES = 64 * 1024;

export const AVATAR_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const KYC_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const GALLERY_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Extra bytes for multipart boundaries on upload routes. */
const MULTIPART_SLACK_BYTES = 64 * 1024;

const POST_BODY_MAX_BYTES_BY_PATH: Record<string, number> = {
  "/api/me/avatar": AVATAR_UPLOAD_MAX_BYTES + MULTIPART_SLACK_BYTES,
  "/api/me/verification/document": KYC_UPLOAD_MAX_BYTES + MULTIPART_SLACK_BYTES,
  "/api/me/verification/document-checkout-pending": KYC_UPLOAD_MAX_BYTES + MULTIPART_SLACK_BYTES,
  "/api/admin/gallery/upload": GALLERY_UPLOAD_MAX_BYTES + MULTIPART_SLACK_BYTES,
};

export function maxPostBodyBytesForPath(path: string): number {
  return POST_BODY_MAX_BYTES_BY_PATH[path] ?? JSON_BODY_MAX_BYTES;
}
