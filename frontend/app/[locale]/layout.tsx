import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';
import '../globals.css';
import Providers from '@/components/shared/Providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-bengali',
  display: 'swap',
});

const locales = ['en', 'bn'];

export const metadata: Metadata = {
  title: { default: 'Oceanbazar — বাংলাদেশের সেরা অনলাইন শপ', template: '%s | Oceanbazar' },
  description: 'Retail & Wholesale ecommerce platform for Bangladesh. Best prices on electronics, clothing, and more.',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;

  if (!locales.includes(locale)) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${notoSansBengali.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
