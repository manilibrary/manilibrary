import PublicGalleryContent from "@/components/landing/PublicGalleryContent";
import {
  HOME_SECTION_PAD_TOP,
  HOME_SECTION_PAD_BOTTOM_TIGHT,
} from "@/lib/landing/home-section-spacing";

const HOMEPAGE_GALLERY_PREVIEW = 4;

export default function GallerySection() {
  return (
    <section id="gallery" className="bg-white">
      <div
        className={`mx-auto max-w-7xl ${HOME_SECTION_PAD_TOP} ${HOME_SECTION_PAD_BOTTOM_TIGHT}`}
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-azure-500">Gallery</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
            Life at Mani Library
          </h2>
          <p className="mt-4 text-base text-ink-600">
            A glimpse of our study space, cabins, and the community that learns here every day.
          </p>
        </div>

        <div className="mt-12">
          <PublicGalleryContent maxCount={HOMEPAGE_GALLERY_PREVIEW} showViewMore />
        </div>
      </div>
    </section>
  );
}
