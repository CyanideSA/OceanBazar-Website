import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import SomethingWentWrongClient from './SomethingWentWrongClient';

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: 'status.oops' });
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

export default function SomethingWentWrongPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      }
    >
      <SomethingWentWrongClient />
    </Suspense>
  );
}
