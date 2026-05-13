import { NextResponse } from "next/server";

/** Standard success body for Postman / clients: always includes `message` and data fields. */
export function apiSuccess(message: string, data: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: true, message, ...data }, { status });
}

/** Standard error body: `error` and duplicate `message` for easy reading in Postman. */
export function apiError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, message, ...extra }, { status });
}

/** Merge eTime (or similar) payload with `ok` + `message` without dropping vendor fields. */
export function apiSuccessWithEnvelope(
  message: string,
  envelope: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json({ ok: true, message, ...envelope }, { status });
}
