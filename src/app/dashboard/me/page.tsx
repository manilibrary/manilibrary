import { redirect } from "next/navigation";

export default async function MemberMeIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && v[0]) q.set(k, v[0]);
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/dashboard/me/membership${suffix}`);
}
