import { NextResponse } from "next/server";

const DEFAULT_SAFE_FALLBACK = "Something went wrong. Please try again.";

/**
 * Maps thrown values / DB errors to short, user-safe text. Avoids leaking SQL, stack traces,
 * file paths, or long internal PostgREST payloads to browsers.
 */
export function safeClientErrorMessage(err: unknown, fallback: string = DEFAULT_SAFE_FALLBACK): string {
  let raw = "";
  if (typeof err === "string") raw = err.trim();
  else if (err instanceof Error) raw = err.message.trim();
  else if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") raw = m.trim();
  }
  if (!raw) return fallback;
  if (raw.length > 220 || /[\r\n]/.test(raw)) return fallback;
  if (/node:internal|node_modules|\bat\s+\w+\s*\(/i.test(raw) && /[/\\]/.test(raw)) return fallback;

  if (/relation\s+"[^"]+"\s+does not exist|Could not find the table|schema cache/i.test(raw)) {
    return "A library database object is missing. Please contact support.";
  }
  if (/permission denied for|42501/i.test(raw)) return "You don't have permission to complete this action.";
  if (/duplicate key value violates unique constraint|23505/i.test(raw)) return "This record already exists.";
  if (/violates foreign key constraint|23503/i.test(raw)) return "This change conflicts with other saved data.";
  if (/invalid input syntax for type uuid|22P02/i.test(raw)) return "Invalid reference.";
  if (/syntax error at or near|42703|undefined_column/i.test(raw)) return fallback;

  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch failed|NetworkError|socket hang up/i.test(raw)) {
    return "Could not reach the service. Try again in a moment.";
  }
  if (/JWT|jwt expired|Invalid JWT|session (missing|expired)|Invalid Refresh Token|refresh_token/i.test(raw)) {
    return "Your session expired. Please sign in again.";
  }

  return raw.slice(0, 200);
}

/** Standard success body for Postman / clients: always includes `message` and data fields. */
export function apiSuccess(message: string, data: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: true, message, ...data }, { status });
}

/** Standard error body: `error` and duplicate `message` for easy reading in Postman. */
export function apiError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, message, ...extra }, { status });
}

/** Like `apiError` but sanitizes unknown errors (e.g. from `catch` or Supabase). */
export function apiErrorSafe(err: unknown, status: number, fallback?: string, extra: Record<string, unknown> = {}) {
  return apiError(safeClientErrorMessage(err, fallback ?? DEFAULT_SAFE_FALLBACK), status, extra);
}

/** Merge eTime (or similar) payload with `ok` + `message` without dropping vendor fields. */
export function apiSuccessWithEnvelope(
  message: string,
  envelope: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json({ ok: true, message, ...envelope }, { status });
}
