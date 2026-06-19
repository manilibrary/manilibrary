import { LEFT_SEAT_BLOCKS, RIGHT_SEAT_BLOCKS } from "@/data/seatLayoutLongTerm";
import { ROWS_SEAT_BLOCKS, SHORT_TERM_EXTRA_BLOCKED } from "@/data/seatLayoutShortTerm";

export function longTermSeatCapacity(): number {
  return [...LEFT_SEAT_BLOCKS, ...RIGHT_SEAT_BLOCKS].reduce(
    (n, b) => n + b.topRow.length + b.bottomRow.length,
    0,
  );
}

export function shortTermSelectableSeatCapacity(): number {
  return ROWS_SEAT_BLOCKS.flatMap((b) => [...b.topRow, ...b.bottomRow]).filter(
    (n) => !SHORT_TERM_EXTRA_BLOCKED.has(n),
  ).length;
}

export function planSeatCapacity(planCode: string): number | null {
  if (planCode === "fixed_24h") return longTermSeatCapacity();
  if (planCode === "morning" || planCode === "evening" || planCode === "night") {
    return shortTermSelectableSeatCapacity();
  }
  return null;
}
