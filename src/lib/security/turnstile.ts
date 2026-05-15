const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: true };
  }

  if (process.env.NODE_ENV === "development" && process.env.TURNSTILE_SKIP_IN_DEV === "1") {
    return { ok: true };
  }

  if (!token) {
    return { ok: false, error: "Complete the security check (CAPTCHA) and try again." };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp && remoteIp !== "unknown") {
    form.set("remoteip", remoteIp);
  }

  let res: Response;
  try {
    res = await fetch(VERIFY_URL, { method: "POST", body: form });
  } catch {
    return { ok: false, error: "Could not verify security check. Try again." };
  }

  let data: { success?: boolean; "error-codes"?: string[] };
  try {
    data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
  } catch {
    return { ok: false, error: "Invalid CAPTCHA verification response." };
  }

  if (data.success === true) {
    return { ok: true };
  }

  return { ok: false, error: "Security check failed. Refresh the page and try again." };
}
