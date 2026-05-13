import { apiError, apiSuccess } from "@/lib/api/json-response";
import { formatPaymentAdminDetail } from "@/lib/payments/payment-admin-detail";
import { requireLibraryAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

function razorpayOrderAndPaymentId(row: {
  provider_payment_id: string | null;
  metadata: unknown;
}): { razorpay_order_id: string | null; razorpay_payment_id: string | null } {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const orderMeta = typeof meta.razorpay_order_id === "string" ? meta.razorpay_order_id.trim() : null;
  const paymentMeta = typeof meta.razorpay_payment_id === "string" ? meta.razorpay_payment_id.trim() : null;
  const prov = row.provider_payment_id?.trim() ?? null;
  const orderFromProv = prov?.startsWith("order_") ? prov : null;
  const paymentFromProv = prov?.startsWith("pay_") ? prov : null;
  return {
    razorpay_order_id: orderMeta ?? orderFromProv,
    razorpay_payment_id: paymentMeta ?? paymentFromProv,
  };
}

type PaymentRow = {
  id: string;
  user_id: string;
  amount_rupees: number;
  currency: string;
  provider: string | null;
  status: string;
  provider_payment_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  detail: string | null;
};

type ProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
};

export async function GET() {
  const gate = await requireLibraryAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const admin = createSupabaseServiceRoleClient();

  const { data: pays, error: pe } = await admin
    .from("payments")
    .select("id, user_id, amount_rupees, currency, provider, status, provider_payment_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  if (pe) {
    return apiError(pe.message, 500);
  }

  const rows: PaymentRow[] = (pays ?? []).map((raw) => {
    const r = raw as {
      id: string;
      user_id: string;
      amount_rupees: number;
      currency: string;
      provider: string | null;
      status: string;
      provider_payment_id: string | null;
      metadata: unknown;
      created_at: string;
    };
    const rz = razorpayOrderAndPaymentId(r);
    return {
      id: r.id,
      user_id: r.user_id,
      amount_rupees: r.amount_rupees,
      currency: r.currency,
      provider: r.provider,
      status: r.status,
      provider_payment_id: r.provider_payment_id,
      razorpay_order_id: rz.razorpay_order_id,
      razorpay_payment_id: rz.razorpay_payment_id,
      created_at: r.created_at,
      detail: formatPaymentAdminDetail(r.status, r.metadata),
    };
  });

  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const profiles: Record<string, ProfileMini> = {};
  if (ids.length > 0) {
    const { data: profs, error: prErr } = await admin
      .from("profiles")
      .select("user_id, full_name, device_user_id")
      .in("user_id", ids);
    if (prErr) {
      return apiError(prErr.message, 500);
    }
    for (const p of (profs ?? []) as ProfileMini[]) {
      profiles[p.user_id] = p;
    }
  }

  return apiSuccess(`Loaded ${rows.length} recent payment row(s) with member labels.`, { rows, profiles });
}
