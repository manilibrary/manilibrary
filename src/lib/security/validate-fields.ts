import { formatPersonName } from "@/lib/format-person-name";
import { FIELD_LIMITS } from "@/lib/security/field-limits";

export type FieldValidationResult =
  | { ok: true; name: string; email: string; phone: string; password: string }
  | { ok: false; error: string };

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, FIELD_LIMITS.emailMax);
}

const PHONE_DIGITS_MIN = 10;

export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function validateStaffNewMemberAccountFields(input: {
  name: unknown;
  email: unknown;
  phone: unknown;
  password: unknown;
}): FieldValidationResult {
  const base = validateRegisterFields(input);
  if (!base.ok) return base;
  const digits = normalizePhoneDigits(base.phone);
  if (digits.length < PHONE_DIGITS_MIN) {
    return { ok: false, error: `Phone is required (at least ${PHONE_DIGITS_MIN} digits).` };
  }
  return { ok: true, name: base.name, email: base.email, phone: base.phone.trim(), password: base.password };
}

export function validateRegisterFields(input: {
  name: unknown;
  email: unknown;
  phone?: unknown;
  password: unknown;
}): FieldValidationResult {
  const nameRaw = typeof input.name === "string" ? input.name.trim() : "";
  const name = formatPersonName(nameRaw).slice(0, FIELD_LIMITS.nameMax);
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const phone =
    typeof input.phone === "string" ? input.phone.trim().slice(0, FIELD_LIMITS.phoneMax) : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (name.length < FIELD_LIMITS.nameMin) {
    return { ok: false, error: `Full name is required (${FIELD_LIMITS.nameMin}–${FIELD_LIMITS.nameMax} characters).` };
  }
  if (!email.includes("@") || email.length < 5) {
    return { ok: false, error: "A valid email is required." };
  }
  if (email.length > FIELD_LIMITS.emailMax) {
    return { ok: false, error: "Email is too long." };
  }
  if (password.length < FIELD_LIMITS.passwordMin) {
    return { ok: false, error: `Password must be at least ${FIELD_LIMITS.passwordMin} characters.` };
  }
  if (password.length > FIELD_LIMITS.passwordMax) {
    return { ok: false, error: "Password is too long." };
  }
  return { ok: true, name, email, phone, password };
}

export function validateLoginFields(input: {
  email: unknown;
  password: unknown;
}): { ok: true; email: string; password: string } | { ok: false; error: string } {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!email.includes("@")) {
    return { ok: false, error: "Sign in with the email address on your account." };
  }
  if (!password) {
    return { ok: false, error: "Password is required." };
  }
  if (password.length > FIELD_LIMITS.passwordMax) {
    return { ok: false, error: "Password is too long." };
  }
  return { ok: true, email, password };
}

export function validateForgotPasswordEmail(input: { email: unknown }):
  | { ok: true; email: string }
  | { ok: false; error: string } {
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  if (!email.includes("@") || email.length < 5) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true, email };
}

export function clampString(value: unknown, maxLen: number): string {
  if (value == null) return "";
  return String(value).trim().slice(0, maxLen);
}
