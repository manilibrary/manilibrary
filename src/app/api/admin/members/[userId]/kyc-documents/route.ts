import { apiError, apiSuccess } from "@/lib/api/json-response";
import { requireLibraryAdminOrSuperAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DocRow = {
  verification_id: string;
  doc_type: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
};

type ReqRow = { id: string; created_at: string };

export async function GET(_request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const gate = await requireLibraryAdminOrSuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const { userId } = await ctx.params;
  if (!userId || !UUID_RE.test(userId)) {
    return apiError("Invalid user id.", 400);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfiguration.";
    return apiError(msg, 503);
  }

  const { data: reqs, error: re } = await admin
    .from("verification_requests")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (re) {
    return apiError(re.message, 500);
  }

  const requests = (reqs ?? []) as ReqRow[];
  if (requests.length === 0) {
    return apiSuccess("No verification requests for this member; document list is empty.", {
      documents: [] as { doc_type: string; content_type: string | null; signedUrl: string }[],
    });
  }

  const reqIds = requests.map((r) => r.id);
  const createdByReq = new Map(requests.map((r) => [r.id, r.created_at]));

  const { data: rawDocs, error: de } = await admin
    .from("verification_documents")
    .select("verification_id, doc_type, storage_bucket, storage_path, content_type")
    .in("verification_id", reqIds);

  if (de) {
    return apiError(de.message, 500);
  }

  const byType = new Map<string, DocRow>();
  for (const d of (rawDocs ?? []) as DocRow[]) {
    const prev = byType.get(d.doc_type);
    const tNew = createdByReq.get(d.verification_id) ?? "";
    const tOld = prev ? (createdByReq.get(prev.verification_id) ?? "") : "";
    if (!prev || tNew > tOld) {
      byType.set(d.doc_type, d);
    }
  }

  const SIGNED_TTL = 60 * 60; // 1 hour
  const out: { doc_type: string; content_type: string | null; signedUrl: string }[] = [];

  for (const d of byType.values()) {
    const bucket = d.storage_bucket?.trim() || "kyc-private";
    const { data: signed, error: se } = await admin.storage.from(bucket).createSignedUrl(d.storage_path, SIGNED_TTL);
    if (se || !signed?.signedUrl) {
      return apiError(se?.message ?? "Could not sign document URL.", 502, { hint: `bucket=${bucket}` });
    }
    out.push({
      doc_type: d.doc_type,
      content_type: d.content_type,
      signedUrl: signed.signedUrl,
    });
  }

  const order = ["aadhaar_front", "aadhaar_back", "student_id"];
  out.sort((a, b) => order.indexOf(a.doc_type) - order.indexOf(b.doc_type));

  return apiSuccess(`Loaded ${out.length} KYC document(s) with signed URLs (1h TTL).`, { documents: out });
}
