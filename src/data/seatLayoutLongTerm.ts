/**
 * Long-term floor layout (from student-app / Expo) — 100 seats, dual-row blocks.
 */

export type SeatBlockSpec = {
  id: string;
  topRow: number[];
  bottomRow: number[];
};

export const LEFT_SEAT_BLOCKS: SeatBlockSpec[] = [
  {
    id: "tl",
    topRow: [100, 99, 98, 97, 96, 95, 94, 93],
    bottomRow: [69, 70, 71, 72, 73, 74, 75, 76],
  },
  {
    id: "ml",
    topRow: [68, 67, 66, 65, 64, 63, 62],
    bottomRow: [41, 42, 43, 44, 45, 46, 47],
  },
  {
    id: "ll",
    topRow: [40, 39, 38, 37, 36, 35, 34],
    bottomRow: [13, 14, 15, 16, 17, 18, 19],
  },
  {
    id: "bl",
    topRow: [12, 11, 10, 9, 8, 7],
    bottomRow: [1, 2, 3, 4, 5, 6],
  },
];

export const RIGHT_SEAT_BLOCKS: SeatBlockSpec[] = [
  {
    id: "tr",
    topRow: [92, 91, 90, 89, 88, 87, 86, 85],
    bottomRow: [77, 78, 79, 80, 81, 82, 83, 84],
  },
  {
    id: "mr",
    topRow: [61, 60, 59, 58, 57, 56, 55],
    bottomRow: [48, 49, 50, 51, 52, 53, 54],
  },
  {
    id: "lr",
    topRow: [33, 32, 31, 30, 29, 28, 27],
    bottomRow: [20, 21, 22, 23, 24, 25, 26],
  },
];
