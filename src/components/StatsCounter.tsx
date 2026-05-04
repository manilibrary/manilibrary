"use client";

import { useEffect, useRef, useState } from "react";

type Stat = {
  numeric: number;
  suffix: string;
  label: string;
};

const STATS: Stat[] = [
  { numeric: 500, suffix: "+", label: "Members" },
  { numeric: 120, suffix: "",  label: "Seats" },
  { numeric: 98,  suffix: "%", label: "Renewal rate" },
  { numeric: 5,   suffix: "★", label: "Rated by students" },
];

const DURATION = 1400;

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION, 1);
      setValue(Math.round(easeOutExpo(progress) * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, target]);

  return value;
}

function StatItem({ stat, active }: { stat: Stat; active: boolean }) {
  const count = useCountUp(stat.numeric, active);
  return (
    <div className="bg-surface-muted px-6 py-8 text-center">
      <p className="text-3xl font-semibold tracking-tight text-ink-900">
        {count}{stat.suffix}
      </p>
      <p className="mt-1 text-sm text-ink-500">{stat.label}</p>
    </div>
  );
}

export default function StatsCounter() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="border-y border-ink-100 bg-surface-muted">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-ink-100 md:grid-cols-4">
        {STATS.map((s) => (
          <StatItem key={s.label} stat={s} active={active} />
        ))}
      </div>
    </section>
  );
}
