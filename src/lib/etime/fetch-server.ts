import "server-only";

import { getEtimeAuthorizationHeader } from "./auth";

export class EtimeHttpError extends Error {
  readonly status: number;
  readonly bodySnippet: string;

  constructor(status: number, bodySnippet: string) {
    super(`eTime HTTP ${status}: ${bodySnippet.slice(0, 200)}`);
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

/** Default per-request timeout in ms. The eTimeOffice REST API legitimately
 * takes 15-20s for daily / punch lookups on this account, so we wait up to
 * 25s before giving up. Routes can override per call. */
const DEFAULT_TIMEOUT_MS = 25_000;

export async function etimeFetchText(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const auth = getEtimeAuthorizationHeader();
  if (!auth) {
    throw new Error(
      "eTime credentials missing: set ETIME_AUTHORIZATION, or ETIME_CORPORATE_ID+ETIME_USER+ETIME_PASS, or ETIME_USER+ETIME_PASS.",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`eTime request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new EtimeHttpError(res.status, text);
  }
  return text;
}

export async function etimeFetchJson<T>(url: string, timeoutMs?: number): Promise<T> {
  const text = await etimeFetchText(url, timeoutMs);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`eTime returned non-JSON (first 120 chars): ${text.slice(0, 120)}`);
  }
}
