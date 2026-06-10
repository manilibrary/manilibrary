"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MemberActiveMembershipCards,
  type MemberActivePlanRow,
  memberMembershipValidityEndedByDate,
} from "@/components/dashboard/MemberActiveMembershipCards";
import { useMemberMeBootstrap } from "@/components/dashboard/MemberMeBootstrapProvider";
import ProfileIntakeCard from "@/components/dashboard/ProfileIntakeCard";
import MemberProfileSection from "@/components/dashboard/MemberProfileSection";
import MemberFeedbackCard from "@/components/dashboard/MemberFeedbackCard";
import MemberReferralCard from "@/components/dashboard/MemberReferralCard";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import { extrasToDisplayFields } from "@/lib/profiles/profile-extras";
import { profilePhoneFromDb } from "@/lib/profile-phone";
import { createClient } from "@/lib/supabase/client";
import { loadMemberKycForDashboard } from "@/lib/members/member-kyc-client-load";
import {
  type KycDocType,
  type MemberKycSlotSummary,
} from "@/lib/verification/verification-repo";

type ProfileRow = {
  full_name: string;
  device_user_id: number;
  phone: string | null;
  email: string | null;
  verification_status: string;
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_verified: boolean;
};

function sectionHeading(id: string, label: string) {
  return (
    <h2 id={id} className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
      {label}
    </h2>
  );
}

export default function MemberMembershipHome() {
  const boot = useMemberMeBootstrap();
  const bootRef = useRef(boot);
  useEffect(() => {
    bootRef.current = boot;
  }, [boot]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [memberships, setMemberships] = useState<MemberActivePlanRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});
  const [memberKycSlots, setMemberKycSlots] = useState<
    Record<KycDocType, MemberKycSlotSummary> | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    const useCache = refreshKey === 0;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const b = bootRef.current;
      const bootMem =
        useCache && b.ready && !b.skipped && b.memberUserId === user.id ? b.membershipRows : null;

      const kProf = ddcKey.profileMemberHome(user.id);
      const kMem = ddcKey.memberships(user.id);
      const kDocs = ddcKey.verifDocs(user.id);
      const kMyc = ddcKey.verifMemberKyc(user.id);

      if (useCache) {
        const cProf = getClientCache<ProfileRow>(kProf);
        const cMem = getClientCache<MemberActivePlanRow[]>(kMem);
        const cMyc = getClientCache<{ uploadedDocs: Record<string, boolean>; memberKycSlots: Record<KycDocType, MemberKycSlotSummary> }>(
          kMyc,
        );
        const cDocs = getClientCache<Record<string, boolean>>(kDocs);
        if (cProf) setProfile(cProf);
        if (cMem) setMemberships(cMem);
        if (bootMem) setMemberships(bootMem);
        if (cMyc) {
          setUploadedDocs(cMyc.uploadedDocs);
          setMemberKycSlots(cMyc.memberKycSlots);
        } else if (cDocs) {
          setUploadedDocs(cDocs);
        }
      }

      const profP = supabase
        .from("profiles")
        .select("full_name, device_user_id, phone, email, is_admin, is_verified, profile_extras, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      const memP =
        bootMem != null
          ? Promise.resolve({ data: bootMem, error: null as null })
          : supabase
              .from("memberships")
              .select("id, plan_kind, plan_code, shift, status, seat_number, starts_at, ends_at, valid_from, valid_until, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false });

      const [profRes, memRes] = await Promise.all([profP, memP]);

      if (cancelled) return;

      const { data: prof, error: pe } = profRes;
      if (pe) {
        setLoadError(pe.message);
        return;
      }
      if (prof) {
        const x = extrasToDisplayFields((prof as { profile_extras?: unknown }).profile_extras);
        const isVerified = (prof as { is_verified?: boolean }).is_verified === true;
        const kycPromise = loadMemberKycForDashboard(supabase, user.id, isVerified);
        const kyc = await kycPromise;
        if (cancelled) return;
        const mapped: ProfileRow = {
          full_name: String((prof as { full_name?: string }).full_name ?? ""),
          device_user_id: Number((prof as { device_user_id?: number }).device_user_id),
          phone: profilePhoneFromDb((prof as { phone?: unknown }).phone) ?? null,
          email: (prof as { email?: string | null }).email ?? null,
          verification_status: kyc.verificationUiStatus,
          aadhaar_last_four: x.aadhaar_last_four,
          student_roll_number: x.student_roll_number,
          institution_type: x.institution_type,
          preparing_for: x.preparing_for,
          avatar_url: (prof as { avatar_url?: string | null }).avatar_url ?? null,
          is_admin: (prof as { is_admin?: boolean }).is_admin === true,
          is_verified: (prof as { is_verified?: boolean }).is_verified === true,
        };
        setProfile(mapped);
        setClientCache(kProf, mapped, CLIENT_DATA_CACHE_TTL_MS);
        setUploadedDocs(kyc.uploadedDocs);
        setMemberKycSlots(kyc.memberKycSlots);
        setClientCache(kDocs, kyc.uploadedDocs, CLIENT_DATA_CACHE_TTL_MS);
        setClientCache(
          kMyc,
          { uploadedDocs: kyc.uploadedDocs, memberKycSlots: kyc.memberKycSlots },
          CLIENT_DATA_CACHE_TTL_MS,
        );
      }

      const { data: memRows, error: me } = memRes;
      if (!me) {
        const rows = (memRows ?? []) as MemberActivePlanRow[];
        setMemberships(rows);
        setClientCache(kMem, rows, CLIENT_DATA_CACHE_TTL_MS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const activePlans = memberships.filter(
    (m) => m.status === "active" && !memberMembershipValidityEndedByDate(m),
  );
  const hasActive = activePlans.length > 0;

  return (
    <div className="space-y-8">
      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
      )}

      {profile ? (
        <section
          className="scroll-mt-8 space-y-4"
          aria-labelledby={hasActive ? "your-profile-heading active-membership-heading" : "your-profile-heading"}
        >
          {sectionHeading("your-profile-heading", "Your profile")}
          <div className="grid gap-5 lg:grid-cols-12 lg:items-start lg:gap-5">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-6 lg:-ml-1 xl:-ml-2">
              <MemberProfileSection
                fullName={profile.full_name}
                deviceUserId={profile.device_user_id}
                phone={profile.phone}
                email={profile.email}
                verificationStatus={profile.verification_status ?? "none"}
                avatarUrl={profile.avatar_url}
                onAvatarChanged={() => setRefreshKey((k) => k + 1)}
              />
              {hasActive ? (
                <div className="space-y-3 border-t border-ink-100/90 pt-6">
                  {sectionHeading("active-membership-heading", "Active membership")}
                  <MemberActiveMembershipCards
                    plans={activePlans}
                    compact
                    showViewPlansLink={false}
                    rowMode="scroll"
                    className="min-w-0"
                  />
                  <p className="text-xs text-ink-500">
                    <Link
                      href="/dashboard/me/my-membership"
                      className="font-medium text-azure-600 hover:text-azure-700"
                    >
                      Membership details & history →
                    </Link>
                  </p>
                </div>
              ) : null}
            </div>
            <div className="min-w-0 lg:col-span-6">
              <ProfileIntakeCard
                initial={{
                  aadhaar_last_four: profile.aadhaar_last_four,
                  student_roll_number: profile.student_roll_number,
                  institution_type: profile.institution_type,
                  preparing_for: profile.preparing_for,
                  verification_status: profile.verification_status ?? "none",
                }}
                uploadedDocs={uploadedDocs}
                memberKycSlots={memberKycSlots ?? undefined}
                onSaved={() => setRefreshKey((k) => k + 1)}
              />
            </div>
          </div>
        </section>
      ) : null}

      {profile && !profile.is_admin ? (
        <section className="scroll-mt-8 space-y-4" aria-labelledby="referral-heading">
          {sectionHeading("referral-heading", "Referrals & credits")}
          <MemberReferralCard />
        </section>
      ) : null}

      {profile && !profile.is_admin && profile.is_verified ? (
        <section className="scroll-mt-8 space-y-4" aria-labelledby="your-feedback-heading">
          {sectionHeading("your-feedback-heading", "Feedback")}
          <MemberFeedbackCard />
        </section>
      ) : null}
    </div>
  );
}
