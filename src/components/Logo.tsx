import Image from "next/image";
import Link from "next/link";
import libraryInfo from "@/data/libraryInfo.json";

type LogoProps = {
  href?: string;
  className?: string;
  height?: number;
  priority?: boolean;
};

const ASPECT_RATIO = 2000 / 587;

export default function Logo({
  href = "/",
  className = "",
  height = 36,
  priority = false,
}: LogoProps) {
  const width = Math.round(height * ASPECT_RATIO);

  return (
    <Link
      href={href}
      className={`inline-flex items-center ${className}`}
      aria-label={libraryInfo.name}
    >
      <Image
        src="/navlogo.svg"
        alt={libraryInfo.name}
        width={width}
        height={height}
        priority={priority}
        style={{ width, height }}
      />
    </Link>
  );
}
