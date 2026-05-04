type Tone = "azure" | "ok" | "warn" | "danger" | "neutral";

const TONES: Record<Tone, string> = {
  azure: "bg-azure-50 text-azure-700 ring-azure-200",
  ok: "bg-ink-50 text-ink-800 ring-ink-200",
  warn: "bg-azure-50 text-azure-700 ring-azure-200",
  danger: "bg-ink-100 text-ink-900 ring-ink-300",
  neutral: "bg-ink-50 text-ink-700 ring-ink-200",
};

export default function StatusBadge({
  children,
  tone = "neutral",
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone]}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            tone === "azure" || tone === "warn"
              ? "bg-azure-500"
              : tone === "ok"
              ? "bg-ink-700"
              : tone === "danger"
              ? "bg-ink-900"
              : "bg-ink-400"
          }`}
        />
      )}
      {children}
    </span>
  );
}
