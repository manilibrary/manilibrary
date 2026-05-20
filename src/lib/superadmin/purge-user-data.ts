import type { SupabaseClient } from "@supabase/supabase-js";

type PurgeResult = { ok: true } | { ok: false; message: string };

/**
 * Permanently removes one membership and all rows that reference it.
 * Does not touch `profiles` or `auth.users`.
 */
export async function purgeMembershipCompletely(
  admin: SupabaseClient,
  membershipId: string,
): Promise<PurgeResult> {
  const { data: row, error: fe } = await admin
    .from("memberships")
    .select("id, payment_id")
    .eq("id", membershipId)
    .maybeSingle();

  if (fe) {
    return { ok: false, message: fe.message };
  }
  if (!row) {
    return { ok: false, message: "Membership not found." };
  }

  const paymentId = row.payment_id as string | null;

  const { error: delEventsBefore } = await admin
    .from("membership_events")
    .delete()
    .eq("membership_id", membershipId);
  if (delEventsBefore) {
    return { ok: false, message: delEventsBefore.message };
  }

  const { error: clearPay } = await admin.from("memberships").update({ payment_id: null }).eq("id", membershipId);
  if (clearPay) {
    return { ok: false, message: clearPay.message };
  }

  const { error: delByMembership } = await admin.from("payments").delete().eq("membership_id", membershipId);
  if (delByMembership) {
    return { ok: false, message: delByMembership.message };
  }

  if (paymentId) {
    const { error: delPay } = await admin.from("payments").delete().eq("id", paymentId);
    if (delPay) {
      return { ok: false, message: delPay.message };
    }
  }

  const { error: delMem } = await admin.from("memberships").delete().eq("id", membershipId);
  if (delMem) {
    return { ok: false, message: delMem.message };
  }

  const { error: delEventsAfter } = await admin
    .from("membership_events")
    .delete()
    .eq("membership_id", membershipId);
  if (delEventsAfter) {
    return { ok: false, message: delEventsAfter.message };
  }

  return { ok: true };
}

/**
 * Deletes a payment and, when it was a checkout draft, removes the linked membership
 * and its event history. Does not touch profile or Auth.
 */
export async function purgePaymentCompletely(
  admin: SupabaseClient,
  paymentId: string,
): Promise<PurgeResult> {
  const { data: pay, error: pe } = await admin
    .from("payments")
    .select("id, membership_id, status")
    .eq("id", paymentId)
    .maybeSingle();

  if (pe) {
    return { ok: false, message: pe.message };
  }
  if (!pay) {
    return { ok: false, message: "Payment not found." };
  }

  const membershipId = pay.membership_id as string | null;
  let membershipStatus: string | null = null;
  if (membershipId) {
    const { data: mem, error: me } = await admin
      .from("memberships")
      .select("status")
      .eq("id", membershipId)
      .maybeSingle();
    if (me) {
      return { ok: false, message: me.message };
    }
    membershipStatus = (mem?.status as string | null) ?? null;
  }

  const { error: delPay } = await admin.from("payments").delete().eq("id", paymentId);
  if (delPay) {
    return { ok: false, message: delPay.message };
  }

  if (!membershipId) {
    return { ok: true };
  }

  const { count, error: ce } = await admin
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("membership_id", membershipId);
  if (ce) {
    return { ok: false, message: ce.message };
  }

  const draftMembership =
    membershipStatus === "pending_payment" || membershipStatus === "cancelled";
  const paymentWasOpen = pay.status === "pending" || pay.status === "failed";

  if ((count ?? 0) === 0 && draftMembership && paymentWasOpen) {
    return purgeMembershipCompletely(admin, membershipId);
  }

  return { ok: true };
}

/**
 * Hard-delete a member and their Auth user. Call only from superadmin API.
 * Removes all library data linked to the profile (memberships, payments, KYC,
 * storage objects, export audit, device punch rows, etc.), then deletes Auth
 * (cascades profile + verification rows).
 */
export async function purgeLibraryUserCompletely(
  admin: SupabaseClient,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: profile, error: pe } = await admin
    .from("profiles")
    .select("device_user_id, avatar_url, is_superadmin")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (pe) {
    return { ok: false, message: pe.message };
  }
  if (!profile) {
    return { ok: false, message: "Profile not found for this user id." };
  }

  if (profile.is_superadmin === true) {
    const { count, error: cErr } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_superadmin", true)
      .is("deleted_at", null);
    if (cErr) {
      return { ok: false, message: cErr.message };
    }
    if ((count ?? 0) <= 1) {
      return { ok: false, message: "Cannot delete the only library superadmin account." };
    }
  }

  const deviceUserId = profile.device_user_id as number;
  const avatarUrl = profile.avatar_url as string | null;

  const { data: kycRows, error: ve } = await admin
    .from("verification_documents")
    .select("storage_bucket, storage_path")
    .eq("user_id", targetUserId);
  if (ve) {
    return { ok: false, message: ve.message };
  }
  for (const row of kycRows ?? []) {
    const o = row as { storage_bucket?: string | null; storage_path?: string };
    const bucket = o.storage_bucket?.trim() || "kyc-private";
    const path = o.storage_path;
    if (!path) continue;
    const { error: se } = await admin.storage.from(bucket).remove([path]);
    if (se && !/not found|No such object|Bucket not found/i.test(se.message)) {
      return { ok: false, message: `Storage remove failed (${bucket}): ${se.message}` };
    }
  }

  if (avatarUrl && avatarUrl.includes("/storage/v1/object/public/")) {
    try {
      const u = new URL(avatarUrl);
      const marker = "/object/public/";
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        const rest = u.pathname.slice(idx + marker.length);
        const slash = rest.indexOf("/");
        if (slash > 0) {
          const bucket = rest.slice(0, slash);
          const path = decodeURIComponent(rest.slice(slash + 1));
          if (bucket && path) {
            await admin.storage.from(bucket).remove([path]);
          }
        }
      }
    } catch {
      // best-effort avatar cleanup
    }
  }

  const { data: memRows, error: me } = await admin.from("memberships").select("id").eq("user_id", targetUserId);
  if (me) {
    return { ok: false, message: me.message };
  }
  for (const m of memRows ?? []) {
    const id = (m as { id: string }).id;
    if (!id) continue;
    const result = await purgeMembershipCompletely(admin, id);
    if (!result.ok) {
      return result;
    }
  }

  const { error: delRemainingPayments } = await admin.from("payments").delete().eq("user_id", targetUserId);
  if (delRemainingPayments) {
    return { ok: false, message: delRemainingPayments.message };
  }

  const { error: e2 } = await admin.from("membership_events").delete().eq("user_id", targetUserId);
  if (e2) {
    return { ok: false, message: e2.message };
  }
  const { error: e3 } = await admin.from("membership_events").delete().eq("changed_by", targetUserId);
  if (e3) {
    return { ok: false, message: e3.message };
  }

  const { error: le } = await admin.from("library_export_audit").delete().eq("device_user_id", deviceUserId);
  if (le) {
    return { ok: false, message: le.message };
  }

  const { error: ad } = await admin
    .from("attendance_days")
    .update({
      processed_by_user_id: null,
      processed_by_device_user_id: null,
      processed_by_full_name: null,
    })
    .or(`processed_by_user_id.eq.${targetUserId},processed_by_device_user_id.eq.${deviceUserId}`);
  if (ad) {
    return { ok: false, message: ad.message };
  }

  const { error: authErr } = await admin.auth.admin.deleteUser(targetUserId);
  if (authErr) {
    return { ok: false, message: authErr.message };
  }

  return { ok: true };
}
