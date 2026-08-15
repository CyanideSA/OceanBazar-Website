import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';
import MetaPixel from '@/components/analytics/MetaPixel';
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

/**
 * ES5: auto-send low-end devices to Lite — aligned with nginx `$ob_old_ua`.
 * UA-only (old iOS ≤15, Android ≤12). Never use deviceMemory / hardwareConcurrency.
 */
const LITE_DEVICE_HINT = `(function(){
  try {
    if (/[?&]ob_view=full(?:&|$)/.test(location.search)) return;
    var m = document.cookie.match(/(?:^|; )ob_view=([^;]*)/);
    var view = m ? decodeURIComponent(m[1]) : '';
    if (view === 'full') return;
    var ua = navigator.userAgent || '';
    var lowEnd = /iP(hone|od|ad).*OS (1[0-5])_/i.test(ua) || /Android (?:[4-9]\\.|1[0-2][;.)])/i.test(ua);
    var shouldLite = view === 'lite' || lowEnd;
    if (!shouldLite) return;
    var lite = ${JSON.stringify(
      (process.env.NEXT_PUBLIC_LITE_SITE_URL || 'https://oceanbazar.com.bd/lite').replace(/\/$/, ''),
    )};
    var next = location.pathname + location.search + location.hash;
    location.replace(lite + '/prefer?view=lite&next=' + encodeURIComponent(next || '/bn'));
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning className={`${inter.variable} ${notoSansBengali.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LITE_DEVICE_HINT }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        {children}
        <MetaPixel />
      </body>
    </html>
  );
}
