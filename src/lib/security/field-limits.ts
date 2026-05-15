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
