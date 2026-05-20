import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { purgePaymentCompletely } from "@/lib/superadmin/purge-user-data";
import { requireLibrarySuperAdmin } from "@/lib/supabase/require-library-super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

/** Permanently deletes a payment; draft/cancelled memberships + events are removed when safe. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireLibrarySuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { id } = await ctx.params;
  if (!id) {
    return apiError("Missing id.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server configuration error.");
  }

  const result = await purgePaymentCompletely(admin, id);
  if (!result.ok) {
    if (result.message === "Payment not found.") {
      return apiError(result.message, 404);
    }
    return apiError(result.message, 400);
  }

  return apiSuccess("Payment deleted. Linked draft membership and events were removed when applicable.");
}
