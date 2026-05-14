import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_LIBRARY_TZ,
  addDaysYmd,
  addWallClockHours,
  isOnOrAfterYmd,
  longTermInclusiveUntil,
  membershipDayStartIso,
  todayYmdInTz,
} from "@/lib/membership/windows";
import { formatMemberSeatToken, resolveMemberSeatDisplayLabel } from "@/lib/membership/seat-label";
import {
  type MembershipPlanKind,
  resolveLongTermDuration,
  resolveShortTermDuration,
} from "@/lib/payments/pricing";

import { createMemberAccount } from "./create-member-account";

export const MANUAL_PAYMENT_METHODS = ["cash", "upi_external", "bank_transfer", "card_terminal", "other"] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export function isManualPaymentMethod(v: string): v is ManualPaymentMethod {
  return (MANUAL_PAYMENT_METHODS as readonly string[]).includes(v);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_ADVANCE_DAYS = 120;
const MAX_PAST_START_DAYS = 90;

export type ManualEnrollMemberInput = {
  existing_user_id?: string | null;
  full_name: string;
  email: string;
  phone?: string;
  password?: string;
  plan_kind: MembershipPlanKind;
  seat_number: number;
  membership_start_date: string;
  duration_key: string;
  amount_rupees: number;
  payment_method: ManualPaymentMethod;
  external_reference?: string;
  staff_note?: string;
  mark_kyc_verified?: boolean;
  recorded_by_user_id: string;
};

export type ManualEnrollMemberResult =
  | {
      ok: true;
      user_id: string;
      device_user_id: number;
      membership_id: string;
      payment_id: string;
      temporary_password?: string;
    }
  | { ok: false; status: number; message: string };

export async function manualEnrollMember(
  admin: SupabaseClient,
  input: ManualEnrollMemberInput,
): Promise<ManualEnrollMemberResult> {
  const tz = DEFAULT_LIBRARY_TZ;
  const today = todayYmdInTz(tz);
  const floor = addDaysYmd(today, -MAX_PAST_START_DAYS);
  const maxStart = addDaysYmd(today, MAX_ADVANCE_DAYS);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.membership_start_date)) {
    return { ok: false, status: 400, message: "membership_start_date must be YYYY-MM-DD." };
  }
  if (!isOnOrAfterYmd(input.membership_start_date, floor) || input.membership_start_date > maxStart) {
    return {
      ok: false,
      status: 400,
      message: `Start date must be on or after ${floor} and not after ${maxStart} (library calendar).`,
    };
  }

  const ar = Math.round(Number(input.amount_rupees));
  if (!Number.isFinite(ar) || ar < 1 || ar > 99_999_999) {
    return { ok: false, status: 400, message: "amount_rupees must be a whole number between 1 and 99999999." };
  }

  const seat = Math.round(Number(input.seat_number));
  if (!Number.isFinite(seat) || seat < 1 || seat > 9999) {
    return { ok: false, status: 400, message: "seat_number must be an integer between 1 and 9999." };
  }

  const seatToken = formatMemberSeatToken(input.plan_kind, seat);

  let userId: string;
  let deviceUserId: number;
  let temporaryPassword: string | undefined;
  let createdNewAuthUser = false;

  const existing = input.existing_user_id?.trim() ?? "";
  if (existing) {
    if (!UUID_RE.test(existing)) {
      return { ok: false, status: 400, message: "existing_user_id must be a valid UUID." };
    }
    const { data: prof, error: pe } = await admin
      .from("profiles")
      .select("user_id, device_user_id, is_admin, is_superadmin")
      .eq("user_id", existing)
      .is("deleted_at", null)
      .maybeSingle();
    if (pe || !prof) {
      return { ok: false, status: 404, message: "No active profile found for that user id." };
    }
    if (prof.is_admin === true || prof.is_superadmin === true) {
      return { ok: false, status: 400, message: "Cannot attach manual memberships to admin or superadmin accounts." };
    }
    userId = prof.user_id;
    deviceUserId = prof.device_user_id as number;
  } else {
    const acc = await createMemberAccount(admin, {
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      password: input.password,
    });
    if (!acc.ok) {
      return { ok: false, status: 400, message: acc.message };
    }
    userId = acc.user_id;
    deviceUserId = acc.device_user_id;
    temporaryPassword = acc.temporary_password;
    createdNewAuthUser = true;
  }

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const { data: existingActive, error: existingErr } = await admin
    .from("memberships")
    .select("id, plan_kind, seat_number, valid_until, ends_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .or(
      `and(plan_kind.eq.long_term,valid_until.gte.${todayIso}),and(plan_kind.eq.short_term,ends_at.gte.${now.toISOString()})`,
    )
    .limit(1)
    .maybeSingle();

  if (existingErr && existingErr.code !== "PGRST116") {
    if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
    return { ok: false, status: 500, message: existingErr.message };
  }
  if (existingActive) {
    if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
    const until =
      existingActive.plan_kind === "long_term"
        ? existingActive.valid_until
        : existingActive.ends_at;
    return {
      ok: false,
      status: 409,
      message: `This member already has an active ${String(existingActive.plan_kind).replace(/_/g, " ")} membership on seat ${resolveMemberSeatDisplayLabel({
        plan_kind: String(existingActive.plan_kind),
        seat_number: existingActive.seat_number as string | number | null,
      })} (until ${until}).`,
    };
  }

  let membershipId: string;
  const notes = `duration:${input.duration_key};manual_enroll`;

  try {
    if (input.plan_kind === "short_term") {
      const dur = resolveShortTermDuration(input.duration_key);
      if (!dur) {
        if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
        return { ok: false, status: 400, message: "Invalid duration_key for short_term plan." };
      }
      const startsIso = membershipDayStartIso(input.membership_start_date, tz);
      const endsIso = addWallClockHours(startsIso, dur.durationHours);
      const { data: mem, error: mErr } = await admin
        .from("memberships")
        .insert({
          user_id: userId,
          plan_kind: "short_term",
          status: "active",
          seat_number: seatToken,
          starts_at: startsIso,
          ends_at: endsIso,
          notes,
        })
        .select("id")
        .single();
      if (mErr || !mem) {
        if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
        const code = (mErr as { code?: string } | null)?.code;
        if (code === "23P01") {
          return {
            ok: false,
            status: 409,
            message: "Seat overlaps another active membership for those dates. Pick another seat or window.",
          };
        }
        return { ok: false, status: 400, message: mErr?.message ?? "Could not create membership." };
      }
      membershipId = mem.id;
    } else {
      const dur = resolveLongTermDuration(input.duration_key);
      if (!dur) {
        if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
        return { ok: false, status: 400, message: "Invalid duration_key for long_term plan." };
      }
      const validFrom = input.membership_start_date;
      const validUntil = longTermInclusiveUntil(validFrom, dur.calendarMonths);
      const { data: mem, error: mErr } = await admin
        .from("memberships")
        .insert({
          user_id: userId,
          plan_kind: "long_term",
          status: "active",
          seat_number: seatToken,
          valid_from: validFrom,
          valid_until: validUntil,
          notes,
        })
        .select("id")
        .single();
      if (mErr || !mem) {
        if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
        const code = (mErr as { code?: string } | null)?.code;
        if (code === "23P01") {
          return {
            ok: false,
            status: 409,
            message: "Seat overlaps another active membership for those dates. Pick another seat or window.",
          };
        }
        return { ok: false, status: 400, message: mErr?.message ?? "Could not create membership." };
      }
      membershipId = mem.id;
    }

    const extRef = (input.external_reference ?? "").trim().slice(0, 500);
    const staffNote = (input.staff_note ?? "").trim().slice(0, 2000);
    const metadata: Record<string, unknown> = {
      manual_enrollment: true,
      manual_payment_method: input.payment_method,
      ...(extRef ? { external_reference: extRef } : {}),
      ...(staffNote ? { staff_note: staffNote } : {}),
      recorded_by_user_id: input.recorded_by_user_id,
      recorded_at: new Date().toISOString(),
    };

    const { data: pay, error: pErr } = await admin
      .from("payments")
      .insert({
        user_id: userId,
        membership_id: membershipId,
        amount_rupees: ar,
        currency: "INR",
        provider: "manual",
        provider_payment_id: extRef || null,
        status: "paid",
        metadata,
      })
      .select("id")
      .single();

    if (pErr || !pay) {
      await admin.from("memberships").delete().eq("id", membershipId);
      if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
      return { ok: false, status: 400, message: pErr?.message ?? "Could not record payment." };
    }

    const { error: linkErr } = await admin.from("memberships").update({ payment_id: pay.id }).eq("id", membershipId);
    if (linkErr) {
      await admin.from("payments").delete().eq("id", pay.id);
      await admin.from("memberships").delete().eq("id", membershipId);
      if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
      return { ok: false, status: 500, message: linkErr.message };
    }

    if (input.mark_kyc_verified === true) {
      await admin
        .from("profiles")
        .update({ is_verified: true, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    return {
      ok: true,
      user_id: userId,
      device_user_id: deviceUserId,
      membership_id: membershipId,
      payment_id: pay.id,
      ...(temporaryPassword ? { temporary_password: temporaryPassword } : {}),
    };
  } catch (e) {
    if (createdNewAuthUser) await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      status: 500,
      message: e instanceof Error ? e.message : "Manual enrollment failed.",
    };
  }
}
