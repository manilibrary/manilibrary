import { apiError, apiErrorSafe, apiSuccess } from "@/lib/api/json-response";
import { isManualPaymentMethod, manualEnrollMember } from "@/lib/admin/manual-member-enroll";
import { formatPersonName } from "@/lib/format-person-name";
import { validateStaffNewMemberAccountFields } from "@/lib/security/validate-fields";
import type { MembershipPlanKind } from "@/lib/payments/pricing";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

function isPlanKind(v: unknown): v is MembershipPlanKind {
  return v === "short_term" || v === "long_term";
}

export async function POST(request: Request) {
  const gate = await requireLibraryAdmin(request);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const existing_user_id =
    typeof raw.existing_user_id === "string" && raw.existing_user_id.trim() ? raw.existing_user_id.trim() : undefined;
  const full_name = typeof raw.full_name === "string" ? raw.full_name : "";
  const email = typeof raw.email === "string" ? raw.email : "";
  const phone = typeof raw.phone === "string" ? raw.phone : undefined;
  const password = typeof raw.password === "string" ? raw.password : undefined;

  if (!isPlanKind(raw.plan_kind)) {
    return apiError("plan_kind must be long_term or short_term.", 400);
  }
  const plan_kind = raw.plan_kind;

  const seat_number = typeof raw.seat_number === "number" ? raw.seat_number : Number(raw.seat_number);
  const membership_start_date =
    typeof raw.membership_start_date === "string" ? raw.membership_start_date.trim() : "";
  const duration_key = typeof raw.duration_key === "string" ? raw.duration_key.trim() : "";

  const amount_rupees = typeof raw.amount_rupees === "number" ? raw.amount_rupees : Number(raw.amount_rupees);
  const payment_method_raw = typeof raw.payment_method === "string" ? raw.payment_method.trim() : "";
  if (!isManualPaymentMethod(payment_method_raw)) {
    return apiError(
      "payment_method must be one of: cash, upi_external, bank_transfer, card_terminal, other.",
      400,
    );
  }
  const payment_method = payment_method_raw;

  const external_reference = typeof raw.external_reference === "string" ? raw.external_reference : undefined;
  const staff_note = typeof raw.staff_note === "string" ? raw.staff_note : undefined;
  const mark_kyc_verified = raw.mark_kyc_verified === true;

  if (!existing_user_id) {
    const acc = validateStaffNewMemberAccountFields({
      name: full_name,
      email,
      phone: phone ?? "",
      password: password ?? "",
    });
    if (!acc.ok) {
      return apiError(acc.error, 400);
    }
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server configuration error.");
  }

  const result = await manualEnrollMember(admin, {
    existing_user_id,
    full_name: formatPersonName(full_name),
    email: email.trim(),
    phone: phone?.trim(),
    password,
    plan_kind,
    seat_number,
    membership_start_date,
    duration_key,
    amount_rupees,
    payment_method,
    external_reference,
    staff_note,
    mark_kyc_verified,
    recorded_by_user_id: gate.userId,
  });

  if (!result.ok) {
    return apiError(result.message, result.status);
  }

  return apiSuccess("Member enrolled with active membership and manual payment recorded.", {
    user_id: result.user_id,
    device_user_id: result.device_user_id,
    membership_id: result.membership_id,
    payment_id: result.payment_id,
    ...(result.temporary_password ? { temporary_password: result.temporary_password } : {}),
  });
}
