import membersData from "@/data/members.json";
import libraryInfo from "@/data/libraryInfo.json";

export type Member = (typeof membersData)[number];
export type Plan = (typeof libraryInfo.plans)[number];

export const TODAY = new Date("2026-05-04T00:00:00");

export function getPlan(planId: string): Plan | undefined {
  return libraryInfo.plans.find((p) => p.id === planId);
}

export function planName(planId: string): string {
  return getPlan(planId)?.name ?? planId;
}

export function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const ms = d.getTime() - TODAY.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatCurrency(n: number): string {
  return `${libraryInfo.currencySymbol}${n.toLocaleString("en-IN")}`;
}

export function getMembers(): Member[] {
  return membersData;
}

export function getStats() {
  const members = getMembers();
  const active = members.filter((m) => m.status === "active");
  const expired = members.filter((m) => m.status === "expired");
  const expiringSoon = active.filter((m) => {
    const d = daysUntil(m.expiryDate);
    return d >= 0 && d <= 7;
  });
  const due = members.filter(
    (m) => m.paymentStatus === "due" || m.paymentStatus === "overdue"
  );
  const monthlyRevenue = members
    .filter((m) => {
      const d = new Date(m.lastPayment.date);
      return d.getMonth() === TODAY.getMonth() && d.getFullYear() === TODAY.getFullYear();
    })
    .reduce((sum, m) => sum + m.lastPayment.amount, 0);
  const lastMonthRevenue = members
    .filter((m) => {
      const d = new Date(m.lastPayment.date);
      const lastMonth = new Date(TODAY);
      lastMonth.setMonth(TODAY.getMonth() - 1);
      return (
        d.getMonth() === lastMonth.getMonth() &&
        d.getFullYear() === lastMonth.getFullYear()
      );
    })
    .reduce((sum, m) => sum + m.lastPayment.amount, 0);

  return {
    total: members.length,
    active: active.length,
    expired: expired.length,
    expiringSoon,
    due,
    monthlyRevenue,
    lastMonthRevenue,
  };
}

export function getRecentPayments(limit = 6): Member[] {
  return [...getMembers()]
    .sort(
      (a, b) =>
        new Date(b.lastPayment.date).getTime() -
        new Date(a.lastPayment.date).getTime()
    )
    .slice(0, limit);
}
