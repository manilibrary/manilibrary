"use client";

import { useEffect, useRef, useState } from "react";

/**
 * TableScroll — a robust horizontal-scroll container for wide tables.
 *
 * - Lets any-width table scroll horizontally inside it
 * - Shows a subtle gradient fade on the left/right edge whenever there's
 *   more content in that direction, hiding the hint when scrolled all the
 *   way to that edge.
 * - Pair with `className="sticky-col"` on the first <th>/<td> of each row
 *   to keep the identity column pinned while the rest scrolls.
 */
export default function TableScroll({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeft(scrollLeft > 4);
      setShowRight(scrollLeft + clientWidth < scrollWidth - 4);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });

    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        className="overflow-x-auto scrollbar-thin"
      >
        {children}
      </div>

      {/* Left fade — hidden when at start */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-ink-100/70 to-transparent transition-opacity duration-150 ${
          showLeft ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />

      {/* Right fade — hidden when at end */}
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-ink-100/70 to-transparent transition-opacity duration-150 ${
          showRight ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      />
    </div>
  );
}
