import { randomUUID } from "crypto";

import { apiError, apiSuccess } from "@/lib/api/json-response";
import {
  CHECKOUT_KYC_STAGING_SETUP,
  isCheckoutKycStagingTableUnavailable,
} from "@/lib/kyc/checkout-staging-errors";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

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
    const msg = e instanceof Error ? e.message : "Server misconfiguration.";
    return apiError(msg, 503);
  }

  const { data: rows, error } = await admin
    .from("kyc_checkout_pending_documents")
    .select("doc_type")
    .eq("user_id", user.id);
  if (error) {
    if (isCheckoutKycStagingTableUnavailable(error)) {
      return apiSuccess("OK", { stagedDocTypes: [], checkoutKycStagingReady: false });
    }
    return apiError(error.message, 500);
  }
  const stagedDocTypes = (rows ?? []).map((r) => r.doc_type as string).filter(Boolean);
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
    const msg = e instanceof Error ? e.message : "Server misconfiguration.";
    return apiError(msg, 503);
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

  const { data: profRow, error: prErr } = await admin
    .from("profiles")
    .select("verification_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (prErr) {
    return apiError(prErr.message, 500);
  }
  const vStatus = (profRow?.verification_status ?? "none").toLowerCase();

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

  const { data: prior, error: priorErr } = await admin
    .from("kyc_checkout_pending_documents")
    .select("storage_bucket, storage_path")
    .eq("user_id", user.id)
    .eq("doc_type", docType)
    .maybeSingle();
  if (priorErr) {
    if (isCheckoutKycStagingTableUnavailable(priorErr)) {
      return apiError(`Checkout ID uploads are not available yet. ${CHECKOUT_KYC_STAGING_SETUP}`, 503, {
        hint: priorErr.message,
      });
    }
    return apiError(priorErr.message, 500);
  }

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
    return apiError(upErr.message, 502, {
      hint: "Create a private Storage bucket (e.g. kyc-private) and set KYC_STORAGE_BUCKET if different.",
    });
  }

  const { error: rowErr } = await admin.from("kyc_checkout_pending_documents").upsert(
    {
      user_id: user.id,
      doc_type: docType,
      storage_bucket: bucket(),
      storage_path: path,
      content_type: ct,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,doc_type" },
  );
  if (rowErr) {
    await admin.storage.from(bucket()).remove([path]);
    if (isCheckoutKycStagingTableUnavailable(rowErr)) {
      return apiError(`Checkout ID uploads are not available yet. ${CHECKOUT_KYC_STAGING_SETUP}`, 503, {
        hint: rowErr.message,
      });
    }
    return apiError(rowErr.message, 400);
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
