"use client";

import Link from "next/link";

import { STAFF_LANDING_PATH } from "@/lib/auth-landing";

type Props = {
  fullWidth?: boolean;
};

export default function StaffRazorpayBlockedNotice({ fullWidth }: Props) {
  return (
    <div
      className={`rounded-2xl border border-violet-200 bg-violet-50/90 px-4 py-4 text-sm text-violet-950 ${
        fullWidth ? "w-full" : "max-w-md"
      }`}
      role="status"
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-violet-700">Staff account</p>
      <p className="mt-2 leading-relaxed">
        Admins and desk staff cannot pay with Razorpay on this site. Use the dashboard to enroll members, pick a seat
        on the floor map, and record cash or UPI at the desk.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/dashboard/members"
          className="inline-flex rounded-full bg-violet-700 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-800"
        >
          Dashboard → Members
        </Link>
        <Link
          href={STAFF_LANDING_PATH}
          className="inline-flex rounded-full border border-violet-300 bg-white px-4 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-100"
        >
          Open dashboard
        </Link>
      </div>
    </div>
  );
}
