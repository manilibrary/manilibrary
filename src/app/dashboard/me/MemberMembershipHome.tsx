"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MemberActiveMembershipCards,
  type MemberActivePlanRow,
  memberMembershipValidityEndedByDate,
} from "@/components/dashboard/MemberActiveMembershipCards";
import ProfileIntakeCard from "@/components/dashboard/ProfileIntakeCard";
import MemberProfileSection from "@/components/dashboard/MemberProfileSection";
import { CLIENT_DATA_CACHE_TTL_MS, ddcKey, getClientCache, setClientCache } from "@/lib/client-data-cache";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  full_name: string;
  device_user_id: number;
  phone: string | null;
  verification_status: string;
  aadhaar_last_four: string | null;
  student_roll_number: string | null;
  institution_type: string | null;
  preparing_for: string | null;
  avatar_url: string | null;
};

function sectionHeading(id: string, label: string) {
  return (
    <h2 id={id} className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
      {label}
    </h2>
  );
}

export default function MemberMembershipHome() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [memberships, setMemberships] = useState<MemberActivePlanRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const useCache = refreshKey === 0;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const kProf = ddcKey.profileMemberHome(user.id);
      const kMem = ddcKey.memberships(user.id);
      const kDocs = ddcKey.verifDocs(user.id);

      if (useCache) {
        const cProf = getClientCache<ProfileRow>(kProf);
        const cMem = getClientCache<MemberActivePlanRow[]>(kMem);
        const cDocs = getClientCache<Record<string, boolean>>(kDocs);
        if (cProf) setProfile(cProf);
        if (cMem) setMemberships(cMem);
        if (cDocs) setUploadedDocs(cDocs);
      }

      const [profRes, memRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "full_name, device_user_id, phone, verification_status, aadhaar_last_four, student_roll_number, institution_type, preparing_for, avatar_url",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("memberships")
          .select("id, plan_kind, status, seat_number, starts_at, ends_at, valid_from, valid_until, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      const { data: prof, error: pe } = profRes;
      if (pe) {
        setLoadError(pe.message);
        return;
      }
      if (prof) {
        setProfile(prof);
        setClientCache(kProf, prof, CLIENT_DATA_CACHE_TTL_MS);
      }

      const { data: memRows, error: me } = memRes;
      if (!me) {
        const rows = (memRows ?? []) as MemberActivePlanRow[];
        setMemberships(rows);
        setClientCache(kMem, rows, CLIENT_DATA_CACHE_TTL_MS);
      }

      const { data: pendReq } = await supabase
        .from("verification_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      const docMap: Record<string, boolean> = {};
      if (pendReq?.id) {
        const { data: docs } = await supabase
          .from("verification_documents")
          .select("doc_type")
          .eq("verification_id", pendReq.id);
        for (const row of docs ?? []) {
          const t = row.doc_type as string | undefined;
          if (t) docMap[t] = true;
        }
      }
      if (!cancelled) {
        setUploadedDocs(docMap);
        setClientCache(kDocs, docMap, CLIENT_DATA_CACHE_TTL_MS);
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
          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-5">
              <MemberProfileSection
                fullName={profile.full_name}
                deviceUserId={profile.device_user_id}
                phone={profile.phone}
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
            <div className="min-w-0 lg:col-span-7">
              <ProfileIntakeCard
                initial={{
                  aadhaar_last_four: profile.aadhaar_last_four,
                  student_roll_number: profile.student_roll_number,
                  institution_type: profile.institution_type,
                  preparing_for: profile.preparing_for,
                  verification_status: profile.verification_status ?? "none",
                }}
                uploadedDocs={uploadedDocs}
                onSaved={() => setRefreshKey((k) => k + 1)}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
