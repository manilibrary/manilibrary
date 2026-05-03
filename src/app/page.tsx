"use client";

import { useState } from "react";

const books = [
  {
    id: 1,
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    genre: "Fiction",
    available: true,
    cover: "bg-amber-200",
  },
  {
    id: 2,
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    genre: "Fiction",
    available: false,
    cover: "bg-sky-200",
  },
  {
    id: 3,
    title: "Sapiens",
    author: "Yuval Noah Harari",
    genre: "Non-Fiction",
    available: true,
    cover: "bg-emerald-200",
  },
  {
    id: 4,
    title: "Dune",
    author: "Frank Herbert",
    genre: "Sci-Fi",
    available: true,
    cover: "bg-orange-200",
  },
  {
    id: 5,
    title: "1984",
    author: "George Orwell",
    genre: "Dystopian",
    available: false,
    cover: "bg-rose-200",
  },
  {
    id: 6,
    title: "Atomic Habits",
    author: "James Clear",
    genre: "Self-Help",
    available: true,
    cover: "bg-violet-200",
  },
  {
    id: 7,
    title: "The Alchemist",
    author: "Paulo Coelho",
    genre: "Fiction",
    available: true,
    cover: "bg-yellow-200",
  },
  {
    id: 8,
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    genre: "Non-Fiction",
    available: true,
    cover: "bg-teal-200",
  },
  {
    id: 9,
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    genre: "Fantasy",
    available: false,
    cover: "bg-lime-200",
  },
];

const genres = ["All", "Fiction", "Non-Fiction", "Sci-Fi", "Dystopian", "Self-Help", "Fantasy"];

const stats = [
  { label: "Books in Collection", value: "12,400+" },
  { label: "Active Members", value: "3,200+" },
  { label: "Books Borrowed Today", value: "148" },
  { label: "Years of Service", value: "25" },
];

export default function Home() {
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = books.filter((b) => {
    const matchesGenre = selectedGenre === "All" || b.genre === selectedGenre;
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase());
    return matchesGenre && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <span className="text-xl font-bold text-stone-900 tracking-tight">
              mani<span className="text-amber-600">library</span>
            </span>
          </div>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <a href="#about" className="hover:text-amber-600 transition-colors">About</a>
            <a href="#catalogue" className="hover:text-amber-600 transition-colors">Catalogue</a>
            <a href="#membership" className="hover:text-amber-600 transition-colors">Membership</a>
            <a href="#contact" className="hover:text-amber-600 transition-colors">Contact</a>
          </div>
          <a
            href="#membership"
            className="hidden md:inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-colors"
          >
            Join Now
          </a>
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-stone-100 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="text-xl">{menuOpen ? "✕" : "☰"}</span>
          </button>
        </div>
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-stone-100 bg-white px-6 py-4 flex flex-col gap-4 text-sm font-medium text-stone-700">
            <a href="#about" onClick={() => setMenuOpen(false)} className="hover:text-amber-600">About</a>
            <a href="#catalogue" onClick={() => setMenuOpen(false)} className="hover:text-amber-600">Catalogue</a>
            <a href="#membership" onClick={() => setMenuOpen(false)} className="hover:text-amber-600">Membership</a>
            <a href="#contact" onClick={() => setMenuOpen(false)} className="hover:text-amber-600">Contact</a>
            <a href="#membership" className="bg-amber-600 text-white text-center py-2 rounded-full">Join Now</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-28 md:py-36">
          <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-4">
            Welcome to manilibrary.com
          </p>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight max-w-3xl mb-6">
            Your neighbourhood library, <span className="text-amber-400">reimagined.</span>
          </h1>
          <p className="text-stone-300 text-lg md:text-xl max-w-xl leading-relaxed mb-10">
            Discover thousands of books, reserve your next read online, and join a community of curious minds — all in one place.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#catalogue"
              className="bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold px-7 py-3.5 rounded-full transition-colors text-sm shadow-lg"
            >
              Browse Catalogue
            </a>
            <a
              href="#membership"
              className="border border-white/30 hover:bg-white/10 text-white font-semibold px-7 py-3.5 rounded-full transition-colors text-sm"
            >
              Become a Member
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-amber-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold">{s.value}</p>
              <p className="text-amber-100 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-amber-600 text-sm font-semibold tracking-widest uppercase mb-3">About Us</p>
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900 leading-snug mb-5">
              More than a library — a place to grow.
            </h2>
            <p className="text-stone-500 leading-relaxed mb-4">
              ManiLibrary has been a cornerstone of the community for over 25 years. We believe that access to knowledge should be free, welcoming, and joyful for everyone regardless of age or background.
            </p>
            <p className="text-stone-500 leading-relaxed">
              From quiet reading nooks to vibrant book clubs and author talks, our doors are open six days a week. Our digital catalogue lets you search, reserve, and track your borrowing history from anywhere.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: "🏛️", title: "Physical Library", desc: "Open Mon–Sat, 9 AM – 8 PM" },
              { icon: "💻", title: "Online Catalogue", desc: "Search & reserve 24/7" },
              { icon: "📖", title: "Book Clubs", desc: "Weekly themed reading groups" },
              { icon: "🎙️", title: "Author Talks", desc: "Monthly literary events" },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-stone-800 mb-1">{item.title}</h3>
                <p className="text-stone-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section id="catalogue" className="bg-stone-100 py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-amber-600 text-sm font-semibold tracking-widest uppercase mb-3">Our Collection</p>
            <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-4">Browse the Catalogue</h2>
            <p className="text-stone-500 max-w-xl mx-auto">
              Search through our curated selection. Green badge means available for borrowing right now.
            </p>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <input
              type="text"
              placeholder="Search by title or author…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-white border border-stone-200 rounded-full px-5 py-3 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-sm"
            />
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    selectedGenre === g
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-white text-stone-600 border-stone-200 hover:border-amber-400"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Book Grid */}
          {filtered.length === 0 ? (
            <p className="text-center text-stone-400 py-16">No books match your search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {filtered.map((book) => (
                <div
                  key={book.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 hover:shadow-md transition-shadow group"
                >
                  <div className={`${book.cover} h-36 flex items-end p-4`}>
                    <span className="text-4xl select-none">📗</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-stone-900 leading-snug group-hover:text-amber-700 transition-colors">
                        {book.title}
                      </h3>
                      <span
                        className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          book.available
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {book.available ? "Available" : "Borrowed"}
                      </span>
                    </div>
                    <p className="text-stone-500 text-sm mb-3">{book.author}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-stone-100 text-stone-500 px-3 py-1 rounded-full">
                        {book.genre}
                      </span>
                      {book.available && (
                        <button className="text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors">
                          Reserve →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Membership */}
      <section id="membership" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-amber-600 text-sm font-semibold tracking-widest uppercase mb-3">Membership</p>
          <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-4">Choose your plan</h2>
          <p className="text-stone-500 max-w-md mx-auto">All plans include full access to the physical library. Upgrade for more borrows and perks.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              name: "Basic",
              price: "Free",
              desc: "Perfect for casual readers.",
              features: ["2 books at a time", "Online catalogue access", "Monthly newsletter"],
              highlight: false,
            },
            {
              name: "Reader",
              price: "₹149/mo",
              desc: "Most popular choice.",
              features: ["5 books at a time", "Priority reservations", "Book club access", "eBook lending"],
              highlight: true,
            },
            {
              name: "Scholar",
              price: "₹299/mo",
              desc: "For the dedicated bibliophile.",
              features: ["Unlimited books", "Research assistance", "Author event seats", "Home delivery"],
              highlight: false,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 border flex flex-col ${
                plan.highlight
                  ? "bg-amber-600 text-white border-amber-600 shadow-xl scale-105"
                  : "bg-white border-stone-200 shadow-sm hover:shadow-md transition-shadow"
              }`}
            >
              <p className={`text-sm font-semibold uppercase tracking-widest mb-2 ${plan.highlight ? "text-amber-200" : "text-amber-600"}`}>
                {plan.name}
              </p>
              <p className={`text-4xl font-extrabold mb-1 ${plan.highlight ? "text-white" : "text-stone-900"}`}>
                {plan.price}
              </p>
              <p className={`text-sm mb-6 ${plan.highlight ? "text-amber-100" : "text-stone-500"}`}>{plan.desc}</p>
              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-amber-50" : "text-stone-600"}`}>
                    <span className={plan.highlight ? "text-amber-200" : "text-amber-500"}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-3 rounded-full font-semibold text-sm transition-colors ${
                  plan.highlight
                    ? "bg-white text-amber-700 hover:bg-amber-50"
                    : "bg-amber-600 text-white hover:bg-amber-700"
                }`}
              >
                Get Started
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-stone-900 text-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">Get in Touch</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-5 leading-snug">We'd love to hear from you.</h2>
            <p className="text-stone-400 leading-relaxed mb-6">
              Whether you have questions about membership, want to donate books, or just want to say hello — our team is here.
            </p>

            {/* Address */}
            <div className="flex items-start gap-3 text-stone-300 text-sm mb-8">
              <span className="mt-0.5">📍</span>
              <span>Mani Library, Near Townclub, Madhubani, Bihar</span>
            </div>

            {/* Development team */}
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-4">Development Team</p>
            <div className="space-y-4">
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-5">
                <p className="font-semibold text-white mb-0.5">Abhishek Kumar Chaudhary</p>
                <a
                  href="https://abhishek-chaudhary.com#contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 text-sm transition-colors break-all"
                >
                  abhishek-chaudhary.com#contact
                </a>
              </div>
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-5">
                <p className="font-semibold text-white mb-0.5">Saroj Kumar</p>
                <a
                  href="tel:+916205573763"
                  className="text-amber-400 hover:text-amber-300 text-sm transition-colors"
                >
                  +91 6205573763
                </a>
              </div>
            </div>
          </div>
          <form className="bg-stone-800 rounded-2xl p-8 space-y-5 border border-stone-700">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-stone-400 uppercase tracking-widest block mb-1.5">Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full bg-stone-700 border border-stone-600 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-xs text-stone-400 uppercase tracking-widest block mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@email.com"
                  className="w-full bg-stone-700 border border-stone-600 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-400 uppercase tracking-widest block mb-1.5">Subject</label>
              <input
                type="text"
                placeholder="How can we help?"
                className="w-full bg-stone-700 border border-stone-600 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 uppercase tracking-widest block mb-1.5">Message</label>
              <textarea
                rows={4}
                placeholder="Write your message…"
                className="w-full bg-stone-700 border border-stone-600 rounded-xl px-4 py-3 text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold py-3.5 rounded-full transition-colors text-sm"
            >
              Send Message
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-950 text-stone-500 text-sm py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-lg">📚</span>
          <span className="font-semibold text-stone-300">
            mani<span className="text-amber-500">library</span>.com
          </span>
        </div>
        <p>© {new Date().getFullYear()} ManiLibrary. Built with love for books.</p>
      </footer>
    </div>
  );
}
