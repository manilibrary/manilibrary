/** Scope guard — refuse general-purpose / off-topic chat before calling the model. */

const LIBRARY_TOPIC_RE =
  /\b(library|mani|membership|member|seat|plan|referral|coupon|credit|shift|morning|evening|night|24.?h|register|sign.?up|login|kyc|verif|payment|razorpay|renew|attendance|hour|facilit|wifi|locker|madhubani|study|price|fee|floor|contact|whatsapp|phone|address|gallery|dashboard)\b/i;

const OFF_TOPIC_REQUEST_RE =
  /\b(write|draft|compose|create|generate)\s+(an?\s+)?(article|essay|story|poem|speech|blog|paragraph|assignment|report)\b/i;

const GENERAL_KNOWLEDGE_RE =
  /\b(weather|forecast|who is|who was|what is the capital|solve this|homework|recipe|joke|movie|cricket|football|politics|election|stock market|crypto|bitcoin)\b/i;

const REFUSAL =
  "I only answer questions about Mani Library — plans, hours, location, membership, referrals, coupons, and your account. For anything else, please contact the library or use a general search engine.";

function lastUserText(messages: { role: string; parts?: { type: string; text?: string }[] }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    return (m.parts ?? [])
      .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("\n")
      .trim();
  }
  return "";
}

export function offTopicRefusalForMessages(
  messages: { role: string; parts?: { type: string; text?: string }[] }[],
): string | null {
  const text = lastUserText(messages);
  if (!text) return null;

  if (OFF_TOPIC_REQUEST_RE.test(text)) return REFUSAL;

  if (GENERAL_KNOWLEDGE_RE.test(text) && !LIBRARY_TOPIC_RE.test(text)) return REFUSAL;

  return null;
}
