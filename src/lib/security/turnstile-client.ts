/** Client-safe Turnstile helpers (no secret key). */

export function turnstileSiteKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key || undefined;
}

export function turnstileRequiredOnClient(): boolean {
  return Boolean(turnstileSiteKey());
}
