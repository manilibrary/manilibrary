import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatsCounter from "@/components/StatsCounter";
import libraryInfo from "@/data/libraryInfo.json";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <StatsCounter />
        <Facilities />
        <About />
        <Plans />
        <Contact />
      </main>
      <Footer />
    </>
  );
}

/* ---------------------------------------------------------- */
/*  Hero                                                       */
/* ---------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute inset-0 bg-grid-azure [mask-image:linear-gradient(to_bottom,white,transparent_85%)]" />
      <div className="absolute inset-0 bg-azure-glow" />

      <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-azure-200 bg-azure-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-azure-700">
            <span className="h-1.5 w-1.5 rounded-full bg-azure-500" />
            Open 24 / 7 in Madhubani
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-ink-900 md:text-6xl">
            A focused space to{" "}
            <span className="text-azure-500">study, read, and grow.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-600 md:text-lg">
            {libraryInfo.shortDescription}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login?role=member"
              className="inline-flex items-center gap-2 rounded-full bg-azure-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-azure-600"
            >
              Reserve your seat
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 10h10m0 0-4-4m4 4-4 4"
                />
              </svg>
            </Link>
            <a
              href="#facilities"
              className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-6 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
            >
              Explore facilities
            </a>
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-ink-500">
            est_2020 // capacity_{libraryInfo.capacity} // shifts_24x7
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl">
          <div className="rounded-2xl border border-ink-100 bg-white p-1 shadow-card">
            <div className="overflow-hidden rounded-xl border border-ink-100">
              <div className="grid grid-cols-3 gap-px bg-ink-100">
                {[
                  { label: "Quiet zones", value: "8" },
                  { label: "Cabins", value: "120" },
                  { label: "Always open", value: "24/7" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-white px-6 py-8 text-center"
                  >
                    <p className="font-mono text-3xl font-semibold tracking-tight text-azure-500 md:text-4xl">
                      {item.value}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-widest text-ink-500">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ---------------------------------------------------------- */
/*  Facilities                                                 */
/* ---------------------------------------------------------- */

function Facilities() {
  return (
    <section id="facilities" className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-azure-500">
            Facilities
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
            Everything you need to focus.
          </h2>
          <p className="mt-4 text-base text-ink-600">
            Thoughtfully designed for serious learners — from civil services
            aspirants to college students.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {libraryInfo.facilities.map((f) => (
            <article
              key={f.id}
              className="group rounded-2xl border border-ink-100 bg-white p-6 transition-all hover:border-azure-200 hover:shadow-card-hover"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-azure-50 text-azure-500 transition-colors group-hover:bg-azure-500 group-hover:text-white">
                <FacilityIcon id={f.id} />
              </div>
              <h3 className="mt-5 text-base font-semibold text-ink-900">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {f.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FacilityIcon({ id }: { id: string }) {
  const stroke = "currentColor";
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
  };

  switch (id) {
    case "ac":
      return (
        <svg {...common}>
          <path d="M3 8h18M3 16h18M12 4v16M7 8l-2 4 2 4M17 8l2 4-2 4" />
        </svg>
      );
    case "247":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "wifi":
      return (
        <svg {...common}>
          <path d="M5 12.55a11 11 0 0 1 14 0M8.5 16.05a6 6 0 0 1 7 0M12 20h.01" />
        </svg>
      );
    case "power":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      );
    case "lockers":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h.01M8 14h.01M16 12h.01" />
          <path d="M12 3v18" />
        </svg>
      );
    case "water":
      return (
        <svg {...common}>
          <path d="M12 3s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12Z" />
        </svg>
      );
    case "silent":
      return (
        <svg {...common}>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          <path d="m22 9-6 6M16 9l6 6" />
        </svg>
      );
    case "discussion":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

/* ---------------------------------------------------------- */
/*  About                                                      */
/* ---------------------------------------------------------- */

function About() {
  return (
    <section id="about" className="bg-surface-muted">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-2 md:gap-16 md:px-8 md:py-28">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-azure-500">
            About {libraryInfo.name}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
            A neighbourhood library, built for the next generation.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-ink-600">
            Founded in {libraryInfo.established} by {libraryInfo.owner.name},
            {" "}
            {libraryInfo.name} began as a single hall with twenty seats. Today
            it hosts over a hundred students preparing for competitive exams,
            board exams and college coursework — all under one quiet roof.
          </p>
          <p className="mt-4 text-base leading-relaxed text-ink-600">
            We focus on the things that matter: clean air, dependable power, a
            comfortable seat, and a community that takes its goals seriously.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-4">
            {[
              { label: "Founded", value: libraryInfo.established },
              { label: "Capacity", value: libraryInfo.capacity },
              { label: "Hours", value: libraryInfo.hours },
              { label: "Location", value: libraryInfo.address.city },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-ink-100 bg-white px-4 py-3"
              >
                <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  {item.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-ink-900">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-card">
            <p className="font-mono text-xs uppercase tracking-widest text-azure-500">
              // owner_note
            </p>
            <blockquote className="mt-4 text-lg leading-relaxed text-ink-800">
              &ldquo;We built {libraryInfo.name} because every serious student
              deserves a quiet seat, a stable power outlet, and a community
              that respects silence. That promise hasn&rsquo;t changed in five
              years.&rdquo;
            </blockquote>
            <div className="mt-6 flex items-center gap-3 border-t border-ink-100 pt-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-azure-500 font-mono text-sm font-semibold text-white">
                {libraryInfo.owner.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {libraryInfo.owner.name}
                </p>
                <p className="text-xs text-ink-500">{libraryInfo.owner.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
/*  Plans                                                      */
/* ---------------------------------------------------------- */

function Plans() {
  return (
    <section id="plans" className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-azure-500">
            Membership
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
            Simple plans, no surprises.
          </h2>
          <p className="mt-4 text-base text-ink-600">
            Pick the shift that fits your schedule. Upgrade or downgrade any
            time.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {libraryInfo.plans.map((plan) => {
            const popular = "popular" in plan && plan.popular;
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-7 ${
                  popular
                    ? "border-azure-500 shadow-card-hover ring-1 ring-azure-500"
                    : "border-ink-100 shadow-card"
                }`}
              >
                {popular && (
                  <span className="absolute -top-3 left-7 inline-flex items-center rounded-full bg-azure-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
                    Most popular
                  </span>
                )}
                <header>
                  <p className="font-mono text-xs uppercase tracking-widest text-ink-500">
                    {plan.hours}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-ink-900">
                    {plan.name}
                  </h3>
                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-4xl font-semibold tracking-tight text-ink-900">
                      {libraryInfo.currencySymbol}
                      {plan.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm text-ink-500">
                      / {plan.duration.replace("per ", "")}
                    </span>
                  </p>
                </header>
                <ul className="mt-6 flex-1 space-y-3 border-t border-ink-100 pt-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-azure-500"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 10.5 3.5 3.5 7.5-8"
                        />
                      </svg>
                      <span className="text-ink-700">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login?role=member"
                  className={`mt-7 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    popular
                      ? "bg-azure-500 text-white hover:bg-azure-600"
                      : "border border-ink-200 text-ink-800 hover:border-ink-300 hover:bg-ink-50"
                  }`}
                >
                  Choose {plan.name}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- */
/*  Contact                                                    */
/* ---------------------------------------------------------- */

function Contact() {
  const phoneHref = `tel:${libraryInfo.contact.primaryPhone.replace(/\s/g, "")}`;
  const mailHref = `mailto:${libraryInfo.contact.supportEmail}`;
  const addr = libraryInfo.address;

  return (
    <section id="contact" className="bg-surface-muted">
      <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-azure-500">
              Get in touch
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
              Visit us, or just say hello.
            </h2>
            <p className="mt-4 max-w-md text-base text-ink-600">
              Drop by for a tour, or call us for any membership question. We
              reply quickly.
            </p>

            <div className="mt-8 space-y-4">
              <ContactRow
                title="Address"
                value={`${addr.line1}, ${addr.city}, ${addr.state} ${addr.pincode}`}
                href={addr.mapsUrl}
              />
              <ContactRow
                title="Phone"
                value={libraryInfo.contact.primaryPhone}
                href={phoneHref}
              />
              <ContactRow
                title="Email"
                value={libraryInfo.contact.supportEmail}
                href={mailHref}
              />
              <ContactRow
                title="Hours"
                value={libraryInfo.hours}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-7 shadow-card">
            <h3 className="text-lg font-semibold text-ink-900">
              Quick enquiry
            </h3>
            <p className="mt-1 text-sm text-ink-600">
              Send us a note and we&rsquo;ll get back the same day.
            </p>
            <form
              className="mt-6 space-y-4"
              action={mailHref}
              method="post"
              encType="text/plain"
            >
              <Field name="name" label="Name" placeholder="Your name" />
              <Field
                name="email"
                label="Email"
                type="email"
                placeholder="you@email.com"
              />
              <Field
                name="phone"
                label="Phone"
                type="tel"
                placeholder="+91 ..."
              />
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  Message
                </label>
                <textarea
                  name="message"
                  rows={4}
                  placeholder="How can we help?"
                  className="w-full resize-none rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 placeholder-ink-400 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
                />
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-azure-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-azure-600"
              >
                Send message
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactRow({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
        {title}
      </p>
      <p className="mt-1 text-sm font-medium text-ink-800">{value}</p>
    </>
  );

  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 transition-colors hover:border-azure-200">
      {href ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-500"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 placeholder-ink-400 outline-none transition focus:border-azure-500 focus:ring-4 focus:ring-azure-500/15"
      />
    </div>
  );
}
