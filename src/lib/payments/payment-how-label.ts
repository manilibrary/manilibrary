import type Razorpay from "razorpay";

const MANUAL_LABELS: Record<string, string> = {
  cash: "Cash (offline)",
  upi_external: "UPI (offline)",
  bank_transfer: "Bank transfer",
  card_terminal: "Card (terminal)",
  other: "Other",
};

type RazorpayPaymentRemote = {
  method?: string;
  vpa?: string;
  bank?: string;
  wallet?: string;
  card?: { network?: string; type?: string };
};

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function formatRazorpayMethodKey(method: string): string {
  const k = method.trim().toLowerCase();
  if (k === "card") return "Card";
  if (k === "upi") return "UPI";
  if (k === "netbanking") return "Netbanking";
  if (k === "wallet") return "Wallet";
  if (k === "emi") return "EMI";
  if (k === "paylater") return "Pay later";
  if (k === "cardless_emi") return "Cardless EMI";
  return titleCase(k.replace(/_/g, " "));
}

export function formatPaymentHowFromRazorpayRemote(remote: RazorpayPaymentRemote): string {
  const method = remote.method?.trim().toLowerCase();
  if (!method) return "Razorpay online";

  if (method === "card") {
    const network = remote.card?.network?.trim();
    const type = remote.card?.type?.trim();
    if (network && type) return `${titleCase(type)} card · ${network}`;
    if (network) return `Card · ${network}`;
    return "Card";
  }
  if (method === "upi") {
    const vpa = remote.vpa?.trim();
    return vpa ? `UPI · ${vpa}` : "UPI";
  }
  if (method === "netbanking" && remote.bank?.trim()) {
    return `Netbanking · ${remote.bank.trim()}`;
  }
  if (method === "wallet" && remote.wallet?.trim()) {
    return `Wallet · ${remote.wallet.trim()}`;
  }
  return `${formatRazorpayMethodKey(method)} (Razorpay)`;
}

/** Staff-facing “how they paid” from stored row fields. */
export function formatPaymentHowLabel(
  provider: string | null | undefined,
  metadata: unknown,
  status?: string,
): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const manual = m.manual_payment_method;
  if (typeof manual === "string" && manual.trim()) {
    return MANUAL_LABELS[manual] ?? manual.replace(/_/g, " ");
  }

  const stored =
    (typeof m.razorpay_method === "string" && m.razorpay_method.trim()) ||
    (typeof m.payment_method === "string" && m.payment_method.trim()) ||
    (typeof m.method === "string" && m.method.trim()) ||
    "";
  if (stored) return formatRazorpayMethodKey(stored);

  if (provider === "manual") return "Offline";
  if (provider === "razorpay") {
    if (status?.toLowerCase() === "pending") return "Razorpay checkout";
    return "Razorpay online";
  }
  if (provider?.trim()) return provider.replace(/_/g, " ");
  return "—";
}

export async function resolvePaymentHowLabel(
  row: {
    provider: string | null;
    metadata: unknown;
    provider_payment_id: string | null;
    status: string;
  },
  rz: Razorpay | null,
): Promise<string> {
  const base = formatPaymentHowLabel(row.provider, row.metadata, row.status);
  if (row.provider !== "razorpay" || !rz || base !== "Razorpay online") return base;

  const m = (row.metadata ?? {}) as Record<string, unknown>;
  const payId =
    (typeof m.razorpay_payment_id === "string" ? m.razorpay_payment_id.trim() : "") ||
    (row.provider_payment_id?.startsWith("pay_") ? row.provider_payment_id.trim() : "");
  if (!payId.startsWith("pay_") || row.status.toLowerCase() !== "paid") return base;

  try {
    const remote = (await rz.payments.fetch(payId)) as RazorpayPaymentRemote;
    return formatPaymentHowFromRazorpayRemote(remote);
  } catch {
    return base;
  }
}
