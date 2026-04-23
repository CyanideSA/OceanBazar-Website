import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import HomePageContent from '@/components/home/HomePageContent';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'home' });
  return {
    title: t('hero.title'),
    description: t('hero.subtitle'),
  };
}

export default function HomePage() {
  return <HomePageContent />;
}
