import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import MaintenancePageBody from './MaintenancePageBody';

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: 'status.maintenance' });
  return {
    title: t('metaTitle'),
    description: t('message'),
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    other: { 'google-site-verification': 'skip' },
  };
}

export default async function MaintenancePage(props: { params: Promise<{ locale: string }> }) {
  await props.params;
  return <MaintenancePageBody />;
}
