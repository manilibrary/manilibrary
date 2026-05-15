/** Title-case each word for display names: "john doe" → "John Doe", "jean-pierre" → "Jean-Pierre". */
export function formatPersonName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const cap = (part: string) => {
    if (!part) return part;
    const lower = part.toLocaleLowerCase();
    return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
  };

  return trimmed
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word
        .split("-")
        .map(cap)
        .join("-")
        .split("'")
        .map(cap)
        .join("'"),
    )
    .join(" ");
}

/** Format stored names for UI (handles legacy lowercase rows). */
export function displayPersonName(raw: string | null | undefined, fallback = "Member"): string {
  if (raw == null) return fallback;
  const s = String(raw).trim();
  if (!s) return fallback;
  if (s === "—") return "—";
  return formatPersonName(s) || fallback;
}
