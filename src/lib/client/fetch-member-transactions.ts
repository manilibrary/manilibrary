export type MemberTxMembership = {
  id: string;
  planKind: string;
  planTitle: string;
  status: string;
  seatLabel: string;
  windowLabel: string;
};

export type MemberTxRow = {
  id: string;
  amountRupees: number;
  currency: string;
  status: string;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  membership: MemberTxMembership | null;
};

export async function fetchMemberTransactions(): Promise<MemberTxRow[]> {
  const res = await fetch("/api/payments/me", { cache: "no-store", credentials: "same-origin" });
  const j = (await res.json()) as { ok?: boolean; error?: string; transactions?: MemberTxRow[] };
  if (!res.ok || !j.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Could not load transactions.");
  }
  return Array.isArray(j.transactions) ? j.transactions : [];
}
