import { apiError } from "@/lib/api/json-response";
import type { NextResponse } from "next/server";
import { JSON_BODY_MAX_BYTES } from "@/lib/security/field-limits";
import { checkRateLimit, RATE_WINDOWS, type RateLimitResult } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return apiError("Too many requests. Please try again later.", 429, {
    retryAfterSec,
  });
}

export function applyRateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const result: RateLimitResult = checkRateLimit(key, limit, windowMs);
  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterSec);
  }
  return null;
}

export async function readJsonBody(
  request: Request,
  maxBytes = JSON_BODY_MAX_BYTES,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const n = Number.parseInt(contentLength, 10);
    if (Number.isFinite(n) && n > maxBytes) {
      return { ok: false, response: apiError("Request body too large.", 413) };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: apiError("Could not read request body.", 400) };
  }

  if (text.length > maxBytes) {
    return { ok: false, response: apiError("Request body too large.", 413) };
  }
  if (!text.trim()) {
    return { ok: false, response: apiError("Expected JSON body.", 400) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, response: apiError("Invalid JSON body.", 400) };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, response: apiError("Expected a JSON object.", 400) };
  }

  return { ok: true, body: parsed as Record<string, unknown> };
}

function turnstileTokenFromBody(body: Record<string, unknown>, request: Request): string {
  const fromHeader = request.headers.get("x-turnstile-token")?.trim();
  if (fromHeader) return fromHeader;
  const raw = body.turnstileToken ?? body.captchaToken;
  return typeof raw === "string" ? raw.trim() : "";
}

export function guardAuthIp(request: Request): NextResponse | null {
  const ip = getClientIp(request);
  return applyRateLimit(`auth:ip:${ip}`, RATE_WINDOWS.authIp.limit, RATE_WINDOWS.authIp.windowMs);
}

export function guardAuthEmail(email: string): NextResponse | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return applyRateLimit(
    `auth:email:${normalized}`,
    RATE_WINDOWS.authEmail.limit,
    RATE_WINDOWS.authEmail.windowMs,
  );
}

function isExpoClient(request: Request, body: Record<string, unknown>): boolean {
  if (body.client === "expo") return true;
  return request.headers.get("x-app-client")?.toLowerCase() === "expo";
}

export async function guardPublicAuthPost(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const ipLimited = guardAuthIp(request);
  if (ipLimited) return { ok: false, response: ipLimited };

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed;

  if (!isExpoClient(request, parsed.body)) {
    const ip = getClientIp(request);
    const captcha = await verifyTurnstileToken(turnstileTokenFromBody(parsed.body, request), ip);
    if (!captcha.ok) {
      return { ok: false, response: apiError(captcha.error, 400) };
    }
  }

  return parsed;
}

export function guardApiIp(request: Request): NextResponse | null {
  const ip = getClientIp(request);
  return applyRateLimit(`api:ip:${ip}`, RATE_WINDOWS.apiIp.limit, RATE_WINDOWS.apiIp.windowMs);
}
