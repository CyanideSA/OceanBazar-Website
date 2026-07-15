import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://oceanbazar.com';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-bengali',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Oceanbazar — বাংলাদেশের সেরা অনলাইন শপ',
    template: '%s | Oceanbazar',
  },
  description:
    'Oceanbazar — বাংলাদেশের অন্যতম সেরা অনলাইন শপিং প্ল্যাটফর্ম। Retail ও Wholesale-এ সেরা দামে ইলেকট্রনিক্স, পোশাক, গৃহসজ্জা ও আরও অনেক কিছু।',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Oceanbazar',
    title: 'Oceanbazar — বাংলাদেশের সেরা অনলাইন শপ',
    description: 'Retail & Wholesale ecommerce for Bangladesh. Best prices guaranteed.',
    images: [{ url: '/images/og-image.jpg', width: 1200, height: 630, alt: 'Oceanbazar' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oceanbazar',
    description: "Bangladesh's best online shop",
    images: ['/images/og-image.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${notoSansBengali.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
