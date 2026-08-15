import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import HomePageContent from '@/components/home/HomePageContent';
import { fetchHomeCatalog } from '@/lib/fetchHomeCatalog';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: 'home' });
  return {
    title: t('hero.title'),
    description: t('hero.subtitle'),
  };
}

export default async function HomePage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const catalog = await fetchHomeCatalog(params.locale);


  return <HomePageContent catalog={catalog} />;
}
