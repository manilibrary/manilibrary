import { addDaysYmd, DEFAULT_LIBRARY_TZ, todayYmdInTz } from "@/lib/membership/windows";
import { formatDateDdMmYyyy } from "@/lib/date-format";

function isoCompare(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Earliest allowed start for a renewal: day after expiry, but not before today. */
export function minRenewStartYmd(expiryYmd: string, today = todayYmdInTz(DEFAULT_LIBRARY_TZ)): string {
  const expiryDay = expiryYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDay)) return today;
  const afterExpiry = addDaysYmd(expiryDay, 1);
  return isoCompare(afterExpiry, today) >= 0 ? afterExpiry : today;
}

export function renewStartDateHint(expiryYmd: string, minStart: string): string {
  const expiryDay = expiryYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDay)) {
    return `New period must start on or after ${formatDateDdMmYyyy(minStart)}.`;
  }
  return `Current membership ends ${formatDateDdMmYyyy(expiryDay)}. New period must start on or after ${formatDateDdMmYyyy(minStart)}.`;
}

export function isValidRenewStartYmd(startYmd: string, minStart: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return false;
  return isoCompare(startYmd, minStart) >= 0;
}
