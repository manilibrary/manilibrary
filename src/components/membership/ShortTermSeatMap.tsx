"use client";

import type { RefObject } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ROWS_SEAT_BLOCKS,
  SHORT_TERM_EXTRA_BLOCKED,
  type RowsSeatBlockSpec,
} from "@/data/seatLayoutShortTerm";
import { LONG_TERM_BLOCKED } from "@/lib/membershipSeatMock";
import BenchRowWithMidline from "./BenchRowWithMidline";
import DeskBayWeb from "./DeskBayWeb";
import DoorStairsWeb from "./DoorStairsWeb";
import { EXPO } from "./expoSeatTheme";
import type { SeatVisual } from "./seatVisual";

function blockedShort(seat: number): boolean {
  return LONG_TERM_BLOCKED.has(seat) || SHORT_TERM_EXTRA_BLOCKED.has(seat);
}

function visualShort(seat: number, selected: number | null, occupiedSeats: Set<number>): SeatVisual {
  if (blockedShort(seat)) return "blocked";
  if (occupiedSeats.has(seat)) return "occupiedShort";
  if (selected === seat) return "selected";
  return "available";
}

function isShortTermSelectable(seat: number, occupiedSeats: Set<number>): boolean {
  return !blockedShort(seat) && !occupiedSeats.has(seat);
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

const WINDOW_GLASS_TINT = "rgba(147, 197, 253, 0.45)";

/**
 * Window strip — matches student-app `WindowSideStrip` + `windowStripeAbs`:
 * absolutely positioned on the floor (`right: -28px`, `top: 8`, `bottom: 40`), 2×5 panes + sill.
 */
function RowsWindowStripAbsolute() {
  const rows = 5;
  const cols = 2;
  return (
    <div
      className="pointer-events-none absolute z-[2] flex w-7 flex-col"
      style={{ top: 8, bottom: 40, right: -28 }}
      aria-hidden
    >
      <div
        className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border-2 bg-[#EDF1F8] shadow-[-1px_0_6px_rgba(0,0,0,0.06)]"
        style={{ borderColor: EXPO.line }}
      >
        <div className="flex shrink-0 flex-col items-center justify-center border-b border-ink-900/20 bg-white/95 py-1.5">
          <svg viewBox="0 0 24 24" className="h-3 w-3" style={{ color: EXPO.line }} aria-hidden>
            <path
              fill="currentColor"
              d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"
            />
          </svg>
          <span className="mt-0.5 max-w-[3.25rem] text-center font-mono text-[7px] font-extrabold uppercase leading-tight tracking-wide text-ink-600">
            Window side
          </span>
        </div>
        <div className="flex min-h-[120px] flex-1 flex-row">
          {Array.from({ length: cols }).map((_, col) => (
            <div
              key={col}
              className={
                col === 0
                  ? "flex min-h-0 min-w-0 flex-1 flex-col border-r border-ink-900/18"
                  : "flex min-h-0 min-w-0 flex-1 flex-col"
              }
            >
              {Array.from({ length: rows }).map((_, r) => (
                <div
                  key={r}
                  className={
                    r < rows - 1
                      ? "min-h-0 flex-1 border-b border-ink-900/14"
                      : "min-h-0 flex-1"
                  }
                  style={{ backgroundColor: WINDOW_GLASS_TINT }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="h-[5px] shrink-0 border-t border-ink-900/12 bg-[#fcfcfc]" />
      </div>
    </div>
  );
}

/** One short-term row bench (`RowsBenchBlock` + `seatRow` in student-app). */
function RowsBenchIsland({
  spec,
  selected,
  onSelect,
  occupiedSeats,
  row1Ref,
  row1DeskRef,
}: {
  spec: RowsSeatBlockSpec;
  selected: number | null;
  onSelect: (n: number) => void;
  occupiedSeats: Set<number>;
  row1Ref?: RefObject<HTMLDivElement | null>;
  row1DeskRef?: RefObject<HTMLDivElement | null>;
}) {
  const count = Math.min(spec.topRow.length, spec.bottomRow.length);
  const island = (
    <div
      ref={spec.rowIndex === 1 ? row1Ref : undefined}
      className="inline-flex flex-col self-start"
    >
      <p className="mb-1.5 px-3.5 font-mono text-[10px] font-bold uppercase tracking-wide text-ink-500/80">
        {spec.title}
      </p>
      <div
        ref={spec.rowIndex === 1 ? row1DeskRef : undefined}
        className="inline-flex rounded-xl border-x border-ink-900/20 bg-white/85 px-3 py-2.5 shadow-sm"
      >
        <BenchRowWithMidline>
          {Array.from({ length: count }).map((_, i) => (
            <DeskBayWeb
              key={`${spec.rowIndex}-${spec.topRow[i]}-${spec.bottomRow[i]}`}
              topSeatNo={spec.topRow[i]}
              bottomSeatNo={spec.bottomRow[i]}
              topVisual={visualShort(spec.topRow[i], selected, occupiedSeats)}
              bottomVisual={visualShort(spec.bottomRow[i], selected, occupiedSeats)}
              onSelectTop={() => onSelect(spec.topRow[i])}
              onSelectBottom={() => onSelect(spec.bottomRow[i])}
            />
          ))}
        </BenchRowWithMidline>
      </div>
    </div>
  );

  if (spec.rowIndex === 1) {
    return <div className="flex w-full justify-end">{island}</div>;
  }
  return <div className="flex w-full justify-start">{island}</div>;
}

/** `columnsRowAboveStairs.marginBottom` in student-app `LibrarySeatMapRows`. */
const STAIRS_TOP_CLEARANCE_PX = 224;

/** Gap under Row 1 desk before the stairs hall band (walk strip). */
const WALK_GAP_DESK_TO_STAIRS_PX = 16;

/**
 * Stairs hall left edge = horizontal center of Row 1 lower desk (measured on desk card).
 * If that would make the hall narrower than `MIN_STAIRS_BAND_WIDTH_PX`, we clamp leftward.
 */
const MIN_STAIRS_BAND_WIDTH_PX = 200;

const FLOOR_STAIRS_PAD_LEFT_PX = 6;

export default function ShortTermSeatMap({
  selected,
  onSelect,
  occupiedSeats,
}: {
  selected: number | null;
  onSelect: (n: number) => void;
  occupiedSeats: Set<number>;
}) {
  const floorInnerRef = useRef<HTMLDivElement>(null);
  const row1BenchRef = useRef<HTMLDivElement>(null);
  const row1DeskRef = useRef<HTMLDivElement>(null);
  const [floorGeom, setFloorGeom] = useState<{
    jambLeft: number;
    doorTop: number;
    stairsBandTop: number;
    stairsBandLeft: number;
  } | null>(null);

  useLayoutEffect(() => {
    const floor = floorInnerRef.current;
    const bench = row1BenchRef.current;
    const desk = row1DeskRef.current;
    if (!floor || !bench || !desk) return;

    const update = () => {
      const fr = floor.getBoundingClientRect();
      const br = bench.getBoundingClientRect();
      const dr = desk.getBoundingClientRect();

      const jambLeft = Math.round(br.right - fr.left);
      const doorTop = Math.round(br.bottom - fr.top + 2);
      const stairsBandTop = Math.round(dr.bottom - fr.top + WALK_GAP_DESK_TO_STAIRS_PX);

      const deskMidX = Math.round(dr.left + dr.width / 2 - fr.left);
      const floorW = floor.clientWidth;
      const maxBandLeft = Math.max(
        FLOOR_STAIRS_PAD_LEFT_PX,
        floorW - MIN_STAIRS_BAND_WIDTH_PX,
      );
      const stairsBandLeft = Math.min(
        maxBandLeft,
        Math.max(FLOOR_STAIRS_PAD_LEFT_PX, deskMidX),
      );

      setFloorGeom((prev) => {
        const next = { jambLeft, doorTop, stairsBandTop, stairsBandLeft };
        if (
          prev &&
          prev.jambLeft === next.jambLeft &&
          prev.doorTop === next.doorTop &&
          prev.stairsBandTop === next.stairsBandTop &&
          prev.stairsBandLeft === next.stairsBandLeft
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
    ro?.observe(bench);
    ro?.observe(desk);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const jamb = floorGeom?.jambLeft ?? 0;
  const doorTop = floorGeom?.doorTop ?? 0;
  const stairsBandTop = floorGeom?.stairsBandTop ?? 0;
  const stairsBandLeft = floorGeom?.stairsBandLeft ?? 0;

  const selectableCount = useMemo(() => {
    let n = 0;
    for (const spec of ROWS_SEAT_BLOCKS) {
      for (const s of spec.topRow) {
        if (isShortTermSelectable(s, occupiedSeats)) n += 1;
      }
      for (const s of spec.bottomRow) {
        if (isShortTermSelectable(s, occupiedSeats)) n += 1;
      }
    }
    return n;
  }, [occupiedSeats]);

  return (
    <div className="overflow-x-auto pb-2 pr-9">
      <div className="inline-flex min-w-max flex-col items-center gap-2">
        {selected != null ? (
          <div className="flex w-full justify-center px-1" aria-live="polite" aria-atomic="true">
            <span className="rounded-full border border-ink-200/90 bg-white px-3 py-1 font-mono text-xs font-bold tabular-nums tracking-tight text-ink-900 shadow-sm">
              S({selected})
            </span>
          </div>
        ) : null}
        <div
          className="overflow-visible rounded-2xl border shadow-md"
          style={{ borderColor: EXPO.line, backgroundColor: EXPO.surface }}
        >
        <div className="flex flex-row items-stretch">
          <div
            className="relative flex w-9 shrink-0 flex-col items-center border-r py-2"
            style={{
              backgroundColor: EXPO.surface,
              borderColor: EXPO.line,
            }}
          >
            <div className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center">
              <AcIcon />
              <span className="mt-0.5 font-mono text-[8px] font-bold uppercase text-ink-500">
                AC
              </span>
            </div>
            <div className="absolute bottom-[18%] flex w-full flex-col items-center px-0.5">
              <div className="flex flex-col items-center rounded-lg border border-emerald-700/35 bg-emerald-700/10 px-1 py-1">
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
          </div>

          <div
            ref={floorInnerRef}
            className="relative min-w-0 flex-1 overflow-visible pt-3"
            style={{ backgroundColor: EXPO.floor }}
          >
            <div className="mb-2 px-3 font-mono text-[11px] font-extrabold text-ink-600">
              Selected: {selected != null ? 1 : 0}
              <span className="text-ink-400"> · </span>
              Available: {selectableCount}
            </div>

            <div
              className="flex flex-row items-stretch"
              style={{ marginBottom: STAIRS_TOP_CLEARANCE_PX }}
            >
              <div className="inline-flex max-w-full shrink-0 flex-col items-stretch">
                {ROWS_SEAT_BLOCKS.map((spec, idx) => (
                  <div key={spec.rowIndex}>
                    <RowsBenchIsland
                      spec={spec}
                      selected={selected}
                      onSelect={onSelect}
                      occupiedSeats={occupiedSeats}
                      row1Ref={row1BenchRef}
                      row1DeskRef={row1DeskRef}
                    />
                    {idx === 0 ? <div className="h-7 shrink-0" aria-hidden /> : null}
                    {idx === 1 ? <div className="h-4 shrink-0" aria-hidden /> : null}
                  </div>
                ))}
              </div>

              <div
                className="w-[34px] shrink-0 self-stretch"
                style={{ backgroundColor: "transparent" }}
                aria-label="Central aisle"
              />

              <div className="flex min-h-0 min-w-[120px] flex-1 flex-col self-stretch">
                <div className="min-h-0 min-w-0 flex-1" aria-hidden />
                <div className="h-9 shrink-0" aria-hidden />
              </div>
            </div>

            <RowsWindowStripAbsolute />

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

            {floorGeom != null ? (
              <div
                className="pointer-events-none absolute bottom-0 z-[1] flex min-h-0 min-w-0 flex-col pt-0.5"
                style={{
                  left: stairsBandLeft,
                  /** Flush with window strip (`RowsWindowStripAbsolute` uses `right: -28`). */
                  right: -28,
                  top: stairsBandTop,
                }}
              >
                <DoorStairsWeb
                  inkMuted="rgba(17, 24, 39, 0.55)"
                  rowsShortTermBandFill
                />
              </div>
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
