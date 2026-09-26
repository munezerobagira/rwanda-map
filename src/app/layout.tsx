import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Coordinates, codes and areas - fixed-width digits so they don't jitter
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// No production domain is known yet - NEXT_PUBLIC_SITE_URL lets a real
// deployment set one; until then this only affects how relative OG/Twitter
// image/URLs resolve locally, never a guessed public domain.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const title = "Rwanda Grid Intelligence - InfraMap Dashboard";
const description =
  "Rwanda National Spatial Data Infrastructure (NSDI) interactive electrical grid, transmission lines, substations, and administrative (province/district/sector/cell/village) boundaries dashboard explorer.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Rwanda Grid Intelligence",
  },
  description,
  keywords: [
    "Rwanda",
    "GIS",
    "NSDI",
    "electrical grid",
    "administrative boundaries",
    "provinces",
    "districts",
    "sectors",
    "cells",
    "villages",
    "map dashboard",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Rwanda Grid Intelligence",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
