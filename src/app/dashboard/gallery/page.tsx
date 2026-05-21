import PageHeader from "@/components/dashboard/PageHeader";
import StaffGalleryPanel from "@/components/dashboard/StaffGalleryPanel";

export const metadata = { title: "Gallery" };

export default function GalleryPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="content"
        title="Photo gallery"
        description="Upload and manage photos shown in the homepage gallery. Up to 50 images; each must be under 5 MB (larger files are compressed before upload)."
      />
      <StaffGalleryPanel />
    </div>
  );
}
