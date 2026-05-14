/**
 * Plain-language seat-map primer. Colours align with `MembershipLegend` swatches
 * (Free, Yours, Taken, Blocked) for both halls.
 */
export default function MembershipSeatMapIntro(props: { mode: "long" | "short" }) {
  void props.mode;
  const occupiedLine = (
    <>
      <strong className="font-semibold text-ink-800">Amber</strong> seats are already booked for your selected dates
      (or in use now if you have not set a window yet).
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
        <li>Available: white fill, azure outline — matches &quot;Free&quot; in the legend.</li>
        <li>
          Taken: amber border and chair — matches &quot;Taken&quot; in the legend (synced with overlapping bookings).
        </li>
        <li>
          Blocked: red × on the tile, not selectable — matches the &quot;Blocked&quot; legend swatch (red × on a light
          red field).
        </li>
      </ul>
    </div>
  );
}
