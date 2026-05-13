/** eTimeOffice expects DD/MM/YYYY (local office calendar day). */
export function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** `days` whole days before `end` (local calendar), minimum 1. */
export function formatDateDMYDaysBefore(end: Date, days: number): string {
  const d = new Date(end.getTime() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  return formatDateDMY(d);
}

/** B2 range: DD/MM/YYYY_HH:mm */
export function formatDateTimeDMY(d: Date, hh: number, mi: number): string {
  const date = formatDateDMY(d);
  const h = String(hh).padStart(2, "0");
  const m = String(mi).padStart(2, "0");
  return `${date}_${h}:${m}`;
}

export function dayBoundsForPunchMcid(d: Date): { from: string; to: string } {
  return {
    from: formatDateTimeDMY(d, 0, 1),
    to: formatDateTimeDMY(d, 23, 59),
  };
}
