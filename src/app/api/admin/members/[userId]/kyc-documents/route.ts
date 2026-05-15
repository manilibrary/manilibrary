import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { requireLibraryAdminOrSuperAdmin } from "@/lib/supabase/require-library-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { KYC_DOC_TYPES, type KycDocType, type VerificationDocItem } from "@/lib/verification/verification-repo";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const gate = await requireLibraryAdminOrSuperAdmin(_request);
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
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const { data: verList, error: re } = await admin
    .from("verification")
    .select("id, submitted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(40);

  if (re) {
    return apiErrorSafe(re, 500);
  }

  const verRows = verList ?? [];
  const verIds = verRows.map((r) => (r as { id: string }).id).filter(Boolean);
  if (verIds.length === 0) {
    return apiSuccess("No submitted KYC documents for this member.", {
      documents: [] as { doc_type: string; content_type: string | null; signedUrl: string }[],
    });
  }

  const rankByVerId = new Map<string, number>();
  verIds.forEach((id, i) => rankByVerId.set(id, i));

  const { data: docRows, error: de } = await admin
    .from("verification_documents")
    .select("verification_id, doc_type, phase, storage_bucket, storage_path, content_type")
    .in("verification_id", verIds)
    .eq("phase", "submitted")
    .is("deleted_at", null);

  if (de) {
    return apiErrorSafe(de, 500);
  }

  const byType = new Map<string, { item: VerificationDocItem; rank: number }>();
  for (const raw of docRows ?? []) {
    const o = raw as Record<string, unknown>;
    const vid = String(o.verification_id ?? "");
    const docType = o.doc_type;
    const phase = o.phase;
    const rank = rankByVerId.get(vid) ?? 999;
    if (
      typeof docType !== "string" ||
      !KYC_DOC_TYPES.includes(docType as KycDocType) ||
      phase !== "submitted" ||
      typeof o.storage_bucket !== "string" ||
      typeof o.storage_path !== "string" ||
      typeof o.content_type !== "string"
    ) {
      continue;
    }
    const item: VerificationDocItem = {
      doc_type: docType as KycDocType,
      storage_bucket: o.storage_bucket,
      storage_path: o.storage_path,
      content_type: o.content_type,
      phase: "submitted",
    };
    const prev = byType.get(docType);
    if (!prev || rank < prev.rank) {
      byType.set(docType, { item, rank });
    }
  }

  const picked = [...byType.values()].map((x) => x.item);
  if (picked.length === 0) {
    return apiSuccess("No submitted KYC documents for this member.", {
      documents: [] as { doc_type: string; content_type: string | null; signedUrl: string }[],
    });
  }

  const SIGNED_TTL = 60 * 60;
  const out: { doc_type: string; content_type: string | null; signedUrl: string }[] = [];

  for (const d of picked) {
    const buck = d.storage_bucket?.trim() || "kyc-private";
    const { data: signed, error: se } = await admin.storage.from(buck).createSignedUrl(d.storage_path, SIGNED_TTL);
    if (se || !signed?.signedUrl) {
      return apiErrorSafe(
        se ?? "Storage did not return a signed URL.",
        502,
        "Could not sign document URL.",
        { hint: `bucket=${buck}` },
      );
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
