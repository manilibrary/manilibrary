import { apiSuccess } from "@/lib/api/json-response";
import libraryInfo from "@/data/libraryInfo.json";

export const runtime = "nodejs";

/** Public catalog copy for mobile / external clients (no auth). Omits demo credentials. */
export async function GET() {
  const raw = libraryInfo as Record<string, unknown>;
  const rest = { ...raw };
  delete rest.demoCredentials;
  return apiSuccess("Library public profile.", { library: rest });
}
