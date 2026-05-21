import Link from "next/link";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import PublicGalleryContent from "@/components/landing/PublicGalleryContent";

export const metadata = {
  title: "Gallery",
  description: "Photos of Mani Library — study spaces, cabins, and our learning community.",
};

export default function GalleryPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
          <nav className="mb-6 text-sm">
            <Link href="/" className="font-medium text-azure-600 hover:text-azure-700">
              ← Home
            </Link>
          </nav>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-azure-500">Gallery</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
              Life at Mani Library
            </h1>
            <p className="mt-4 text-base text-ink-600">
              Explore our study space, cabins, and the community that learns here every day.
            </p>
          </div>
          <div className="mt-10">
            <PublicGalleryContent />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
