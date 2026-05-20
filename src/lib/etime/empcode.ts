/** eTime `Empcode` query value for a library device user id. */
export function empcodeFromDeviceUserId(deviceUserId: number): string {
  return String(Math.trunc(deviceUserId)).padStart(4, "0");
}
