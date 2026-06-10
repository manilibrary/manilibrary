import type { SupabaseClient } from "@supabase/supabase-js";

import { PAYMENT_METADATA_COUPON_KEY } from "@/lib/coupons/library-coupons";
import { referralSignupUrl } from "@/lib/site-url";

/** Key under `payments.metadata` for credits applied at checkout. */
export const PAYMENT_METADATA_CREDITS_KEY = "credits";

/** Key under `payments.metadata` for signup referral kept at checkout. */
export const PAYMENT_METADATA_REFERRAL_KEY = "referral";

export const REFERRAL_CODE_RE = /^REF[0-9A-F]{6}$/;

export type ReferralSettings = {
  enabled: boolean;
  creditsPerReferral: number;
  maxPerMember: number;
};

export type ReferralSettingsRow = {
  referral_enabled: boolean;
  referral_credits_per_referral: number;
  referral_max_per_member: number;
};

export type MemberReferralSummary = {
  referralCode: string | null;
  creditBalance: number;
  referralsUsed: number;
  referralsMax: number;
  creditsPerReferral: number;
  enabled: boolean;
  memberFirstName: string | null;
  signupUrl: string | null;
};

/** Referral code the member used when signing up (pending first payment). */
export type RefereeSignupReferral = {
  id: string;
  code: string;
};

export type CheckoutReferralMeta = {
  applied: boolean;
  referralId?: string;
};

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidReferralCodeFormat(code: string): boolean {
  return REFERRAL_CODE_RE.test(normalizeReferralCode(code));
}

export async function loadReferralSettings(admin: SupabaseClient): Promise<ReferralSettings> {
  const { data } = await admin
    .from("library_settings")
    .select("referral_enabled, referral_credits_per_referral, referral_max_per_member")
    .eq("id", 1)
    .maybeSingle();

  const row = data as ReferralSettingsRow | null;
  return {
    enabled: row?.referral_enabled !== false,
    creditsPerReferral: Math.max(0, Number(row?.referral_credits_per_referral ?? 50)),
    maxPerMember: Math.max(0, Number(row?.referral_max_per_member ?? 5)),
  };
}

export async function countReferrerSlotsUsed(
  admin: SupabaseClient,
  referrerUserId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("member_referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", referrerUserId)
    .in("status", ["pending_payment", "credited"]);

  if (error) throw error;
  return count ?? 0;
}

export type ReferrerLookup =
  | { ok: true; referrerUserId: string }
  | { ok: false; error: string };

/** Validate a referral code for signup (referrer must be an active member, under cap). */
export async function lookupReferrerForSignup(
  admin: SupabaseClient,
  rawCode: string,
  refereeUserId?: string,
): Promise<ReferrerLookup> {
  const settings = await loadReferralSettings(admin);
  if (!settings.enabled) {
    return { ok: false, error: "Referrals are not available right now." };
  }

  const code = normalizeReferralCode(rawCode);
  if (!isValidReferralCodeFormat(code)) {
    return { ok: false, error: "Enter a valid referral code (REF followed by 6 characters)." };
  }

  const { data: referrer, error } = await admin
    .from("profiles")
    .select("user_id, is_admin, is_superadmin, referral_code")
    .eq("referral_code", code)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { ok: false, error: "Could not validate referral code." };
  if (!referrer) return { ok: false, error: "Referral code not found." };
  if (referrer.is_admin || referrer.is_superadmin) {
    return { ok: false, error: "That referral code is not valid." };
  }
  if (refereeUserId && referrer.user_id === refereeUserId) {
    return { ok: false, error: "You cannot use your own referral code." };
  }

  const used = await countReferrerSlotsUsed(admin, referrer.user_id);
  if (used >= settings.maxPerMember) {
    return { ok: false, error: "This referral code has reached its usage limit." };
  }

  return { ok: true, referrerUserId: referrer.user_id };
}

/** Link a new member to a referrer (pending until first paid membership). */
export async function attachReferralOnSignup(
  admin: SupabaseClient,
  refereeUserId: string,
  rawCode: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return { ok: true };

  const lookup = await lookupReferrerForSignup(admin, code, refereeUserId);
  if (!lookup.ok) return lookup;

  const { data: existing } = await admin
    .from("member_referrals")
    .select("id")
    .eq("referee_user_id", refereeUserId)
    .maybeSingle();

  if (existing) return { ok: true };

  const { error } = await admin.from("member_referrals").insert({
    referrer_user_id: lookup.referrerUserId,
    referee_user_id: refereeUserId,
    referral_code_used: code,
    status: "pending_payment",
  });

  if (error) {
    if (error.code === "23505") return { ok: true };
    return { ok: false, error: "Could not save referral code." };
  }

  return { ok: true };
}

export async function getRefereePendingReferral(
  admin: SupabaseClient,
  refereeUserId: string,
): Promise<RefereeSignupReferral | null> {
  const { data, error } = await admin
    .from("member_referrals")
    .select("id, referral_code_used")
    .eq("referee_user_id", refereeUserId)
    .eq("status", "pending_payment")
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id, code: data.referral_code_used };
}

export async function voidRefereePendingReferral(
  admin: SupabaseClient,
  refereeUserId: string,
): Promise<void> {
  await admin
    .from("member_referrals")
    .update({ status: "void" })
    .eq("referee_user_id", refereeUserId)
    .eq("status", "pending_payment");
}

/** Apply or void signup referral at checkout (mutually exclusive with coupons). */
export async function resolveCheckoutReferral(
  admin: SupabaseClient,
  refereeUserId: string,
  options: { applyReferral: boolean; hasCoupon: boolean },
): Promise<{ ok: true; meta: CheckoutReferralMeta | null } | { ok: false; error: string }> {
  const pending = await getRefereePendingReferral(admin, refereeUserId);
  if (!pending) return { ok: true, meta: null };

  if (options.hasCoupon && options.applyReferral) {
    return {
      ok: false,
      error: "Referral and coupon cannot be combined. Uncheck referral to use a coupon.",
    };
  }

  if (!options.applyReferral) {
    await voidRefereePendingReferral(admin, refereeUserId);
    return { ok: true, meta: { applied: false } };
  }

  return { ok: true, meta: { applied: true, referralId: pending.id } };
}

export async function getMemberReferralSummary(
  admin: SupabaseClient,
  userId: string,
): Promise<MemberReferralSummary | null> {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("referral_code, credit_balance, is_admin, is_superadmin, full_name")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !profile) return null;
  if (profile.is_admin || profile.is_superadmin) return null;

  const settings = await loadReferralSettings(admin);
  const used = await countReferrerSlotsUsed(admin, userId);

  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? null;

  const referralCode = profile.referral_code ?? null;

  return {
    referralCode,
    creditBalance: Math.max(0, Number(profile.credit_balance ?? 0)),
    referralsUsed: used,
    referralsMax: settings.maxPerMember,
    creditsPerReferral: settings.creditsPerReferral,
    enabled: settings.enabled,
    memberFirstName: firstName,
    signupUrl: referralCode ? referralSignupUrl(referralCode) : null,
  };
}

export function buildReferralShareMessage(input: {
  referralCode: string;
  signupUrl: string;
  libraryName?: string;
  memberFirstName?: string | null;
}): string {
  const library = input.libraryName ?? "Mani Library";
  const greeting = input.memberFirstName ? `Hey! It's ${input.memberFirstName}.` : "Hey!";
  return `${greeting} I'm studying at ${library}. Use my referral code ${input.referralCode} when you sign up — you'll get a great place to focus, and I earn credits when you join.\n\nSign up here: ${input.signupUrl}`;
}

/** Max credits applicable to an order (leave ₹1 minimum for Razorpay). */
export function maxRedeemableCredits(orderRupees: number, balance: number): number {
  if (orderRupees <= 1 || balance <= 0) return 0;
  return Math.min(balance, orderRupees - 1);
}

export type CreditApplyResult =
  | { ok: true; amountRupees: number; creditsApplied: number }
  | { ok: false; error: string };

export async function applyCreditsToOrderAmount(
  admin: SupabaseClient,
  userId: string,
  baseAmountRupees: number,
  requestedCredits: number,
  hasCoupon: boolean,
): Promise<CreditApplyResult> {
  if (requestedCredits <= 0) {
    return { ok: true, amountRupees: baseAmountRupees, creditsApplied: 0 };
  }
  if (hasCoupon) {
    return { ok: false, error: "Credits cannot be combined with a coupon on the same order." };
  }
  if (!Number.isInteger(requestedCredits) || requestedCredits < 0) {
    return { ok: false, error: "Invalid credit amount." };
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("credit_balance, is_admin, is_superadmin")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) return { ok: false, error: "Could not load your credit balance." };
  if (profile.is_admin || profile.is_superadmin) {
    return { ok: false, error: "Staff accounts cannot redeem credits." };
  }

  const balance = Math.max(0, Number(profile.credit_balance ?? 0));
  const creditsApplied = maxRedeemableCredits(baseAmountRupees, Math.min(requestedCredits, balance));
  if (creditsApplied <= 0) {
    return { ok: false, error: "No credits available to apply." };
  }

  return {
    ok: true,
    amountRupees: baseAmountRupees - creditsApplied,
    creditsApplied,
  };
}

/** Credit referrer when referee completes first paid membership. */
export async function creditReferrerOnFirstPayment(
  admin: SupabaseClient,
  refereeUserId: string,
  paymentId: string,
  paymentMetadata?: Record<string, unknown>,
): Promise<void> {
  const settings = await loadReferralSettings(admin);
  if (!settings.enabled || settings.creditsPerReferral <= 0) return;

  const meta = paymentMetadata ?? {};
  if (meta[PAYMENT_METADATA_COUPON_KEY]) return;

  const referralMeta = meta[PAYMENT_METADATA_REFERRAL_KEY] as CheckoutReferralMeta | undefined;
  if (referralMeta?.applied === false) return;

  const { data: referral, error: refErr } = await admin
    .from("member_referrals")
    .select("id, referrer_user_id, status")
    .eq("referee_user_id", refereeUserId)
    .eq("status", "pending_payment")
    .maybeSingle();

  if (refErr || !referral) return;

  const { data: otherPaid } = await admin
    .from("payments")
    .select("id")
    .eq("user_id", refereeUserId)
    .eq("status", "paid")
    .neq("id", paymentId)
    .limit(1);

  if (otherPaid && otherPaid.length > 0) return;

  const { data: referrer } = await admin
    .from("profiles")
    .select("user_id, credit_balance, is_admin, is_superadmin")
    .eq("user_id", referral.referrer_user_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!referrer || referrer.is_admin || referrer.is_superadmin) {
    await admin.from("member_referrals").update({ status: "void" }).eq("id", referral.id);
    return;
  }

  const usedSlots = await countReferrerSlotsUsed(admin, referral.referrer_user_id);
  if (usedSlots > settings.maxPerMember) {
    await admin.from("member_referrals").update({ status: "void" }).eq("id", referral.id);
    return;
  }

  const amount = settings.creditsPerReferral;
  const newBalance = Math.max(0, Number(referrer.credit_balance ?? 0)) + amount;
  const now = new Date().toISOString();

  const { error: upRef } = await admin
    .from("member_referrals")
    .update({
      status: "credited",
      credited_amount: amount,
      payment_id: paymentId,
      credited_at: now,
    })
    .eq("id", referral.id)
    .eq("status", "pending_payment");

  if (upRef) return;

  const { error: upBal } = await admin
    .from("profiles")
    .update({ credit_balance: newBalance })
    .eq("user_id", referral.referrer_user_id);

  if (upBal) return;

  await admin.from("member_credit_ledger").insert({
    user_id: referral.referrer_user_id,
    kind: "earn",
    amount_rupees: amount,
    balance_after: newBalance,
    referral_id: referral.id,
    payment_id: paymentId,
    note: "Referral reward",
  });
}

/** Deduct credits after payment is marked paid (metadata records amount). */
export async function redeemCreditsOnPayment(
  admin: SupabaseClient,
  userId: string,
  paymentId: string,
  creditsApplied: number,
): Promise<void> {
  if (creditsApplied <= 0) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("credit_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) return;

  const balance = Math.max(0, Number(profile.credit_balance ?? 0));
  const deduct = Math.min(creditsApplied, balance);
  if (deduct <= 0) return;

  const newBalance = balance - deduct;
  const now = new Date().toISOString();

  const { error: upBal } = await admin
    .from("profiles")
    .update({ credit_balance: newBalance })
    .eq("user_id", userId)
    .gte("credit_balance", deduct);

  if (upBal) return;

  await admin.from("member_credit_ledger").insert({
    user_id: userId,
    kind: "redeem",
    amount_rupees: deduct,
    balance_after: newBalance,
    payment_id: paymentId,
    note: "Applied at checkout",
  });
}
