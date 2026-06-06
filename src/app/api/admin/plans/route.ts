import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  LIBRARY_PLANS_ADMIN_SELECT,
  PLAN_PRICE_FIELDS,
  type LibraryPlanRow,
  type PlanPriceField,
  rowToLibraryPlan,
  validatePlanPricing,
} from "@/lib/plans/library-plans";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type AdminPlanRow = LibraryPlanRow & { is_active: boolean };

function toAdminPlan(row: AdminPlanRow) {
  return { ...rowToLibraryPlan(row), isActive: row.is_active === true };
}

export async function GET(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data, error } = await admin
    .from("library_plans")
    .select(LIBRARY_PLANS_ADMIN_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return apiErrorSafe(error, 500);

  const plans = (data ?? []).map((r) => toAdminPlan(r as AdminPlanRow));
  return apiSuccess("OK.", { plans });
}

export async function PATCH(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) return apiError(gate.message, gate.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return apiError("Plan id is required.", 400);

  const patch: Record<string, number | boolean> = {};
  const priceFields: Partial<Record<PlanPriceField, number>> = {};

  for (const field of PLAN_PRICE_FIELDS) {
    const raw = body[field];
    if (raw === undefined) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return apiError(`${field} must be a non-negative whole number.`, 400);
    }
    patch[field] = n;
    priceFields[field] = n;
  }

  if (typeof body.is_active === "boolean") {
    patch.is_active = body.is_active;
  }

  if (Object.keys(patch).length === 0) {
    return apiError("Nothing to update.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  // Merge with current values so MRP >= price holds even on partial edits.
  const { data: current, error: curErr } = await admin
    .from("library_plans")
    .select(LIBRARY_PLANS_ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (curErr) return apiErrorSafe(curErr, 500);
  if (!current) return apiError("Plan not found.", 404);

  const merged: Partial<Record<PlanPriceField, number>> = {};
  for (const field of PLAN_PRICE_FIELDS) {
    merged[field] = priceFields[field] ?? ((current as AdminPlanRow)[field] as number);
  }
  const invalid = validatePlanPricing(merged);
  if (invalid) return apiError(invalid, 400);

  const { error: updErr } = await admin
    .from("library_plans")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updErr) return apiErrorSafe(updErr, 400);

  const { data: updated } = await admin
    .from("library_plans")
    .select(LIBRARY_PLANS_ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle();

  return apiSuccess("Plan updated.", {
    plan: updated ? toAdminPlan(updated as AdminPlanRow) : null,
  });
}
