/**
 * Short-term 3-row hall layout (from student-app / Expo) — 90 desks.
 */

export type RowsSeatBlockSpec = {
  rowIndex: 1 | 2 | 3;
  title: string;
  topRow: number[];
  bottomRow: number[];
};

function inclusiveRange(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n += 1) out.push(n);
  return out;
}

export const ROWS_SEAT_BLOCKS: RowsSeatBlockSpec[] = [
  {
    rowIndex: 3,
    title: "Row 3 · seats 75–90 / 59–74",
    topRow: inclusiveRange(75, 90),
    bottomRow: inclusiveRange(59, 74),
  },
  {
    rowIndex: 2,
    title: "Row 2 · seats 43–58 / 27–42",
    topRow: inclusiveRange(43, 58),
    bottomRow: inclusiveRange(27, 42),
  },
  {
    rowIndex: 1,
    title: "Row 1 · seats 14–26 / 1–13",
    topRow: inclusiveRange(14, 26),
    bottomRow: inclusiveRange(1, 13),
  },
];

/** Non-selectable in short layout (not sold / structural). */
export const SHORT_TERM_EXTRA_BLOCKED = new Set([43, 48, 54]);
