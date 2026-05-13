import { randomUUID } from "crypto";

import { apiError, apiSuccess } from "@/lib/api/json-response";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

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
    const { data: pendReq, error: pendErr } = await admin
      .from("verification_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (pendErr) {
      return apiError(pendErr.message, 500);
    }
    if (!pendReq?.id) {
      return apiError("New uploads are not allowed right now.", 403, {
        hint: "No active verification request. Contact the library.",
      });
    }
    const { data: existingSlot, error: slotErr } = await admin
      .from("verification_documents")
      .select("id")
      .eq("verification_id", pendReq.id)
      .eq("doc_type", docType)
      .maybeSingle();
    if (slotErr) {
      return apiError(slotErr.message, 500);
    }
    if (existingSlot?.id) {
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
    return apiError(upErr.message, 502, {
      hint: "Create a private Storage bucket (e.g. kyc-private) and set KYC_STORAGE_BUCKET if different.",
    });
  }

  const { data: existing } = await admin
    .from("verification_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  let verificationId: string;
  if (existing?.id) {
    verificationId = existing.id;
  } else {
    const { data: ins, error: insErr } = await admin
      .from("verification_requests")
      .insert({ user_id: user.id, status: "pending" })
      .select("id")
      .single();
    if (insErr || !ins) {
      await admin.storage.from(bucket()).remove([path]);
      return apiError(insErr?.message ?? "Could not create verification request.", 400);
    }
    verificationId = ins.id;
  }

  await admin.from("verification_documents").delete().eq("verification_id", verificationId).eq("doc_type", docType);

  const { error: docErr } = await admin.from("verification_documents").insert({
    verification_id: verificationId,
    doc_type: docType,
    storage_bucket: bucket(),
    storage_path: path,
    content_type: ct,
  });
  if (docErr) {
    return apiError(docErr.message, 400);
  }

  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({
      verification_status: "pending",
      verification_submitted_at: now,
    })
    .eq("user_id", user.id);

  return apiSuccess("KYC document uploaded; profile set to pending review.", { path, docType });
}
