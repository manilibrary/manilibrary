import type { MembershipPlanKind } from "@/lib/payments/pricing";

/** Server + client use the same string so Razorpay resume matches the pay step. */
export function buildCheckoutFingerprint(args: {
  planKind: MembershipPlanKind;
  seatNumber: number | null;
  membershipStartDate: string;
  durationKey: string;
}): string {
  return `${args.planKind}:${args.seatNumber ?? "null"}:${args.membershipStartDate}:${args.durationKey}`;
}

export type ResumableCheckoutPayload = {
  paymentId: string;
  orderId: string;
  /** Razorpay amount in paise (same as create-order response). */
  amount: number;
  currency: string;
  keyId: string;
  fingerprint: string;
  planKind: MembershipPlanKind;
  seatNumber: number;
  membershipStartDate: string;
  durationKey: string;
  amountRupees: number;
  seatLabel: string;
};

export async function fetchResumableCheckout(planKind?: MembershipPlanKind): Promise<ResumableCheckoutPayload | null> {
  const q = planKind ? `?planKind=${encodeURIComponent(planKind)}` : "";
  const res = await fetch(`/api/payments/razorpay/resumable-checkout${q}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const j = (await res.json()) as { ok?: boolean; resume?: ResumableCheckoutPayload | null };
  if (!res.ok || !j.ok || !j.resume) return null;
  return j.resume;
}
