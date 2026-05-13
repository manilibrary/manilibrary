import { EXPO } from "./expoSeatTheme";

export default function ChairIconWeb({
  color,
  className = "",
  flipped,
}: {
  color: string;
  className?: string;
  flipped?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 16 18"
      className={`h-[18px] w-4 shrink-0 ${flipped ? "rotate-180" : ""} ${className}`}
      aria-hidden
    >
      <ellipse cx="8" cy="15.5" rx="5.5" ry="1.8" fill={color} opacity={0.35} />
      <rect x="3.5" y="8" width="9" height="6.5" rx="1.2" fill={color} opacity={0.9} />
      <rect x="4.5" y="2" width="7" height="7.5" rx="1.2" fill={color} />
      <circle cx="5" cy="16" r="1" fill={EXPO.ink} opacity={0.25} />
      <circle cx="11" cy="16" r="1" fill={EXPO.ink} opacity={0.25} />
    </svg>
  );
}
