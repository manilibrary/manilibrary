import { NextRequest, NextResponse } from "next/server";
import { buildApiUrl } from "@/lib/attendance";

/**
 * GET /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Proxies the etimeoffice biometric API with Basic Auth.
 * Credentials: username = "support:support:support@1:true", password = ""
 */
const BASIC_TOKEN = Buffer.from("support:support:support@1:true:").toString("base64");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fromStr = sp.get("from");
  const toStr = sp.get("to");

  const now = new Date();
  const fromDate = fromStr
    ? new Date(fromStr)
    : (() => {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        return d;
      })();
  const toDate = toStr ? new Date(toStr) : now;

  const apiUrl = buildApiUrl(fromDate, toDate);

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124",
        Authorization: `Basic ${BASIC_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream API returned ${res.status}`, apiUrl },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not reach the biometric API",
        apiUrl,
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
