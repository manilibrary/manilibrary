/** User-facing label for `profiles.device_user_id` (desk / biometric id). */
export const DEVICE_USER_ID_LABEL = "Device user id";

export const DEVICE_USER_ID_SEARCH_PLACEHOLDER = "Device user id, name, email, or phone";

export function formatDeviceUserIdPadded(id: number | string | null | undefined): string {
  if (id == null || id === "") return "—";
  const n = typeof id === "number" ? id : parseInt(String(id).trim(), 10);
  if (!Number.isFinite(n)) return String(id);
  return String(n).padStart(4, "0");
}

/** List row / payment subtitle, e.g. "Device user id 1112". */
export function deviceUserIdInlineLabel(id: number | string | null | undefined): string {
  const padded = formatDeviceUserIdPadded(id);
  if (padded === "—") return padded;
  return `${DEVICE_USER_ID_LABEL} ${padded}`;
}
