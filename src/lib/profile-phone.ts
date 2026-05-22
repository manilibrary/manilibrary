/** DB `profiles.phone` is bigint — 10-digit Indian mobile, no country code. */

export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

export function stripIndianPhoneInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("91") && d.length > 10) d = d.slice(2);
  if (d.startsWith("0") && d.length > 10) d = d.slice(1);
  return d.slice(0, 10);
}

/** Valid 10-digit Indian mobile (6–9XXXXXXXXX), or null. */
export function normalizeIndianMobile10(raw: string): string | null {
  const d = stripIndianPhoneInput(raw);
  return INDIAN_MOBILE_RE.test(d) ? d : null;
}

export function formatIndianPhoneDisplay(digits: string | null | undefined): string {
  if (!digits?.trim()) return "—";
  const p = digits.trim();
  if (p.includes("@")) return "—";
  const n = normalizeIndianMobile10(p) ?? (INDIAN_MOBILE_RE.test(p) ? p : null);
  if (!n) return p;
  return `+91 ${n}`;
}

/** DB `profiles.phone` is bigint — expose as 10-digit string when possible. */
export function profilePhoneFromDb(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  let digits = "";
  if (typeof value === "number" && Number.isFinite(value)) {
    digits = String(Math.trunc(value));
  } else if (typeof value === "string") {
    digits = value.replace(/\D/g, "");
  }
  if (!digits.length) return undefined;
  return normalizeIndianMobile10(digits) ?? digits;
}

export function phoneDigitsToDbInt(digits: string): number | null {
  const n = normalizeIndianMobile10(digits);
  if (!n) return null;
  return Number(n);
}
