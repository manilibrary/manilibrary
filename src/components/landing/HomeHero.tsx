import ActiveMembershipHeroNote from "@/components/landing/ActiveMembershipHeroNote";
import HeroCollage from "@/components/landing/HeroCollage";
import HeroCTAs from "@/components/landing/HeroCTAs";
import { getPublicHeroSettings } from "@/lib/hero/get-public-hero";
import libraryInfo from "@/data/libraryInfo.json";

export default async function HomeHero() {
  const hero = await getPublicHeroSettings();

  return (
    <section className="relative bg-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-grid-azure [mask-image:linear-gradient(to_bottom,white,transparent_90%)]" />
        <div className="absolute inset-0 bg-azure-glow" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-azure-200 bg-azure-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-azure-700">
              <span className="h-1.5 w-1.5 rounded-full bg-azure-500" />
              Open 24 / 7 in Madhubani
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-ink-900 md:text-5xl lg:text-[3.25rem]">
              A focused space to{" "}
              <span className="text-azure-500">study, read, and grow.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-600 md:text-lg lg:mx-0">
              {libraryInfo.shortDescription}
            </p>
            <div className="mt-8 flex justify-center lg:justify-start">
              <HeroCTAs align="start" />
            </div>
            <div className="mx-auto max-w-xl lg:mx-0">
              <ActiveMembershipHeroNote />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              {[
                {
                  icon: (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                  ),
                  label: `Est. ${libraryInfo.established}`,
                },
                {
                  icon: (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ),
                  label: `${libraryInfo.capacity} Seats`,
                },
                {
                  icon: (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                    </svg>
                  ),
                  label: "24 / 7",
                },
              ].map((tag) => (
                <span
                  key={tag.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-ink-500"
                >
                  {tag.icon}
                  {tag.label}
                </span>
              ))}
            </div>
          </div>

          <HeroCollage hero={hero} />
        </div>
      </div>
    </section>
  );
}
