export type AdminPaymentRow = {
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

export type AdminPaymentProfileMini = {
  user_id: string;
  full_name: string;
  device_user_id: number;
};

export type AdminPaymentsListCache = {
  rows: AdminPaymentRow[];
  profiles: Record<string, AdminPaymentProfileMini>;
};

export async function fetchAdminPaymentsList(): Promise<AdminPaymentsListCache> {
  const res = await fetch("/api/admin/payments/list", { cache: "no-store" });
  const j = (await res.json()) as {
    ok?: boolean;
    error?: string;
    rows?: AdminPaymentRow[];
    profiles?: Record<string, AdminPaymentProfileMini>;
  };
  if (!res.ok || !j.ok) {
    throw new Error(j.error ?? "Could not load payments.");
  }
  return {
    rows: j.rows ?? [],
    profiles: j.profiles ?? {},
  };
}
