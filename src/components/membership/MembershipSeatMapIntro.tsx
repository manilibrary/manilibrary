/**
 * Plain-language seat-map primer. Colours align with `MembershipLegend` swatches
 * (available, occupied, blocked) for the given plan mode.
 */
export default function MembershipSeatMapIntro({
  mode,
}: {
  mode: "long" | "short";
}) {
  const occupiedLine =
    mode === "long" ? (
      <>
        <strong className="font-semibold text-ink-800">Amber</strong> seats are taken by long-term members;{" "}
        <strong className="font-semibold text-ink-800">violet</strong> is a member&apos;s home desk while they&apos;re
        away.
      </>
    ) : (
      <>
        <strong className="font-semibold text-ink-800">Sky-blue</strong> seats are in use on a short-term or day
        pass.
      </>
    );

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 text-sm leading-relaxed text-ink-600 shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">How to read this map</p>
      <p className="mt-2">
        <strong className="font-semibold text-ink-800">White</strong> desks with a{" "}
        <strong className="font-semibold text-ink-800">light blue border</strong> are empty and available for this
        plan. {occupiedLine}{" "}
        Desks marked with a <strong className="font-semibold text-ink-800">×</strong> are blocked—not serviceable or
        not sold (see <strong className="font-semibold text-ink-800">Blocked</strong> in the legend; the map uses the
        × treatment for those spots).
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-600">
        <li>Available: white fill, azure outline — matches &quot;Available&quot; in the legend.</li>
        <li>
          {mode === "long"
            ? "Taken: amber (long-term member) or violet (home desk) — matches those legend rows."
            : "Taken: sky fill (short-term / day) — matches &quot;Short-term / day&quot; in the legend."}
        </li>
        <li>Blocked: × on the tile, not selectable — same category as &quot;Blocked&quot; (grey swatch in the legend).</li>
      </ul>
    </div>
  );
}
