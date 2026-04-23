import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Lock, RefreshCcw, CreditCard, Truck, FileText, Star } from 'lucide-react';

export default async function PoliciesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const t = await getTranslations({ locale: params.locale, namespace: 'policies' });

  const links = [
    { href: `/${params.locale}/policies/privacy`,  label: t('privacyPolicy'),  Icon: Lock },
    { href: `/${params.locale}/policies/returns`,  label: t('returnPolicy'),   Icon: RefreshCcw },
    { href: `/${params.locale}/policies/refunds`,  label: t('refundPolicy'),   Icon: CreditCard },
    { href: `/${params.locale}/policies/shipping`, label: t('shippingPolicy'), Icon: Truck },
    { href: `/${params.locale}/policies/terms`,    label: t('termsConditions'),Icon: FileText },
    { href: `/${params.locale}/policies/warranty`, label: t('warrantyPolicy'), Icon: Star },
  ];

  return (
    <div className="container-tight py-8 sm:py-10 lg:py-12">
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('title')}</p>
            <nav className="space-y-0.5">
              {links.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
