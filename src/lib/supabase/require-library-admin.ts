import { safeClientErrorMessage } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type LibraryAdminGate =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 503; message: string };

/**
 * Verifies that the caller is signed in (via cookies) and that `profiles.is_admin = true`.
 * The is_admin lookup uses the service-role client so it bypasses RLS on `profiles`
 * (avoids policy recursion through `is_library_admin()`).
 */
export async function requireLibraryAdmin(): Promise<LibraryAdminGate> {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, message: "Sign in required." };
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = safeClientErrorMessage(e, "Could not create admin client.");
    return { ok: false, status: 503, message: msg };
  }

  const { data, error } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 403, message: safeClientErrorMessage(error, "Could not verify admin access.") };
  }
  if (data?.is_admin !== true) {
    return { ok: false, status: 403, message: "Library admin only." };
  }

  return { ok: true, userId: user.id };
}

/**
 * Library admin **or** superadmin — for KYC review routes that both roles may use.
 */
export async function requireLibraryAdminOrSuperAdmin(): Promise<LibraryAdminGate> {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, message: "Sign in required." };
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = safeClientErrorMessage(e, "Could not create admin client.");
    return { ok: false, status: 503, message: msg };
  }

  const { data, error } = await admin
    .from("profiles")
    .select("is_admin, is_superadmin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 403, message: safeClientErrorMessage(error, "Could not verify admin access.") };
  }
  if (data?.is_admin !== true && data?.is_superadmin !== true) {
    return { ok: false, status: 403, message: "Library admin or superadmin only." };
  }

  return { ok: true, userId: user.id };
}
