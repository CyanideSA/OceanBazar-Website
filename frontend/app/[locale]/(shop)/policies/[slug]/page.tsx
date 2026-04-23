import { notFound } from 'next/navigation';
import {
  ShieldCheck, CheckCircle2, Clock, AlertTriangle, Info,
  Truck, Package, CreditCard, Ban, FileText, Scale, Lock,
  RefreshCcw, Star, List, User, Mail,
} from 'lucide-react';
import { getPolicies, type PolicyKey, type SectionIcon } from '@/lib/policies';

const SLUG_TO_KEY: Record<string, PolicyKey> = {
  privacy: 'privacy',
  returns: 'returns',
  refunds: 'refunds',
  shipping: 'shipping',
  terms: 'terms',
  warranty: 'warranty',
};

const ICON_MAP: Record<SectionIcon, React.ElementType> = {
  shield: ShieldCheck,
  check: CheckCircle2,
  clock: Clock,
  alert: AlertTriangle,
  info: Info,
  truck: Truck,
  package: Package,
  credit: CreditCard,
  ban: Ban,
  file: FileText,
  scale: Scale,
  lock: Lock,
  refresh: RefreshCcw,
  star: Star,
  list: List,
  user: User,
  mail: Mail,
};

const TAG_STYLES = {
  eligibility: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  process:     'bg-primary/10 text-primary',
  timeline:    'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  conditions:  'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  info:        'bg-muted text-muted-foreground',
};

const TAG_LABELS_EN = {
  eligibility: 'Eligibility',
  process:     'Process',
  timeline:    'Timeline',
  conditions:  'Conditions',
  info:        'Info',
};

const TAG_LABELS_BN: Record<string, string> = {
  eligibility: 'যোগ্যতা',
  process:     'প্রক্রিয়া',
  timeline:    'সময়সীমা',
  conditions:  'শর্তাবলি',
  info:        'তথ্য',
};

export default function PolicyPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const TAG_LABELS = params.locale === 'bn' ? TAG_LABELS_BN : TAG_LABELS_EN;
  const key = SLUG_TO_KEY[params.slug];
  if (!key) notFound();

  const policy = getPolicies(params.locale)[key];
  if (!policy) notFound();

  return (
    <article className="rounded-2xl border border-border bg-card shadow-soft">
      {/* Header */}
      <header className="border-b border-border px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{policy.title}</h1>
          {policy.lastUpdated && (
            <span className="mt-1 whitespace-nowrap rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              Updated: {policy.lastUpdated}
            </span>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
          {policy.intro}
        </p>
      </header>

      {/* Sections */}
      <div className="divide-y divide-border">
        {policy.sections.map((section) => {
          const Icon = section.icon ? ICON_MAP[section.icon] : null;
          return (
            <section key={section.heading} className="px-6 py-6 sm:px-8">
              <div className="flex flex-wrap items-start gap-3">
                {Icon && (
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{section.heading}</h2>
                    {section.tag && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TAG_STYLES[section.tag]}`}>
                        {TAG_LABELS[section.tag]}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.body}</p>

                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {section.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.highlight && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{section.highlight}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
