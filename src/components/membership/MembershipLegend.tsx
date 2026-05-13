const items: { key: string; label: string; hint: string; className: string }[] = [
  {
    key: "avail",
    label: "Available",
    hint: "You can choose this seat.",
    className: "border border-azure-200 bg-white",
  },
  {
    key: "sel",
    label: "Your pick",
    hint: "Selected for this session (design preview).",
    className: "border border-azure-600 bg-azure-500",
  },
  {
    key: "long",
    label: "Long-term member",
    hint: "Monthly / longer plan — taken.",
    className: "border border-amber-300 bg-amber-50",
  },
  {
    key: "short",
    label: "Short-term / day",
    hint: "Day or week pass currently in use.",
    className: "border border-sky-300 bg-sky-50",
  },
  {
    key: "home",
    label: "Home desk",
    hint: "Long member’s reserved seat while away.",
    className: "border border-violet-400 bg-violet-50",
  },
  {
    key: "blk",
    label: "Blocked",
    hint: "Not sold or not a desk.",
    className: "border border-ink-200 bg-ink-100",
  },
];

export default function MembershipLegend({
  mode,
}: {
  mode: "long" | "short";
}) {
  const filtered =
    mode === "long"
      ? items.filter((i) => i.key !== "short")
      : items.filter((i) => i.key !== "long" && i.key !== "home");

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((i) => (
        <li
          key={i.key}
          className="flex gap-3 rounded-xl border border-ink-100 bg-white p-3 text-sm shadow-sm"
        >
          <span
            className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg ${i.className}`}
            aria-hidden
          />
          <span>
            <span className="font-semibold text-ink-900">{i.label}</span>
            <span className="mt-0.5 block text-xs text-ink-500">{i.hint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
