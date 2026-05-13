"use client";

import { EXPO } from "./expoSeatTheme";
import ChairIconWeb from "./ChairIconWeb";
import type { SeatVisual } from "./seatVisual";

function deskClass(visual: SeatVisual): string {
  switch (visual) {
    case "available":
      return "border border-[#7DD3FC] bg-white";
    case "selected":
      return "border-2 border-[#15803D] bg-[#16A34A]";
    case "occupiedLong":
      return "border-2 border-[#FFC107] bg-white";
    case "occupiedShort":
      return "border-2 border-sky-400 bg-white";
    case "homeHold":
      return "border-2 border-violet-500 bg-violet-50";
    case "blocked":
      return "border border-dashed border-red-400/80 bg-red-50/90";
    default:
      return "border border-ink-200 bg-white";
  }
}

function noClass(visual: SeatVisual): string {
  switch (visual) {
    case "selected":
      return "text-white";
    case "blocked":
      return "text-red-800 text-[7px]";
    case "occupiedLong":
    case "occupiedShort":
      return "text-amber-800";
    case "homeHold":
      return "text-violet-900";
    default:
      return "text-sky-700";
  }
}

function chairColor(visual: SeatVisual): string {
  switch (visual) {
    case "blocked":
      return EXPO.chairBlocked;
    case "occupiedLong":
    case "occupiedShort":
      return EXPO.chairOccupied;
    case "selected":
      return EXPO.chairSelected;
    case "homeHold":
      return EXPO.chairHome;
    default:
      return EXPO.chairAvailable;
  }
}

export default function DeskBayWeb({
  topSeatNo,
  bottomSeatNo,
  topVisual,
  bottomVisual,
  onSelectTop,
  onSelectBottom,
}: {
  topSeatNo: number;
  bottomSeatNo: number;
  topVisual: SeatVisual;
  bottomVisual: SeatVisual;
  onSelectTop?: () => void;
  onSelectBottom?: () => void;
}) {
  const topHandler = topVisual === "available" ? onSelectTop : undefined;
  const bottomHandler = bottomVisual === "available" ? onSelectBottom : undefined;

  return (
    <div className="flex min-w-[52px] flex-1 flex-col items-center border-r border-ink-900/10 px-2.5 py-1.5 last:border-r-0">
      <button
        type="button"
        disabled={!topHandler}
        onClick={() => topHandler?.()}
        className="flex h-[22px] w-[22px] items-center justify-center rounded-md disabled:cursor-default"
      >
        <ChairIconWeb color={chairColor(topVisual)} />
      </button>

      <div className="my-1 flex w-full flex-col items-center gap-1.5">
        <button
          type="button"
          data-seat-desk="upper"
          disabled={!topHandler}
          onClick={() => topHandler?.()}
          className={`relative flex h-[22px] w-[22px] items-center justify-center rounded-[4px] shadow-sm transition active:scale-[0.98] disabled:cursor-default ${deskClass(topVisual)}`}
        >
          {topVisual === "blocked" ? (
            <span className="pointer-events-none text-[11px] font-bold leading-none text-red-600">
              ×
            </span>
          ) : (
            <span
              className={`font-mono text-[8px] font-black leading-none ${noClass(topVisual)}`}
            >
              {topSeatNo}
            </span>
          )}
        </button>
        <button
          type="button"
          data-seat-desk="lower"
          disabled={!bottomHandler}
          onClick={() => bottomHandler?.()}
          className={`relative flex h-[22px] w-[22px] items-center justify-center rounded-[4px] shadow-sm transition active:scale-[0.98] disabled:cursor-default ${deskClass(bottomVisual)}`}
        >
          {bottomVisual === "blocked" ? (
            <span className="pointer-events-none text-[11px] font-bold leading-none text-red-600">
              ×
            </span>
          ) : (
            <span
              className={`font-mono text-[8px] font-black leading-none ${noClass(bottomVisual)}`}
            >
              {bottomSeatNo}
            </span>
          )}
        </button>
      </div>

      <button
        type="button"
        disabled={!bottomHandler}
        onClick={() => bottomHandler?.()}
        className="flex h-[22px] w-[22px] items-center justify-center rounded-md disabled:cursor-default"
      >
        <ChairIconWeb color={chairColor(bottomVisual)} flipped />
      </button>
    </div>
  );
}
