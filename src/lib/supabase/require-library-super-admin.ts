import { safeClientErrorMessage } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type LibrarySuperAdminGate =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 503; message: string };

/**
 * Verifies signed-in user has `profiles.is_superadmin = true` (service-role read).
 */
export async function requireLibrarySuperAdmin(): Promise<LibrarySuperAdminGate> {
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
    .select("is_superadmin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 403, message: safeClientErrorMessage(error, "Could not verify superadmin access.") };
  }
  if (data?.is_superadmin !== true) {
    return { ok: false, status: 403, message: "Library superadmin only." };
  }

  return { ok: true, userId: user.id };
}
