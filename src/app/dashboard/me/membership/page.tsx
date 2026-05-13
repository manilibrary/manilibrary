import { redirect } from "next/navigation";

import MemberMembershipHome from "../MemberMembershipHome";

export const metadata = { title: "Your account" };

export default async function MemberMembershipPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paid = sp.paid === "1" || sp.paid === "true";
  if (paid) {
    redirect("/dashboard/me/my-membership?paid=1");
  }
  return <MemberMembershipHome />;
}
