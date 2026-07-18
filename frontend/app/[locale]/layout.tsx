import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Providers from '@/components/shared/Providers';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo/JsonLd';
import PwaInstallPrompt from '@/components/pwa/PwaInstallPrompt';

const locales = ['en', 'bn'];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const SITE_URL = 'https://oceanbazar.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Oceanbazar — বাংলাদেশের সেরা অনলাইন শপ',
    template: '%s | Oceanbazar',
  },
  description:
    'Oceanbazar — বাংলাদেশের অন্যতম সেরা অনলাইন শপিং প্ল্যাটফর্ম। Retail ও Wholesale-এ সেরা দামে ইলেকট্রনিক্স, পোশাক, গৃহসজ্জা ও আরও অনেক কিছু।',
  keywords: [
    'oceanbazar', 'online shop bangladesh', 'বাংলাদেশ অনলাইন শপ',
    'wholesale bangladesh', 'retail shop bd', 'ecommerce bd',
  ],
  authors: [{ name: 'Oceanbazar', url: SITE_URL }],
  creator: 'Oceanbazar',
  publisher: 'Oceanbazar',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    locale: 'bn_BD',
    alternateLocale: 'en_US',
    url: SITE_URL,
    siteName: 'Oceanbazar',
    title: 'Oceanbazar — বাংলাদেশের সেরা অনলাইন শপ',
    description: 'Retail & Wholesale ecommerce for Bangladesh. Best prices guaranteed.',
    images: [{ url: '/images/og-image.jpg', width: 1200, height: 630, alt: 'Oceanbazar' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Oceanbazar',
    description: 'Bangladesh\'s best online shop',
    images: ['/images/og-image.jpg'],
  },
  alternates: {
    canonical: SITE_URL,
    languages: { en: `${SITE_URL}/en`, bn: `${SITE_URL}/bn` },
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
  viewportFit: 'cover',
};

export default async function LocaleLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    children
  } = props;

  const { locale } = params;

  if (!locales.includes(locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <>
      {/* SEO JSON-LD — injected into <body> as Next.js recommends for RSC */}
      <OrganizationJsonLd />
      <WebSiteJsonLd />

      <NextIntlClientProvider messages={messages}>
        <Providers>{children}</Providers>
      </NextIntlClientProvider>

      {/* PWA install prompt — shown after 5s on first visit */}
      <PwaInstallPrompt />
    </>
  );
}

