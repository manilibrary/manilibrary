/** Parse `fetch` JSON bodies without throwing on empty/non-JSON (e.g. blank 502). */
export async function parseFetchJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok ? "Server returned an empty response. Try again." : `Request failed (${res.status}). Try again.`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Server returned an invalid response. Try again.");
  }
}
