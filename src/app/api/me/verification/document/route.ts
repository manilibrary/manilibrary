import { randomUUID } from "crypto";

import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  deriveUiVerificationStatus,
  ensurePendingVerification,
  fetchDocumentsForVerification,
  fetchLatestVerification,
  fetchOpenVerification,
  replaceVerificationDocumentSlot,
  type VerificationDocItem,
} from "@/lib/verification/verification-repo";

export const runtime = "nodejs";

const DOC_TYPES = new Set(["aadhaar_front", "aadhaar_back", "student_id"]);
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function bucket(): string {
  return process.env.KYC_STORAGE_BUCKET?.trim() || "kyc-private";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError("Sign in required.", 401);
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server misconfiguration.");
  }

  const form = await request.formData();
  const file = form.get("file");
  const docTypeRaw = form.get("docType");
  if (!(file instanceof File)) {
    return apiError("Missing file field.", 400);
  }
  if (typeof docTypeRaw !== "string" || !DOC_TYPES.has(docTypeRaw)) {
    return apiError("docType must be aadhaar_front, aadhaar_back, or student_id.", 400);
  }
  const docType = docTypeRaw as "aadhaar_front" | "aadhaar_back" | "student_id";

  if (file.size > MAX_BYTES) {
    return apiError("File too large (max 5 MB).", 400);
  }
  const ct = file.type || "application/octet-stream";
  if (!ALLOWED.has(ct)) {
    return apiError("Only JPEG, PNG, WebP, or PDF allowed.", 400);
  }

  const { data: profRow, error: prErr } = await admin.from("profiles").select("is_verified").eq("user_id", user.id).maybeSingle();
  if (prErr) {
    return apiErrorSafe(prErr, 500);
  }

  const { data: latestV } = await fetchLatestVerification(admin, user.id);
  const latestDocs = latestV?.id ? await fetchDocumentsForVerification(admin, latestV.id) : [];
  const vStatus = deriveUiVerificationStatus(profRow?.is_verified === true, latestV, latestDocs);

  if (vStatus === "approved") {
    return apiError("New uploads are not allowed right now.", 403, {
      hint: "You are already verified.",
    });
  }
  if (vStatus === "rejected") {
    return apiError("New uploads are not allowed right now.", 403, {
      hint: "Contact the library or wait for staff to request a new upload.",
    });
  }

  if (vStatus === "pending") {
    const { data: pend } = await fetchOpenVerification(admin, user.id);
    const pendDocs = pend?.id ? await fetchDocumentsForVerification(admin, pend.id) : [];
    const hasSubmitted = pendDocs.some((d) => d.phase === "submitted" && d.doc_type === docType);
    if (hasSubmitted) {
      return apiError("This document is already on file for review.", 403, {
        hint: "You cannot replace uploads until staff request a resubmit.",
      });
    }
  } else if (vStatus !== "none" && vStatus !== "resubmit") {
    return apiError("New uploads are not allowed right now.", 403, {
      hint: "Uploads are not available in your current state.",
    });
  }

  const ext =
    ct === "image/png"
      ? "png"
      : ct === "image/webp"
        ? "webp"
        : ct === "application/pdf"
          ? "pdf"
          : "jpg";
  const path = `${user.id}/${docType}_${randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(bucket()).upload(path, buf, {
    contentType: ct,
    upsert: true,
  });
  if (upErr) {
    return apiErrorSafe(upErr, 502, "Could not upload file.", {
      hint: "Create a private Storage bucket (e.g. kyc-private) and set KYC_STORAGE_BUCKET if different.",
    });
  }

  const newItem: VerificationDocItem = {
    doc_type: docType,
    storage_bucket: bucket(),
    storage_path: path,
    content_type: ct,
    phase: "submitted",
  };

  const { data: open } = await fetchOpenVerification(admin, user.id);
  const verId = open?.id ?? (await ensurePendingVerification(admin, user.id)).id;

  const { error: slotErr } = await replaceVerificationDocumentSlot(admin, {
    verification_id: verId,
    user_id: user.id,
    item: newItem,
  });
  if (slotErr) {
    await admin.storage.from(bucket()).remove([path]);
    return apiErrorSafe(slotErr, 400);
  }

  const ts = new Date().toISOString();
  const { error: upVer } = await admin
    .from("verification")
    .update({
      status: "pending",
      submitted_at: ts,
      updated_at: ts,
    })
    .eq("id", verId);
  if (upVer) {
    await admin.storage.from(bucket()).remove([path]);
    return apiErrorSafe(upVer, 400);
  }

  return apiSuccess("KYC document uploaded; profile set to pending review.", { path, docType });
}
