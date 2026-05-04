import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import libraryInfo from "@/data/libraryInfo.json";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(libraryInfo.contact.website),
  title: {
    // default: `${libraryInfo.name} — ${libraryInfo.tagline}`,
    default: `${libraryInfo.name}`,
    template: `%s · ${libraryInfo.name}`,
  },
  description: libraryInfo.shortDescription,
  applicationName: libraryInfo.name,
  authors: [{ name: libraryInfo.owner.name }],
  keywords: [
    "library",
    "study hall",
    "reading room",
    "Madhubani",
    "Bihar",
    "self study",
    "24/7 library",
    libraryInfo.name,
  ],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon.svg"],
    apple: ["/favicon.svg"],
  },
  openGraph: {
    title: libraryInfo.name,
    description: libraryInfo.shortDescription,
    siteName: libraryInfo.name,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0160D0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-ink-900 font-sans">
        {children}
      </body>
    </html>
  );
}
