import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function MembershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-surface-muted">{children}</main>
      <Footer />
    </>
  );
}
