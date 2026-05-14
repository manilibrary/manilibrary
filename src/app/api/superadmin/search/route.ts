import { apiError, apiSuccess, apiErrorSafe } from "@/lib/api/json-response";
import { formatProfileMemberLabel } from "@/lib/membership/profile-label";
import { extrasToDisplayFields } from "@/lib/profiles/profile-extras";
import { requireLibrarySuperAdmin } from "@/lib/supabase/require-library-super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { deriveUiVerificationStatus, mapLatestVerificationWithDocsByUserId } from "@/lib/verification/verification-repo";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROFILE_SEARCH_SELECT =
  "user_id, full_name, device_user_id, email, is_admin, is_superadmin, is_verified, profile_extras";

function safeIlikeFragment(s: string): string {
  return s.replace(/%/g, "").replace(/,/g, "").trim().slice(0, 120);
}

export async function GET(request: Request) {
  const gate = await requireLibrarySuperAdmin();
  if (!gate.ok) {
    return apiError(gate.message, gate.status);
  }

  const qRaw = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!qRaw) {
    return apiSuccess("Enter a search query.", { memberships: [], profiles: [], payments: [] });
  }

  let admin;
  try {
    admin = createSupabaseServiceRoleClient();
  } catch (e) {
    return apiErrorSafe(e, 503, "Server configuration error.");
  }

  type Mem = Record<string, unknown>;
  type Prof = Record<string, unknown>;
  type Pay = Record<string, unknown>;

  const memberships: Mem[] = [];
  const profiles: Prof[] = [];
  const payments: Pay[] = [];

  const pushProf = (p: Prof | null) => {
    if (!p?.user_id) return;
    if (profiles.some((x) => x.user_id === p.user_id)) return;
    profiles.push(p);
  };
  const pushMem = (m: Mem | null) => {
    if (!m?.id) return;
    if (memberships.some((x) => x.id === m.id)) return;
    memberships.push(m);
  };
  const pushPay = (p: Pay | null) => {
    if (!p?.id) return;
    if (payments.some((x) => x.id === p.id)) return;
    payments.push(p);
  };

  if (UUID_RE.test(qRaw)) {
    const [mem, pay, prof] = await Promise.all([
      admin
        .from("memberships")
        .select(
          "id, user_id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, payment_id, created_at",
        )
        .eq("id", qRaw)
        .maybeSingle(),
      admin
        .from("payments")
        .select(
          "id, user_id, membership_id, amount_rupees, status, provider, provider_payment_id, created_at",
        )
        .eq("id", qRaw)
        .maybeSingle(),
      admin
        .from("profiles")
        .select(PROFILE_SEARCH_SELECT)
        .eq("user_id", qRaw)
        .maybeSingle(),
    ]);
    pushMem(mem.data as Mem | null);
    pushPay(pay.data as Pay | null);
    pushProf(prof.data as Prof | null);
  }

  if (qRaw.includes("@")) {
    const frag = safeIlikeFragment(qRaw);
    if (frag.length >= 3) {
      const { data } = await admin
        .from("profiles")
        .select(PROFILE_SEARCH_SELECT)
        .ilike("email", `%${frag}%`)
        .limit(15);
      for (const p of data ?? []) pushProf(p as Prof);
    }
  }

  if (/^\d{1,4}$/.test(qRaw)) {
    const n = parseInt(qRaw, 10);
    const { data: profs } = await admin
      .from("profiles")
      .select(PROFILE_SEARCH_SELECT)
      .eq("device_user_id", n)
      .limit(20);
    for (const p of profs ?? []) pushProf(p as Prof);
    const ids = (profs ?? []).map((p) => p.user_id).filter(Boolean);
    if (ids.length > 0) {
      const { data: mems } = await admin
        .from("memberships")
        .select(
          "id, user_id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, payment_id, created_at",
        )
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(40);
      for (const m of mems ?? []) pushMem(m as Mem);
    }
  }

  if (qRaw.startsWith("pay_")) {
    const { data: byProv } = await admin
      .from("payments")
      .select(
        "id, user_id, membership_id, amount_rupees, status, provider, provider_payment_id, created_at",
      )
      .eq("provider_payment_id", qRaw)
      .limit(5);
    for (const p of byProv ?? []) pushPay(p as Pay);
  }

  if (memberships.length === 0 && profiles.length === 0 && payments.length === 0 && qRaw.length >= 8) {
    const { data: fuzzyPay } = await admin
      .from("payments")
      .select(
        "id, user_id, membership_id, amount_rupees, status, provider, provider_payment_id, created_at",
      )
      .ilike("provider_payment_id", `%${safeIlikeFragment(qRaw)}%`)
      .limit(10);
    for (const p of fuzzyPay ?? []) pushPay(p as Pay);
  }

  const labelUserIds = new Set<string>();
  for (const m of memberships) {
    const uid = m.user_id as string | undefined;
    if (uid) labelUserIds.add(uid);
  }
  for (const p of payments) {
    const uid = p.user_id as string | undefined;
    if (uid) labelUserIds.add(uid);
  }
  const labelByUser: Record<string, string> = {};
  if (labelUserIds.size > 0) {
    const { data: labelProfs } = await admin
      .from("profiles")
      .select("user_id, full_name, device_user_id")
      .in("user_id", [...labelUserIds]);
    for (const pr of labelProfs ?? []) {
      labelByUser[pr.user_id] = formatProfileMemberLabel(pr);
    }
  }
  for (const m of memberships) {
    const uid = m.user_id as string | undefined;
    if (uid) m.member_label = labelByUser[uid] ?? uid;
  }
  for (const p of payments) {
    const uid = p.user_id as string | undefined;
    if (uid) p.member_label = labelByUser[uid] ?? uid;
  }

  if (profiles.length > 0) {
    const uids = [...new Set(profiles.map((p) => String(p.user_id ?? "")).filter(Boolean))];
    const verByUser = await mapLatestVerificationWithDocsByUserId(admin, uids);
    for (const p of profiles) {
      const uid = String(p.user_id ?? "");
      const x = extrasToDisplayFields(p.profile_extras);
      p.aadhaar_last_four = x.aadhaar_last_four;
      p.student_roll_number = x.student_roll_number;
      p.institution_type = x.institution_type;
      p.preparing_for = x.preparing_for;
      const bundle = verByUser.get(uid);
      p.verification_status = deriveUiVerificationStatus(
        p.is_verified === true,
        bundle?.row ?? null,
        bundle?.docs ?? [],
      );
    }
  }

  return apiSuccess("Search complete.", { memberships, profiles, payments });
}
