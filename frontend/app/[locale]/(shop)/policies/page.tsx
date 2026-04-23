import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function PoliciesIndexPage({
  params,
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale: params.locale, namespace: 'policies' });

  const items = [
    { slug: 'privacy', title: t('privacyPolicy'), intro: t('privacyIntro') },
    { slug: 'returns', title: t('returnPolicy'), intro: t('returnIntro') },
    { slug: 'refunds', title: t('refundPolicy'), intro: t('refundIntro') },
    { slug: 'shipping', title: t('shippingPolicy'), intro: t('shippingIntro') },
    { slug: 'terms', title: t('termsConditions'), intro: t('termsIntro') },
    { slug: 'warranty', title: t('warrantyPolicy'), intro: t('warrantyIntro') },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`/${params.locale}/policies/${item.slug}`}
          className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/30 hover:shadow-soft-md"
        >
          <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.intro}</p>
          <p className="mt-4 text-sm font-semibold text-primary">{t('readMore')}</p>
        </Link>
      ))}
    </div>
  );
}
