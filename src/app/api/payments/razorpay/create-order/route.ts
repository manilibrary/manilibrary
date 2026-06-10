import Razorpay from "razorpay";

import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import {
  DEFAULT_LIBRARY_TZ,
  addDaysYmd,
  addWallClockHours,
  isOnOrAfterYmd,
  longTermInclusiveUntil,
  membershipDayStartIso,
  todayYmdInTz,
} from "@/lib/membership/windows";
import {
  LONG_TERM_DURATION_OPTIONS,
  computeOrderAmountRupees,
  resolveLongTermDuration,
  resolveShortTermDuration,
  rupeesToRazorpayPaise,
  SHORT_TERM_DURATION_OPTIONS,
  type MembershipPlanKind,
} from "@/lib/payments/pricing";
import {
  PAYMENT_METADATA_COUPON_KEY,
  applyCouponDiscount,
  fetchActiveCouponForPlan,
} from "@/lib/coupons/library-coupons";
import {
  PAYMENT_METADATA_CREDITS_KEY,
  PAYMENT_METADATA_REFERRAL_KEY,
  applyCreditsToOrderAmount,
  resolveCheckoutReferral,
} from "@/lib/referrals/library-referrals";
import { formatMembershipEndForDisplay } from "@/lib/date-format";
import { membershipHostedCheckoutUrl } from "@/lib/payments/hosted-checkout-url";
import {
  PAYMENT_METADATA_PLANNED_SEAT_KEY,
  PENDING_MEMBERSHIP_SEAT_PLACEHOLDER,
  formatMemberSeatToken,
  resolveMemberSeatDisplayLabel,
} from "@/lib/membership/seat-label";
import { requireMemberNotStaffForRazorpay } from "@/lib/payments/require-member-razorpay";
import {
  isPlanMonths,
  resolvePlanCheckout,
  type PlanShift,
} from "@/lib/plans/plan-checkout";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const MAX_ADVANCE_BOOKING_DAYS = 120;

function isPlanKind(v: unknown): v is MembershipPlanKind {
  return v === "short_term" || v === "long_term";
}

type PreparedMembership = {
  planKind: MembershipPlanKind;
  amountRupees: number;
  insert: Record<string, unknown>;
  plannedSeatToken: string;
};

export async function POST(request: Request) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return apiError("Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET).", 503);
  }

  const tz = DEFAULT_LIBRARY_TZ;
  const today = todayYmdInTz(tz);

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Expected JSON body.", 400);
  }

  const usePlanCode = typeof raw.planCode === "string";

  if (
    typeof raw.seatNumber !== "number" ||
    !Number.isFinite(raw.seatNumber) ||
    typeof raw.membershipStartDate !== "string"
  ) {
    return apiError("Invalid body: seatNumber and membershipStartDate (YYYY-MM-DD) required.", 400);
  }
  const seatNumber = Math.round(raw.seatNumber);
  const membershipStartDate = raw.membershipStartDate.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(membershipStartDate)) {
    return apiError("membershipStartDate must be YYYY-MM-DD.", 400);
  }
  if (!isOnOrAfterYmd(membershipStartDate, today)) {
    return apiError(`Membership must start on or after today (${today} in ${tz}).`, 400);
  }
  const maxStart = addDaysYmd(today, MAX_ADVANCE_BOOKING_DAYS);
  if (membershipStartDate > maxStart) {
    return apiError(`Start date cannot be more than ${MAX_ADVANCE_BOOKING_DAYS} days ahead.`, 400);
  }

  const gate = await requireMemberNotStaffForRazorpay(request);
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }
  const userId = gate.userId;

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Could not create Supabase admin client.");
  }

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const { data: existingActive, error: existingErr } = await admin
    .from("memberships")
    .select("id, plan_kind, seat_number, valid_until, ends_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`valid_until.gte.${todayIso},ends_at.gte.${now.toISOString()}`)
    .limit(1)
    .maybeSingle();

  if (existingErr && existingErr.code !== "PGRST116") {
    return apiErrorSafe(existingErr, 500);
  }
  if (existingActive) {
    const until = formatMembershipEndForDisplay(
      String(existingActive.plan_kind),
      existingActive.valid_until,
      existingActive.ends_at,
    );
    return apiError(
      `You already have an active ${String(existingActive.plan_kind).replace(/_/g, " ")} membership on seat ${resolveMemberSeatDisplayLabel({
        plan_kind: String(existingActive.plan_kind),
        seat_number: existingActive.seat_number as string | number | null,
      })} (until ${until}). Wait for it to expire, or contact the library to cancel.`,
      409,
    );
  }

  let prepared: PreparedMembership;
  let couponMeta: { id: string; code: string; discount_percent: number } | null = null;
  let referralMeta: { applied: boolean; referralId?: string } | null = null;
  let creditsApplied = 0;
  const applyReferral = raw.applyReferral !== false;
  const creditsRequested =
    typeof raw.creditsToApply === "number"
      ? Math.round(raw.creditsToApply)
      : typeof raw.creditsToApply === "string"
        ? Math.round(Number(raw.creditsToApply))
        : 0;

  if (usePlanCode) {
    const months = typeof raw.months === "number" ? raw.months : Number(raw.months);
    if (!isPlanMonths(months)) {
      return apiError("months must be 1, 3, or 6.", 400);
    }
    const resolved = await resolvePlanCheckout(admin, (raw.planCode as string).trim(), months);
    if (!resolved) {
      return apiError("Unknown or inactive plan.", 400);
    }

    let amountRupees = resolved.priceRupees;
    if (typeof raw.couponCode === "string" && raw.couponCode.trim()) {
      const check = await fetchActiveCouponForPlan(admin, raw.couponCode, resolved.code);
      if (!check.ok) return apiError(check.error, 400);
      amountRupees = applyCouponDiscount(resolved.priceRupees, check.coupon.discount_percent);
      couponMeta = {
        id: check.coupon.id,
        code: check.coupon.code,
        discount_percent: check.coupon.discount_percent,
      };
    }

    const referralResult = await resolveCheckoutReferral(admin, userId, {
      applyReferral,
      hasCoupon: couponMeta != null,
    });
    if (!referralResult.ok) return apiError(referralResult.error, 400);
    referralMeta = referralResult.meta;

    if (creditsRequested > 0) {
      const creditResult = await applyCreditsToOrderAmount(
        admin,
        userId,
        amountRupees,
        creditsRequested,
        couponMeta != null,
      );
      if (!creditResult.ok) return apiError(creditResult.error, 400);
      amountRupees = creditResult.amountRupees;
      creditsApplied = creditResult.creditsApplied;
    }

    const validUntil = longTermInclusiveUntil(membershipStartDate, resolved.months);
    const shift: PlanShift | null = resolved.shift;
    prepared = {
      planKind: resolved.planKind,
      amountRupees,
      plannedSeatToken: formatMemberSeatToken(resolved.planKind, seatNumber),
      insert: {
        user_id: userId,
        plan_kind: resolved.planKind,
        plan_code: resolved.code,
        shift,
        status: "pending_payment",
        seat_number: PENDING_MEMBERSHIP_SEAT_PLACEHOLDER,
        valid_from: membershipStartDate,
        valid_until: validUntil,
        notes: `plan:${resolved.code} duration:${resolved.months}m`,
      },
    };
  } else {
    if (!isPlanKind(raw.planKind) || typeof raw.durationKey !== "string") {
      return apiError("Invalid body: planKind and durationKey required.", 400);
    }
    const planKind = raw.planKind;
    const durationKey = raw.durationKey.trim();
    const amountRupees = computeOrderAmountRupees(planKind, durationKey);
    if (amountRupees == null || !Number.isFinite(amountRupees) || amountRupees <= 0) {
      return apiError("Invalid plan duration for checkout.", 400);
    }
    if (planKind === "short_term") {
      const dur = resolveShortTermDuration(durationKey);
      if (!dur) {
        return apiError(
          `Invalid durationKey for short-term. Use one of: ${SHORT_TERM_DURATION_OPTIONS.map((o) => o.key).join(", ")}.`,
          400,
        );
      }
      const startsIso = membershipDayStartIso(membershipStartDate, tz);
      const endsIso = addWallClockHours(startsIso, dur.durationHours);
      prepared = {
        planKind,
        amountRupees,
        plannedSeatToken: formatMemberSeatToken("short_term", seatNumber),
        insert: {
          user_id: userId,
          plan_kind: "short_term",
          status: "pending_payment",
          seat_number: PENDING_MEMBERSHIP_SEAT_PLACEHOLDER,
          starts_at: startsIso,
          ends_at: endsIso,
          notes: `duration:${dur.key}`,
        },
      };
    } else {
      const dur = resolveLongTermDuration(durationKey);
      if (!dur) {
        return apiError(
          `Invalid durationKey for long-term. Use one of: ${LONG_TERM_DURATION_OPTIONS.map((o) => o.key).join(", ")}.`,
          400,
        );
      }
      const validUntil = longTermInclusiveUntil(membershipStartDate, dur.calendarMonths);
      prepared = {
        planKind,
        amountRupees,
        plannedSeatToken: formatMemberSeatToken("long_term", seatNumber),
        insert: {
          user_id: userId,
          plan_kind: "long_term",
          status: "pending_payment",
          seat_number: PENDING_MEMBERSHIP_SEAT_PLACEHOLDER,
          valid_from: membershipStartDate,
          valid_until: validUntil,
          notes: `duration:${dur.key}`,
        },
      };
    }
  }

  const amountRupees = prepared.amountRupees;
  const amountPaise = rupeesToRazorpayPaise(amountRupees);
  const plannedSeatToken = prepared.plannedSeatToken;

  const memRes = await admin.from("memberships").insert(prepared.insert).select("id").single();
  const membership = memRes.data;
  const memErr = memRes.error;

  if (memErr || !membership) {
    const maybeCode = (memErr as unknown as { code?: string } | null)?.code;
    if (maybeCode === "23P01") {
      return apiError(
        `Seat ${seatNumber} is already taken for these dates/shift. Please pick another seat or dates.`,
        409,
      );
    }
    return apiErrorSafe(
      memErr,
      400,
      "Could not create membership. Check your dates and seat, or try again later.",
    );
  }

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      user_id: userId,
      membership_id: membership.id,
      amount_rupees: amountRupees,
      currency: "INR",
      provider: "razorpay",
      status: "pending",
      metadata: {
        [PAYMENT_METADATA_PLANNED_SEAT_KEY]: plannedSeatToken,
        ...(couponMeta ? { [PAYMENT_METADATA_COUPON_KEY]: couponMeta } : {}),
        ...(referralMeta ? { [PAYMENT_METADATA_REFERRAL_KEY]: referralMeta } : {}),
        ...(creditsApplied > 0 ? { [PAYMENT_METADATA_CREDITS_KEY]: { amount: creditsApplied } } : {}),
      },
    })
    .select("id")
    .single();

  if (payErr || !payment) {
    return apiErrorSafe(payErr, 400, "Could not create payment row.");
  }

  const receipt = payment.id.replace(/-/g, "").slice(0, 40);

  let order: { id: string; amount: number; currency: string };
  try {
    const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
    order = (await rz.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        payment_id: payment.id,
        membership_id: membership.id,
        user_id: userId,
      },
    })) as { id: string; amount: number; currency: string };
  } catch (e) {
    return apiErrorSafe(e, 502, "Payment provider could not create the order. Try again in a moment.");
  }

  const { error: metaErr } = await admin
    .from("payments")
    .update({
      metadata: {
        [PAYMENT_METADATA_PLANNED_SEAT_KEY]: plannedSeatToken,
        ...(couponMeta ? { [PAYMENT_METADATA_COUPON_KEY]: couponMeta } : {}),
        ...(referralMeta ? { [PAYMENT_METADATA_REFERRAL_KEY]: referralMeta } : {}),
        ...(creditsApplied > 0 ? { [PAYMENT_METADATA_CREDITS_KEY]: { amount: creditsApplied } } : {}),
        razorpay_order_id: order.id,
      },
      provider_payment_id: order.id,
    })
    .eq("id", payment.id);

  if (metaErr) {
    return apiError("Order created but failed to save Razorpay order id on payment.", 500, {
      razorpayOrderId: order.id,
      paymentId: payment.id,
    });
  }

  await admin.from("memberships").update({ payment_id: payment.id }).eq("id", membership.id);

  const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? keyId;

  return apiSuccess("Membership and Razorpay checkout order created. Complete payment in Razorpay UI.", {
    keyId: publicKey,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    paymentId: payment.id,
    membershipId: membership.id,
    hostedCheckoutUrl: membershipHostedCheckoutUrl(payment.id, request),
  });
}
