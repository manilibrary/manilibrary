"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * One continuous horizontal rule between upper and lower desk rows
 * (student-app `benchSplitLine`), spanning the full bench width.
 */
export default function BenchRowWithMidline({ children }: { children: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [splitPx, setSplitPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const measure = () => {
      const upper = row.querySelector("[data-seat-desk=\"upper\"]");
      const lower = row.querySelector("[data-seat-desk=\"lower\"]");
      if (!upper || !lower) {
        setSplitPx(null);
        return;
      }
      const ru = upper.getBoundingClientRect();
      const rl = lower.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const mid = (ru.bottom + rl.top) / 2 - rr.top;
      setSplitPx(Math.round(mid));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={rowRef}
      className="relative flex flex-row items-stretch justify-center"
    >
      {children}
      {splitPx != null ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-[1] h-px -translate-y-1/2 rounded-full bg-ink-900/35"
          style={{ top: splitPx }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
