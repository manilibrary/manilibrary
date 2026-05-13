import { DEFAULT_LIBRARY_TZ } from "@/lib/membership/windows";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function partsFromDateInTz(date: Date, timeZone: string): { dd: string; mm: string; yyyy: string } | null {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const dd = parts.find((p) => p.type === "day")?.value;
  const mm = parts.find((p) => p.type === "month")?.value;
  const yyyy = parts.find((p) => p.type === "year")?.value;
  return dd && mm && yyyy ? { dd, mm, yyyy } : null;
}

export function formatDateDdMmYyyy(
  input: string | null | undefined,
  timeZone: string = DEFAULT_LIBRARY_TZ,
): string {
  if (typeof input !== "string") return "—";
  const trimmed = input.trim();
  if (!trimmed) return "—";

  const ymd = trimmed.match(YMD_RE);
  if (ymd) {
    const [, yyyy, mm, dd] = ymd;
    return `${dd}/${mm}/${yyyy}`;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = partsFromDateInTz(date, timeZone);
  return parts ? `${parts.dd}/${parts.mm}/${parts.yyyy}` : "—";
}

export function formatDateTimeDdMmYyyy(
  input: string | null | undefined,
  timeZone: string = DEFAULT_LIBRARY_TZ,
): string {
  if (typeof input !== "string") return "—";
  const trimmed = input.trim();
  if (!trimmed) return "—";

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return formatDateDdMmYyyy(trimmed, timeZone);

  const datePart = formatDateDdMmYyyy(trimmed, timeZone);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${datePart} ${timePart}`;
}
