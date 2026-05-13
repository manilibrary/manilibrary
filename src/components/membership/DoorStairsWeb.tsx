"use client";

const INK = "#111827";
const LINE = "rgba(17, 24, 39, 0.72)";

function LongArrowUp({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] shrink-0" style={{ color }} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 19V5m0 0l-6 6m6-6l6 6"
      />
    </svg>
  );
}

/** Bold entry arrow — top-left corner of hall, points up toward Row 1. */
function HallEntryArrowUp({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-11 w-11 shrink-0 drop-shadow-sm"
      style={{ color }}
      aria-hidden
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21V4M12 4l-6.5 6.5M12 4l6.5 6.5"
      />
    </svg>
  );
}

function LongArrowRight({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" style={{ color }} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12h14m0 0l-6-6m6 6l-6 6"
      />
    </svg>
  );
}

function LongArrowLeft({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" style={{ color }} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 12H5m0 0l6-6m-6 6l6 6"
      />
    </svg>
  );
}

/** Same layout as annotated sketch: 4 verticals × 3 horizontals (top →, middle, bottom ←), Door BR. */
function RowsHallSketchInner({ inkMuted }: { inkMuted: string }) {
  const verticals = 4;
  const rail = "rounded-sm bg-ink-900/[0.88]";

  return (
    <div className="relative z-[1] flex h-full min-h-0 w-full flex-col">
      <div className="flex w-full shrink-0 flex-row items-start justify-start border-b border-ink-900/[0.08] pl-2.5 pr-2 pb-2 pt-1.5">
        <HallEntryArrowUp color={inkMuted} />
      </div>

      <div
        className="relative mx-2 mb-11 mt-2 min-h-[118px] flex-1 rounded-xl border border-ink-900/10 bg-slate-50/70 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
        role="img"
        aria-label="Stairs: entry at upper left, landings and flow toward door"
      >
        {Array.from({ length: verticals }).map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute z-0 w-px bg-ink-900/38 sm:w-[2px] sm:bg-ink-900/40"
            style={{
              left: `${11 + (i * 78) / (verticals - 1)}%`,
              transform: "translateX(-50%)",
              top: "18%",
              bottom: "22%",
            }}
            aria-hidden
          />
        ))}

        <div className="absolute inset-x-2 top-[26%] z-[1] flex h-5 items-center justify-end gap-2">
          <div className={`h-[2.5px] min-w-[45%] flex-1 ${rail}`} />
          <LongArrowRight color={INK} />
        </div>

        <div
          className={`absolute left-[10%] right-[10%] top-1/2 z-[1] h-[2.5px] -translate-y-1/2 ${rail}`}
          aria-hidden
        />

        <div className="absolute inset-x-2 bottom-[24%] z-[1] flex h-5 items-center justify-start gap-2">
          <LongArrowLeft color={INK} />
          <div className={`h-[2.5px] min-w-[45%] flex-1 ${rail}`} />
        </div>

        <div
          className="pointer-events-none absolute bottom-2 right-2 z-[2] flex items-center gap-1.5 rounded-md border border-ink-900/20 bg-white/95 px-2 py-1 shadow-sm ring-1 ring-black/[0.04]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 shrink-0 opacity-90"
            style={{ color: LINE }}
            fill="currentColor"
            aria-hidden
          >
            <path d="M19 19V5H5v14h14zm-2-2H7V7h10v10zM11 9h2v6h-2V9z" />
          </svg>
          <span className="font-mono text-[9px] font-extrabold uppercase tracking-wide" style={{ color: LINE }}>
            Door
          </span>
        </div>
      </div>
    </div>
  );
}

function RowsShortTermInner({
  inkMuted,
  diagramFluid,
}: {
  inkMuted: string;
  diagramFluid?: boolean;
}) {
  return (
    <>
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-2.5 rounded-bl-2xl rounded-tl-2xl"
        style={{ backgroundColor: "rgba(17, 24, 39, 0.32)" }}
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-row items-stretch">
        <div className="mr-[10px] flex w-12 shrink-0 flex-col items-center self-start">
          <div className="flex min-h-7 w-full flex-row items-center justify-center gap-1.5 border-b border-ink-900/30 pb-1">
            <span className="text-[11px] font-bold" style={{ color: LINE }}>
              Door
            </span>
            <LongArrowUp color={inkMuted} />
          </div>
          <div
            className="mt-1.5 flex h-[90px] w-[34px] shrink-0 flex-col justify-end overflow-hidden rounded-lg border-2 bg-white/[0.98]"
            style={{ borderColor: LINE }}
          >
            <div
              className="m-1 min-h-0 flex-1 rounded border bg-slate-50/95"
              style={{ borderColor: "rgba(17, 24, 39, 0.12)" }}
            />
          </div>
        </div>
        <div
          className={
            diagramFluid
              ? "flex min-h-0 min-w-0 flex-1 flex-col items-center gap-1 self-stretch"
              : "flex min-h-0 min-w-[246px] flex-1 flex-col items-center gap-1 self-stretch"
          }
        >
          <span className="text-base font-black tracking-wide" style={{ color: LINE }}>
            Stairs
          </span>
          <div className="relative min-h-[98px] w-full flex-1 self-stretch">
            <div
              className={
                diagramFluid
                  ? "absolute left-3 right-2 top-[45%] h-1.5 rounded-md"
                  : "absolute right-2 top-[45%] h-1.5 w-[200px] max-w-[calc(100%-1rem)] rounded-md"
              }
              style={{ backgroundColor: INK, opacity: 0.85 }}
              aria-hidden
            />
            <div
              className={
                diagramFluid
                  ? "absolute bottom-0 left-3 right-2 top-0"
                  : "absolute bottom-0 right-2 top-0 w-[168px] max-w-full"
              }
            >
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute bottom-0 top-0 w-0.5"
                  style={{
                    left: diagramFluid ? `${(i / 10) * 100}%` : `${i * 14}px`,
                    backgroundColor: "rgba(17, 24, 39, 0.28)",
                  }}
                />
              ))}
            </div>
            <div className="absolute left-3 right-3.5 top-0 flex h-[18px] items-center justify-end gap-2.5">
              <div
                className="h-[3px] min-w-[120px] max-w-[172px] flex-1 rounded-[3px]"
                style={{ backgroundColor: INK, opacity: 0.85 }}
              />
              <LongArrowRight color={INK} />
            </div>
            <div className="absolute bottom-0 left-3 right-3.5 flex h-[18px] items-center justify-start gap-2.5">
              <LongArrowLeft color={INK} />
              <div
                className="h-[3px] min-w-[120px] max-w-[172px] flex-1 rounded-[3px]"
                style={{ backgroundColor: INK, opacity: 0.85 }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Door + stairs schematic (student-app `DoorAndStairs` / `doorStairs`).
 * - Long-term: `stretch` fills the stairs slot between jambs.
 * - `rowsShortTerm`: compact card matching `LibrarySeatMapRows` (min 352×168, bottom-right).
 * - `rowsShortTermBandFill`: large hall sketch — up-arrow entry (center), stairs grid, Door bottom-right.
 */
export default function DoorStairsWeb({
  inkMuted,
  stretch = true,
  rowsShortTerm = false,
  rowsShortTermBandFill = false,
}: {
  inkMuted: string;
  stretch?: boolean;
  rowsShortTerm?: boolean;
  rowsShortTermBandFill?: boolean;
}) {
  if (rowsShortTermBandFill) {
    return (
      <div
        className="pointer-events-none relative flex h-full min-h-[180px] w-full min-w-0 flex-col overflow-hidden rounded-l-2xl rounded-r-none border-y-2 border-l-2 border-ink-900/20 border-r-0 bg-gradient-to-b from-white to-slate-50/95 py-1 pl-1.5 pr-0 shadow-md ring-1 ring-black/[0.04]"
        style={{
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      >
        <RowsHallSketchInner inkMuted={inkMuted} />
      </div>
    );
  }

  if (rowsShortTerm) {
    return (
      <div
        className="pointer-events-none relative flex min-h-[168px] min-w-[352px] max-w-full flex-col self-end rounded-2xl border bg-white/[0.92] px-3 pb-2 pt-1.5 shadow-sm"
        style={{
          borderColor: "rgba(17, 24, 39, 0.18)",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
        }}
      >
        <RowsShortTermInner inkMuted={inkMuted} />
      </div>
    );
  }

  return (
    <div
      className={
        stretch
          ? "pointer-events-none relative flex min-h-[120px] min-w-[200px] flex-1 flex-col rounded-2xl border border-ink-900/12 bg-white/95 px-3 pb-2 pt-1.5 shadow-sm sm:min-w-[280px]"
          : "pointer-events-none relative flex min-h-[120px] min-w-[200px] max-w-[360px] flex-col rounded-2xl border border-ink-900/12 bg-white/95 px-3 pb-2 pt-1.5 shadow-sm"
      }
      style={{ boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)" }}
    >
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-2.5 rounded-bl-2xl rounded-tl-2xl bg-slate-700/20" />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-row items-stretch pl-2.5">
        <div className="mr-2.5 flex w-12 shrink-0 flex-col items-center self-start">
          <div className="flex w-full flex-row items-center justify-center gap-1 rounded-lg border-b border-ink-900/15 bg-slate-50/95 py-1">
            <span className="font-mono text-[8px] font-bold text-ink-900">Door</span>
            <svg viewBox="0 0 24 24" className="h-3 w-3" style={{ color: inkMuted }} aria-hidden>
              <path fill="currentColor" d="M12 4l8 6v10H4V10l8-6zm0 2.2L6 10.8V18h12v-7.2L12 6.2zM11 11h2v5h-2v-5z" />
            </svg>
          </div>
          <div className="mt-1 h-14 w-8 rounded-lg border border-ink-900/35 bg-white shadow-inner" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-sm font-black tracking-wide text-ink-900">Stairs</span>
          <div className="relative mt-0.5 h-[72px] w-full max-w-[220px]">
            <div
              className="absolute right-2 top-[42%] h-1.5 w-[85%] rounded-sm bg-ink-900/75"
              aria-hidden
            />
            <div className="absolute bottom-0 right-2 top-0 w-[70%]">
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute bottom-0 top-0 w-0.5 bg-ink-900/20"
                  style={{ left: `${8 + i * 14}px` }}
                />
              ))}
            </div>
            <div className="absolute right-1 top-2 flex items-center gap-0.5">
              <div className="h-0.5 w-6 bg-ink-900/60" />
              <span className="text-ink-900">→</span>
            </div>
            <div className="absolute bottom-2 right-1 flex items-center gap-0.5">
              <span className="text-ink-900">←</span>
              <div className="h-0.5 w-6 bg-ink-900/60" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
