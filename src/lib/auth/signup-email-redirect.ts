/** Email confirmation link target (web vs Expo deep link). */
export function signupEmailRedirectTo(origin: string, mobile: boolean): string | undefined {
  if (mobile) return "studentapp://auth/callback";
  if (!origin) return undefined;
  return `${origin}/auth/callback?next=${encodeURIComponent("/login")}`;
}
