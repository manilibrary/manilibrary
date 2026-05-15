import type { SupabaseClient } from "@supabase/supabase-js";

import { formatPersonName } from "@/lib/format-person-name";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMemberEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function isValidMemberEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

export function generateAdminIssuedTempPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(22);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return `Ml-${out}`;
}

export type CreateMemberAccountResult =
  | { ok: true; user_id: string; device_user_id: number; temporary_password?: string }
  | { ok: false; message: string };

/**
 * Creates Auth user + profile row (trigger assigns device_user_id). Caller must use service-role client.
 */
export async function createMemberAccount(
  admin: SupabaseClient,
  params: { full_name: string; email: string; phone?: string; password?: string },
): Promise<CreateMemberAccountResult> {
  const fullName = formatPersonName(params.full_name).slice(0, 200);
  const email = normalizeMemberEmail(params.email);
  const phone = params.phone?.trim().slice(0, 40) ?? "";
  const passwordRaw = params.password ?? "";

  if (!fullName || fullName.length > 200) {
    return { ok: false, message: "full_name is required (max 200 characters)." };
  }
  if (!email || !isValidMemberEmail(email)) {
    return { ok: false, message: "A valid email is required." };
  }

  let password = passwordRaw.trim();
  let temporaryPassword: string | undefined;
  if (password.length === 0) {
    password = generateAdminIssuedTempPassword();
    temporaryPassword = password;
  } else if (password.length < 8 || password.length > 72) {
    return { ok: false, message: "password must be between 8 and 72 characters, or omit it to auto-generate." };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      ...(phone ? { phone } : {}),
    },
  });

  if (createErr || !created.user?.id) {
    return { ok: false, message: createErr?.message ?? "Could not create account." };
  }

  const userId = created.user.id;

  const { data: profile, error: pe } = await admin
    .from("profiles")
    .select("user_id, device_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (pe || !profile) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: "Account was created but profile setup failed. Try again." };
  }

  return {
    ok: true,
    user_id: profile.user_id,
    device_user_id: profile.device_user_id as number,
    ...(temporaryPassword ? { temporary_password: temporaryPassword } : {}),
  };
}
