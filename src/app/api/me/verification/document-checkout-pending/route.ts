import { randomUUID } from "crypto";

import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import {
  deriveUiVerificationStatus,
  fetchDocumentsForVerification,
  fetchLatestVerification,
  fetchOpenVerification,
  insertVerificationDocument,
  listDocTypesForPhase,
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

export async function GET() {
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

  const { data: latest } = await fetchLatestVerification(admin, user.id);
  const docs = latest?.id ? await fetchDocumentsForVerification(admin, latest.id) : [];
  const stagedDocTypes = listDocTypesForPhase(docs, "checkout_pending");
  return apiSuccess("OK", { stagedDocTypes, checkoutKycStagingReady: true });
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
    return apiError("Checkout uploads are not available while you are verified.", 403);
  }
  if (vStatus === "rejected") {
    return apiError("Checkout uploads are not available. Contact the library or use the dashboard when staff reopen uploads.", 403);
  }
  if (vStatus === "pending") {
    return apiError("You already have documents under review. Change them from Dashboard → Membership, not during checkout.", 403);
  }
  if (vStatus !== "none" && vStatus !== "resubmit") {
    return apiError("Checkout uploads are not available in your current verification state.", 403);
  }

  const { data: pendRow } = await fetchOpenVerification(admin, user.id);
  const priorDocs = pendRow?.id ? await fetchDocumentsForVerification(admin, pendRow.id) : [];
  const prior = priorDocs.find((d) => d.doc_type === docType && d.phase === "checkout_pending");

  const ext =
    ct === "image/png"
      ? "png"
      : ct === "image/webp"
        ? "webp"
        : ct === "application/pdf"
          ? "pdf"
          : "jpg";
  const path = `${user.id}/checkout-pending/${docType}_${randomUUID()}.${ext}`;

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
    phase: "checkout_pending",
  };

  let verId = pendRow?.id;
  if (verId) {
    const { error: rowErr } = await replaceVerificationDocumentSlot(admin, {
      verification_id: verId,
      user_id: user.id,
      item: newItem,
    });
    if (rowErr) {
      await admin.storage.from(bucket()).remove([path]);
      return apiErrorSafe(rowErr, 400);
    }
    const { error: tsErr } = await admin.from("verification").update({ updated_at: new Date().toISOString() }).eq("id", verId);
    if (tsErr) {
      await admin.storage.from(bucket()).remove([path]);
      return apiErrorSafe(tsErr, 400);
    }
  } else {
    const { data: ins, error: insErr } = await admin
      .from("verification")
      .insert({ user_id: user.id, status: "pending" })
      .select("id")
      .single();
    if (insErr || !ins?.id) {
      await admin.storage.from(bucket()).remove([path]);
      return apiErrorSafe(insErr, 400, "Could not create verification row.");
    }
    verId = ins.id as string;
    const { error: docErr } = await insertVerificationDocument(admin, {
      verification_id: verId,
      user_id: user.id,
      item: newItem,
    });
    if (docErr) {
      await admin.storage.from(bucket()).remove([path]);
      await admin.from("verification").delete().eq("id", verId);
      return apiErrorSafe(docErr, 400);
    }
  }

  if (prior?.storage_path && prior.storage_path !== path) {
    const pb = prior.storage_bucket || bucket();
    await admin.storage.from(pb).remove([prior.storage_path]);
  }

  return apiSuccess("Queued for your account after payment succeeds. You can replace this file before you pay.", {
    path,
    docType,
  });
}
