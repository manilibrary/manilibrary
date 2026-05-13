"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { LEFT_SEAT_BLOCKS, RIGHT_SEAT_BLOCKS } from "@/data/seatLayoutLongTerm";
import type { SeatBlockSpec } from "@/data/seatLayoutLongTerm";
import {
  LONG_TERM_BLOCKED,
  LONG_TERM_HOME_HELD,
} from "@/lib/membershipSeatMock";
import BenchRowWithMidline from "./BenchRowWithMidline";
import DeskBayWeb from "./DeskBayWeb";
import DoorStairsWeb from "./DoorStairsWeb";
import { EXPO } from "./expoSeatTheme";
import type { SeatVisual } from "./seatVisual";

function visualForSeat(seat: number, selected: number | null, occupiedSeats: Set<number>): SeatVisual {
  if (LONG_TERM_BLOCKED.has(seat)) return "blocked";
  if (LONG_TERM_HOME_HELD.has(seat)) return "occupiedLong";
  if (occupiedSeats.has(seat)) return "occupiedLong";
  if (selected === seat) return "selected";
  return "available";
}

function AcIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 3v18M3 12h18M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

/** Height of the “Window” title row in `WindowStrip` — must match `py-1.5` + icon + label. */
const WINDOW_STRIP_HEADER_PX = 40;

function WindowStrip({
  windowGridHeightPx,
  doorBandTopPx,
  doorBandHeightPx,
}: {
  windowGridHeightPx: number;
  doorBandTopPx: number;
  doorBandHeightPx: number;
}) {
  return (
    <div
      className="relative flex h-full min-h-0 w-7 shrink-0 flex-col border-l border-ink-900/25 bg-[#E2EAF4] shadow-sm"
      aria-hidden
    >
      <div className="flex shrink-0 flex-col items-center border-b border-ink-900/10 bg-white/95 py-1.5">
        <svg viewBox="0 0 24 24" className="h-3 w-3 text-ink-500">
          <path
            fill="currentColor"
            d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"
          />
        </svg>
        <span className="mt-0.5 max-w-[3.25rem] text-center font-mono text-[7px] font-extrabold uppercase leading-tight tracking-wide text-ink-600">
          Window
        </span>
      </div>
      <div
        className="grid shrink-0 grid-cols-2 gap-px bg-ink-900/10 p-px [grid-auto-rows:minmax(10px,1fr)]"
        style={{ height: Math.max(32, windowGridHeightPx) }}
      >
        {Array.from({ length: 48 }).map((_, i) => (
          <div
            key={i}
            className="min-h-0 bg-sky-200/55"
            style={{ opacity: 0.75 + (i % 3) * 0.06 }}
          />
        ))}
      </div>
      <div className="min-h-0 flex-1" />
      <div
        className="pointer-events-none absolute left-0 right-0 z-[5] flex flex-col border-t border-ink-900/15 bg-white/95 shadow-inner"
        style={{
          top: doorBandTopPx,
          height: Math.max(48, doorBandHeightPx),
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-1 text-ink-800">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 rotate-90" aria-hidden>
            <path
              fill="currentColor"
              d="M19 19V5H5v14h14zm-2-2H7V7h10v10zM11 9h2v6h-2V9z"
            />
          </svg>
          <span className="font-mono text-[8px] font-bold uppercase tracking-wide [writing-mode:vertical-rl]">
            Door
          </span>
        </div>
      </div>
    </div>
  );
}

/** One bench island — matches student-app `seatRow` (dual bays, vertical borders only). */
function SingleBenchBlock({
  block,
  selected,
  onSelect,
  occupiedSeats,
}: {
  block: SeatBlockSpec;
  selected: number | null;
  onSelect: (n: number) => void;
  occupiedSeats: Set<number>;
}) {
  const count = Math.min(block.topRow.length, block.bottomRow.length);
  return (
    <div className="inline-flex rounded-xl border-x border-ink-900/20 bg-white/95 px-3 py-2.5 shadow-sm">
      <BenchRowWithMidline>
        {Array.from({ length: count }).map((_, i) => (
          <DeskBayWeb
            key={`${block.id}-${block.topRow[i]}-${block.bottomRow[i]}`}
            topSeatNo={block.topRow[i]}
            bottomSeatNo={block.bottomRow[i]}
            topVisual={visualForSeat(block.topRow[i], selected, occupiedSeats)}
            bottomVisual={visualForSeat(block.bottomRow[i], selected, occupiedSeats)}
            onSelectTop={() => onSelect(block.topRow[i])}
            onSelectBottom={() => onSelect(block.bottomRow[i])}
          />
        ))}
      </BenchRowWithMidline>
    </div>
  );
}

export default function LongTermSeatMap({
  selected,
  onSelect,
  occupiedSeats,
}: {
  selected: number | null;
  onSelect: (n: number) => void;
  occupiedSeats: Set<number>;
}) {
  const floorInnerRef = useRef<HTMLDivElement>(null);
  const blAnchorRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const rightWindowRowRef = useRef<HTMLDivElement>(null);
  const stairsBoxRef = useRef<HTMLDivElement>(null);
  const [floorGeom, setFloorGeom] = useState<{
    jambLeft: number;
    doorTop: number;
    stairsWidth: number;
    rowMinHeight: number;
    windowGridHeightPx: number;
    doorBandTopPx: number;
    doorBandHeightPx: number;
  } | null>(null);

  useLayoutEffect(() => {
    const floor = floorInnerRef.current;
    const bl = blAnchorRef.current;
    if (!floor || !bl) return;

    const update = () => {
      const fr = floor.getBoundingClientRect();
      const br = bl.getBoundingClientRect();
      const jambLeft = Math.round(br.right - fr.left);
      const windowStripPx = 28; /* w-7 */
      const stairsWidth = Math.max(200, Math.round(fr.width - jambLeft - windowStripPx));

      const rowEl = rightWindowRowRef.current;
      const stairsEl = stairsBoxRef.current;
      const rightCol = rightColRef.current;
      const rightH = rightCol?.offsetHeight ?? 0;

      const WINDOW_HEADER = WINDOW_STRIP_HEADER_PX;
      const FALLBACK_DOOR_H = 128;

      let rowMinHeight = rightH;
      let doorBandTopPx = Math.max(0, rightH - FALLBACK_DOOR_H - 8);
      let doorBandHeightPx = FALLBACK_DOOR_H;
      if (rowEl && stairsEl && rightCol) {
        const rowRect = rowEl.getBoundingClientRect();
        const stairsRect = stairsEl.getBoundingClientRect();
        doorBandTopPx = Math.round(stairsRect.top - rowRect.top);
        doorBandHeightPx = Math.round(stairsRect.height);
        rowMinHeight = Math.max(rightH, doorBandTopPx + doorBandHeightPx);
      }

      const windowGridHeightPx = Math.max(
        32,
        doorBandTopPx - WINDOW_HEADER,
      );

      setFloorGeom((prev) => {
        const next = {
          jambLeft,
          doorTop: Math.round(br.bottom - fr.top + 2),
          stairsWidth,
          rowMinHeight,
          windowGridHeightPx,
          doorBandTopPx,
          doorBandHeightPx,
        };
        if (
          prev &&
          prev.jambLeft === next.jambLeft &&
          prev.doorTop === next.doorTop &&
          prev.stairsWidth === next.stairsWidth &&
          prev.rowMinHeight === next.rowMinHeight &&
          prev.windowGridHeightPx === next.windowGridHeightPx &&
          prev.doorBandTopPx === next.doorBandTopPx &&
          prev.doorBandHeightPx === next.doorBandHeightPx
        ) {
          return prev;
        }
        return next;
      });
    };

    update();
    requestAnimationFrame(() => update());

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(floor);
    ro?.observe(bl);
    const rc = rightColRef.current;
    if (rc) ro?.observe(rc);
    const sb = stairsBoxRef.current;
    if (sb) ro?.observe(sb);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const jamb = floorGeom?.jambLeft ?? 0;
  const doorTop = floorGeom?.doorTop ?? 0;
  const stairsWidth = floorGeom?.stairsWidth ?? 280;
  const rowMinHeight = floorGeom?.rowMinHeight ?? 0;
  const windowGridHeightPx = floorGeom?.windowGridHeightPx ?? 120;
  const doorBandTopPx = floorGeom?.doorBandTopPx ?? 0;
  const doorBandHeightPx = floorGeom?.doorBandHeightPx ?? 128;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="inline-flex min-w-max flex-col items-center gap-2">
        {selected != null ? (
          <div className="flex w-full justify-center px-1" aria-live="polite" aria-atomic="true">
            <span className="rounded-full border border-ink-200/90 bg-white px-3 py-1 font-mono text-xs font-bold tabular-nums tracking-tight text-ink-900 shadow-sm">
              F({selected})
            </span>
          </div>
        ) : null}
        <div
          className="overflow-hidden rounded-2xl border shadow-md"
          style={{ borderColor: EXPO.line, backgroundColor: EXPO.surface }}
        >
        <div
          className="flex h-7 items-center justify-center gap-2 border-b"
          style={{
            backgroundColor: EXPO.wallTop,
            borderColor: "rgba(17, 24, 39, 0.12)",
          }}
        >
          <AcIcon />
          <span
            className="font-mono text-[9px] font-bold uppercase tracking-wider"
            style={{ color: "rgba(17, 24, 39, 0.55)" }}
          >
            AC
          </span>
        </div>

        <div className="flex flex-row items-stretch">
          <div
            className="relative flex w-9 shrink-0 flex-col items-center border-r py-2"
            style={{
              backgroundColor: EXPO.wallSide,
              borderColor: "rgba(17, 24, 39, 0.14)",
            }}
          >
            <div className="absolute top-[42%] flex -translate-y-1/2 flex-col items-center">
              <AcIcon />
              <span className="mt-0.5 font-mono text-[8px] font-bold uppercase text-ink-500">
                AC
              </span>
            </div>
            <div className="absolute bottom-[22%] flex flex-col items-center rounded-lg border border-emerald-700/35 bg-emerald-700/10 px-1 py-1">
              <svg viewBox="0 0 24 24" className="h-3 w-3 text-emerald-700">
                <path
                  fill="currentColor"
                  d="M8 2h8v2H8V2zm0 4h8l1 10v6H7v-6l1-10zm2 14h4v2h-4v-2z"
                />
              </svg>
              <span className="mt-0.5 font-mono text-[7px] font-bold uppercase text-emerald-800">
                WC
              </span>
            </div>
          </div>

          <div
            ref={floorInnerRef}
            className="relative min-h-[200px] flex-1 pb-6 pt-4"
            style={{ backgroundColor: EXPO.floor }}
          >
            <div className="flex min-h-0 flex-row items-start">
              {/* Left column — student-app `blockColumn`: tl/ml/ll align start; bl aligns end (aisle side). */}
              <div className="inline-flex shrink-0 flex-col items-stretch">
                {LEFT_SEAT_BLOCKS.map((block, idx) => (
                  <div key={block.id}>
                    {idx > 0 ? <div className="h-7 shrink-0" aria-hidden /> : null}
                    <div
                      className={
                        block.id === "bl"
                          ? "flex w-full justify-end"
                          : "flex w-full justify-start"
                      }
                    >
                      <div
                        ref={block.id === "bl" ? blAnchorRef : undefined}
                        className={block.id === "bl" ? "relative shrink-0" : undefined}
                      >
                        <SingleBenchBlock
                          block={block}
                          selected={selected}
                          onSelect={onSelect}
                          occupiedSeats={occupiedSeats}
                        />
                        {block.id === "bl" ? (
                          <div
                            ref={stairsBoxRef}
                            className="pointer-events-none absolute left-full top-0 z-[4] flex pl-1.5 pt-0.5"
                            style={{ width: stairsWidth }}
                          >
                            <DoorStairsWeb
                              inkMuted="rgba(17, 24, 39, 0.55)"
                              stretch
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mx-0 flex w-[34px] shrink-0 flex-col items-center justify-center self-stretch py-10"
                style={{ backgroundColor: "transparent" }}
                aria-label="Central aisle"
              >
                <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-ink-400 [writing-mode:vertical-rl]">
                  Aisle
                </span>
              </div>

              {/* Right three benches + window — shared height so window fills desk stack. */}
              <div
                ref={rightWindowRowRef}
                className="flex shrink-0 flex-row items-stretch"
                style={rowMinHeight > 0 ? { minHeight: `${rowMinHeight}px` } : undefined}
              >
                <div
                  ref={rightColRef}
                  className="inline-flex min-w-0 shrink-0 flex-col items-stretch self-start"
                >
                  {RIGHT_SEAT_BLOCKS.map((block, idx) => (
                    <div key={block.id}>
                      {idx > 0 ? <div className="h-7 shrink-0" aria-hidden /> : null}
                      <div
                        className={
                          idx > 0 ? "flex w-full justify-end" : "flex w-full justify-start"
                        }
                      >
                        <SingleBenchBlock
                          block={block}
                          selected={selected}
                          onSelect={onSelect}
                          occupiedSeats={occupiedSeats}
                        />
                      </div>
                    </div>
                  ))}
                  {/* student-app `walkGapUnderLowerRightDesk` */}
                  <div className="h-[52px] shrink-0" aria-hidden />
                </div>

                <WindowStrip
                  windowGridHeightPx={windowGridHeightPx}
                  doorBandTopPx={doorBandTopPx}
                  doorBandHeightPx={doorBandHeightPx}
                />
              </div>
            </div>

            {/* Door opening + jamb — student-app `doorOpeningAbs` / `doorJambDown` */}
            {floorGeom != null ? (
              <>
                <div
                  className="pointer-events-none absolute z-[6]"
                  style={{
                    left: jamb,
                    top: doorTop,
                    width: 54,
                    height: 22,
                  }}
                >
                  <div
                    className="absolute left-0 top-2.5 h-2 w-[22px] rounded-sm"
                    style={{ backgroundColor: EXPO.floor }}
                  />
                  <div
                    className="absolute left-0 top-0 h-[18px] w-0.5 rounded-sm"
                    style={{ backgroundColor: EXPO.line }}
                  />
                </div>
                <div
                  className="pointer-events-none absolute bottom-0 z-[6] w-0.5 rounded-sm"
                  style={{
                    left: jamb,
                    height: 36,
                    backgroundColor: EXPO.line,
                  }}
                />
              </>
            ) : null}

          </div>
        </div>

        <div
          className="border-t px-3 py-1.5"
          style={{
            backgroundColor: EXPO.wallTop,
            borderColor: "rgba(17, 24, 39, 0.12)",
          }}
        />
        </div>
      </div>
    </div>
  );
}
