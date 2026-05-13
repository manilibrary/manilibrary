const items: { key: string; label: string; hint: string; className: string }[] = [
  {
    key: "avail",
    label: "Available",
    hint: "You can choose this seat.",
    className: "border border-[#7DD3FC] bg-white",
  },
  {
    key: "sel",
    label: "Your pick",
    hint: "Seat you have selected for checkout.",
    className: "border-2 border-[#15803D] bg-[#16A34A]",
  },
  {
    key: "occ",
    label: "Taken",
    hint: "Already booked for the dates you are choosing (or in use right now if you have not set a window yet).",
    className: "border border-amber-300 bg-amber-50",
  },
  {
    key: "blk",
    label: "Blocked",
    hint: "Not sold or not a desk — red × on the map.",
    className: "border border-dashed border-red-400/80 bg-red-50/90",
  },
];

function LegendSwatch({
  itemKey,
  className,
  size,
}: {
  itemKey: string;
  className: string;
  size: "strip" | "grid";
}) {
  const box =
    size === "strip" ? "h-4 w-4 shrink-0 rounded sm:h-5 sm:w-5" : "mt-0.5 h-8 w-8 shrink-0 rounded-lg";
  if (itemKey === "blk") {
    return (
      <span
        className={`flex ${box} items-center justify-center border border-dashed border-red-400/80 bg-red-50/90`}
        aria-hidden
      >
        <span
          className={`font-bold leading-none text-red-600 ${size === "strip" ? "text-[10px] sm:text-xs" : "text-sm"}`}
        >
          ×
        </span>
      </span>
    );
  }
  return <span className={`${box} ${className}`} aria-hidden />;
}

export default function MembershipLegend({
  mode,
  layout = "grid",
}: {
  mode: "long" | "short";
  layout?: "grid" | "strip";
}) {
  const filtered = items;

  const stripShort: Record<string, string> = {
    avail: "Free",
    sel: "Yours",
    occ: "Taken",
    blk: "Blocked",
  };

  if (layout === "strip") {
    return (
      <ul
        className="flex flex-wrap gap-1.5 sm:flex-nowrap sm:gap-2 sm:overflow-x-auto sm:pb-1 sm:pt-0.5 sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"
        aria-label={mode === "long" ? "Main hall seat colours" : "Row hall seat colours"}
      >
        {filtered.map((i) => (
          <li
            key={i.key}
            title={`${i.label} — ${i.hint}`}
            className="flex min-w-0 max-w-[calc(50%-0.375rem)] shrink-0 items-center gap-1.5 rounded-lg border border-ink-100 bg-white px-2 py-1.5 text-[11px] shadow-sm sm:max-w-none sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-xs"
          >
            <LegendSwatch itemKey={i.key} className={i.className} size="strip" />
            <span className="min-w-0 truncate font-medium text-ink-900">{stripShort[i.key] ?? i.label}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={mode === "long" ? "Main hall seat colours" : "Row hall seat colours"}>
      {filtered.map((i) => (
        <li
          key={i.key}
          className="flex gap-3 rounded-xl border border-ink-100 bg-white p-3 text-sm shadow-sm"
        >
          <LegendSwatch itemKey={i.key} className={i.className} size="grid" />
          <span>
            <span className="font-semibold text-ink-900">{i.label}</span>
            <span className="mt-0.5 block text-xs text-ink-500">{i.hint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
