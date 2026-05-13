import "server-only";

/**
 * eTimeOffice commonly uses a custom Basic username string:
 *   corporateId:username:password:true → Base64 for the "username" part of Basic,
 *   with an empty password (per several integration guides).
 * Alternatively set ETIME_AUTHORIZATION to the full `Basic …` header value.
 */
export function getEtimeAuthorizationHeader(): string | null {
  const preset = process.env.ETIME_AUTHORIZATION?.trim();
  if (preset) {
    if (preset.toLowerCase().startsWith("basic ")) return preset;
    return `Basic ${Buffer.from(preset, "utf8").toString("base64")}`;
  }

  // ETIME_BASIC_USER is the legacy env name; if set on its own it's already the
  // "corp:user:pass:true" combined string and is base64-encoded as the Basic user.
  const basicUser = process.env.ETIME_BASIC_USER?.trim();
  const basicPass = process.env.ETIME_BASIC_PASSWORD?.trim();
  if (basicUser && !basicPass) {
    return `Basic ${Buffer.from(basicUser, "utf8").toString("base64")}`;
  }
  if (basicUser && basicPass) {
    return `Basic ${Buffer.from(`${basicUser}:${basicPass}`, "utf8").toString("base64")}`;
  }

  const corp = process.env.ETIME_CORPORATE_ID?.trim();
  const user = process.env.ETIME_USER?.trim();
  const pass = process.env.ETIME_PASS?.trim();
  if (corp && user && pass) {
    const raw = `${corp}:${user}:${pass}:true`;
    return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
  }

  if (user && pass) {
    return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
  }

  return null;
}
