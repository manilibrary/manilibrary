import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import { toYmdBoundary } from "@/lib/membership/windows";
import { getAuthUserForApiRequest } from "@/lib/supabase/api-route-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type MembershipJoin = {
  id: string;
  plan_kind: string;
  status: string | null;
  seat_number: string | number | null;
  valid_from: string | null;
  valid_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
};

type PaymentRow = {
  id: string;
  amount_rupees: number;
  currency: string | null;
  status: string;
  provider_payment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  membership_id: string | null;
  memberships: MembershipJoin | MembershipJoin[] | null;
};

function asMembership(m: MembershipJoin | MembershipJoin[] | null): MembershipJoin | null {
  if (m == null) return null;
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

function membershipWindowLabel(mem: MembershipJoin): string {
  if (mem.plan_kind === "long_term") {
    const a = toYmdBoundary(mem.valid_from);
    const b = toYmdBoundary(mem.valid_until);
    if (a && b) return `${a} → ${b}`;
  }
  if (mem.plan_kind === "short_term") {
    const a = toYmdBoundary(mem.starts_at);
    const b = toYmdBoundary(mem.ends_at);
    if (a && b) return `${a} → ${b}`;
  }
  return "—";
}

function planTitle(planKind: string): string {
  if (planKind === "short_term") return "Short-term (row hall)";
  if (planKind === "long_term") return "Long-term (main hall)";
  return planKind.replace(/_/g, " ");
}

export async function GET(request: Request) {
  const {
    data: { user },
  } = await getAuthUserForApiRequest(request);
  if (!user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not load payments.");
  }

  const { data: rows, error } = await admin
    .from("payments")
    .select(
      `
      id,
      amount_rupees,
      currency,
      status,
      provider_payment_id,
      metadata,
      created_at,
      updated_at,
      membership_id,
      memberships!payments_membership_id_fkey (
        id,
        plan_kind,
        status,
        seat_number,
        valid_from,
        valid_until,
        starts_at,
        ends_at,
        notes
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("provider", "razorpay")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    return apiErrorSafe(error, 500);
  }

  const list = (rows ?? []) as PaymentRow[];

  const transactions = list.map((pay) => {
    const meta = (pay.metadata ?? {}) as Record<string, unknown>;
    const orderFromMeta = typeof meta.razorpay_order_id === "string" ? meta.razorpay_order_id.trim() : "";
    const paymentFromMeta = typeof meta.razorpay_payment_id === "string" ? meta.razorpay_payment_id.trim() : "";
    const prov = pay.provider_payment_id?.trim() ?? "";
    const razorpayPaymentId =
      paymentFromMeta ||
      (prov.startsWith("pay_") ? prov : "") ||
      null;
    const razorpayOrderId =
      orderFromMeta ||
      (prov.startsWith("order_") ? prov : "") ||
      null;

    const mem = asMembership(pay.memberships);
    const membership = mem
      ? {
          id: mem.id,
          planKind: mem.plan_kind,
          planTitle: planTitle(mem.plan_kind),
          status: mem.status ?? "unknown",
          seatLabel: resolveMemberSeatDisplayLabel({
            plan_kind: mem.plan_kind,
            seat_number: mem.seat_number,
          }),
          windowLabel: membershipWindowLabel(mem),
        }
      : null;

    return {
      id: pay.id,
      amountRupees: Number(pay.amount_rupees),
      currency: (pay.currency && String(pay.currency).trim()) || "INR",
      status: pay.status,
      razorpayPaymentId,
      razorpayOrderId,
      createdAt: pay.created_at,
      updatedAt: pay.updated_at,
      membership,
    };
  });

  return apiSuccess("Your Razorpay-linked payments.", { transactions });
}
