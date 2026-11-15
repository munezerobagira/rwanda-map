import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin']
});

// Coordinates, codes and areas - fixed-width digits so they don't jitter
const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin']
});

// Default to the deployment supplied in the project mission; allow custom domains.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rwanda-map.vercel.app';
const title = 'Rwanda Map — Dated Maps and Building Estimates';
const description =
  'Explore Rwanda administrative boundaries, dated 10m satellite imagery and transparent estimates of mapped structures. Compare source snapshots and export selected areas.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s | Rwanda Map'
  },
  description,
  keywords: [
    'Rwanda',
    'GIS',
    'NSDI',
    'mapped building estimates',
    'administrative boundaries',
    'provinces',
    'districts',
    'sectors',
    'cells',
    'villages',
    'map dashboard'
  ],
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Rwanda Map',
    title,
    description
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="rw" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
