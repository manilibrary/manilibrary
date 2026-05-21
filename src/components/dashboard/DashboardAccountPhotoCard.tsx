"use client";

import { useCallback, useEffect, useState } from "react";

import MemberProfileSection from "@/components/dashboard/MemberProfileSection";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  full_name: string;
  device_user_id: number;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
};

export default function DashboardAccountPhotoCard() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoadError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, device_user_id, phone, email, avatar_url, is_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setLoadError(error.message);
      return;
    }
    if (!data) {
      setLoadError("Profile not found.");
      return;
    }

    setProfile({
      full_name: String(data.full_name ?? ""),
      device_user_id: Number(data.device_user_id),
      phone: data.phone ?? null,
      email: data.email ?? user.email ?? null,
      avatar_url: data.avatar_url ?? null,
      is_admin: data.is_admin === true,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loadError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</p>
    );
  }

  if (!profile) {
    return <p className="text-sm text-ink-500">Loading profile…</p>;
  }

  return (
    <section id="your-photo" className="scroll-mt-8">
      <MemberProfileSection
        variant="account"
        fullName={profile.full_name}
        deviceUserId={profile.device_user_id}
        phone={profile.phone}
        email={profile.email}
        avatarUrl={profile.avatar_url}
        isStaff={profile.is_admin}
        onAvatarChanged={() => setRefreshKey((k) => k + 1)}
      />
    </section>
  );
}
