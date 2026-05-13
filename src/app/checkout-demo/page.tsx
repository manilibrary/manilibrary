import type { Metadata } from "next";

import RazorpayStandardCheckout from "@/components/payments/RazorpayStandardCheckout";

export const metadata: Metadata = {
  title: "Razorpay checkout demo",
  robots: { index: false, follow: false },
};

export default function CheckoutDemoPage() {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-16">
      <RazorpayStandardCheckout />
    </div>
  );
}
