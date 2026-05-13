import { apiError, apiSuccess } from "@/lib/api/json-response";
import { formatMemberSeatToken, PENDING_MEMBERSHIP_SEAT_PLACEHOLDER } from "@/lib/membership/seat-label";
import { requireLibrarySuperAdmin } from "@/lib/supabase/require-library-super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type PatchBody = {
  plan_kind?: "short_term" | "long_term";
  status?: "pending_payment" | "active" | "expired" | "cancelled";
  seat_number?: string | number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  notes?: string | null;
};

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireLibrarySuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { id } = await ctx.params;
  if (!id) {
    return apiError("Missing id.", 400);
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const patch: Record<string, unknown> = {};
  if (body.plan_kind === "short_term" || body.plan_kind === "long_term") patch.plan_kind = body.plan_kind;
  if (
    body.status === "pending_payment" ||
    body.status === "active" ||
    body.status === "expired" ||
    body.status === "cancelled"
  ) {
    patch.status = body.status;
  }
  if (body.seat_number !== undefined) {
    if (body.seat_number === null) {
      patch.seat_number = null;
    } else if (typeof body.seat_number === "string") {
      const t = body.seat_number.trim();
      patch.seat_number = t.length ? t : null;
    } else if (typeof body.seat_number === "number" && Number.isFinite(body.seat_number)) {
      const pk = body.plan_kind;
      if (pk !== "short_term" && pk !== "long_term") {
        return apiError("plan_kind must be short_term or long_term when setting a numeric seat_number.", 400);
      }
      patch.seat_number = formatMemberSeatToken(pk, Math.round(body.seat_number));
    }
  }
  if (body.starts_at !== undefined) patch.starts_at = body.starts_at;
  if (body.ends_at !== undefined) patch.ends_at = body.ends_at;
  if (body.valid_from !== undefined) patch.valid_from = body.valid_from;
  if (body.valid_until !== undefined) patch.valid_until = body.valid_until;
  if (body.notes !== undefined) patch.notes = body.notes;

  if (patch.status === "pending_payment") {
    patch.seat_number = PENDING_MEMBERSHIP_SEAT_PLACEHOLDER;
  }

  if (Object.keys(patch).length === 0) {
    return apiError("No valid fields to update.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error.";
    return apiError(msg, 503);
  }

  const { data, error } = await admin
    .from("memberships")
    .update(patch)
    .eq("id", id)
    .select(
      "id, user_id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, notes, payment_id, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23P01") {
      return apiError(
        "Update rejected: seat/date overlap with another active membership (database rule).",
        409,
      );
    }
    return apiError(error.message, 400);
  }
  if (!data) {
    return apiError("Membership not found.", 404);
  }

  return apiSuccess("Membership updated.", { membership: data });
}

/**
 * Permanently removes the membership and linked payment rows (payment_id + membership_id).
 * Superadmin only. Irreversible.
 */
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
    const msg = e instanceof Error ? e.message : "Server configuration error.";
    return apiError(msg, 503);
  }

  const { data: row, error: fe } = await admin
    .from("memberships")
    .select("id, payment_id")
    .eq("id", id)
    .maybeSingle();

  if (fe) {
    return apiError(fe.message, 500);
  }
  if (!row) {
    return apiError("Membership not found.", 404);
  }

  const paymentId = row.payment_id as string | null;

  const { error: clearPay } = await admin.from("memberships").update({ payment_id: null }).eq("id", id);
  if (clearPay) {
    return apiError(clearPay.message, 400);
  }

  const { error: delByMembership } = await admin.from("payments").delete().eq("membership_id", id);
  if (delByMembership) {
    return apiError(delByMembership.message, 400);
  }

  if (paymentId) {
    const { error: delPay } = await admin.from("payments").delete().eq("id", paymentId);
    if (delPay) {
      return apiError(delPay.message, 400);
    }
  }

  const { error: delMem } = await admin.from("memberships").delete().eq("id", id);
  if (delMem) {
    return apiError(delMem.message, 400);
  }

  return apiSuccess("Membership and related payment rows deleted.");
}
