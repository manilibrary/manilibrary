import { cookies } from "next/headers";

import { apiError, apiSuccess } from "@/lib/api/json-response";
import { guardApiIp, readJsonBody } from "@/lib/security/request-guards";
import {
  SITE_VISITOR_COOKIE,
  SITE_VISITOR_COOKIE_MAX_AGE_SEC,
} from "@/lib/site-visits/constants";
import { recordSiteVisit } from "@/lib/site-visits/record-site-visit";
import { generateVisitorKey, normalizeVisitorKey } from "@/lib/site-visits/visitor-key";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

function normalizePath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "/";
  const path = raw.trim();
  if (!path.startsWith("/")) return `/${path.slice(0, 511)}`;
  return path.slice(0, 512);
}

function normalizeReferrer(raw: unknown, header: string | null): string | null {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 1024);
  if (header && header.trim()) return header.trim().slice(0, 1024);
  return null;
}

export async function POST(request: Request) {
  const limited = guardApiIp(request);
  if (limited) return limited;

  const parsed = await readJsonBody(request, 4_096);
  if (!parsed.ok) return parsed.response;

  const path = normalizePath(parsed.body.path);
  if (path.startsWith("/api/")) {
    return apiSuccess("Skipped.", { recorded: false });
  }

  const cookieStore = await cookies();
  let visitorKey = normalizeVisitorKey(cookieStore.get(SITE_VISITOR_COOKIE)?.value);
  const isNewVisitor = !visitorKey;
  if (!visitorKey) {
    visitorKey = generateVisitorKey();
  }

  let userId: string | null = null;
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  try {
    const admin = createSupabaseServiceRoleClient();
    const { recorded } = await recordSiteVisit(admin, {
      visitorKey,
      path,
      referrer: normalizeReferrer(parsed.body.referrer, request.headers.get("referer")),
      userId,
    });

    const res = apiSuccess(recorded ? "Visit recorded." : "Visit already counted recently.", {
      recorded,
    });
    if (isNewVisitor) {
      res.cookies.set(SITE_VISITOR_COOKIE, visitorKey, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SITE_VISITOR_COOKIE_MAX_AGE_SEC,
      });
    }
    return res;
  } catch (e: unknown) {
    return apiError(e instanceof Error ? e.message : "Could not record visit.", 500);
  }
}
