import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hard-delete a member and their Auth user. Call only from superadmin API.
 * Runs explicit cleanup for tables without FK cascade to `auth.users` / `profiles`,
 * removes private KYC objects, then `auth.admin.deleteUser` (cascades the rest).
 * Optional tables `device_api_records` and `etime_empcode_map` are not cleaned here
 * (dropped by `supabase/drop-optional-unused-tables.sql` if unused).
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
  const membershipIds = (memRows ?? []).map((m) => (m as { id: string }).id).filter(Boolean);
  if (membershipIds.length > 0) {
    const { error: e1 } = await admin.from("membership_events").delete().in("membership_id", membershipIds);
    if (e1) {
      return { ok: false, message: e1.message };
    }
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
