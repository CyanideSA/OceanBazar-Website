import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import HomePageContent from '@/components/home/HomePageContent';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: 'home' });
  return {
    title: t('hero.title'),
    description: t('hero.subtitle'),
  };
}

export default function HomePage() {
  return <HomePageContent />;
}
