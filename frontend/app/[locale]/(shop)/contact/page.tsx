'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Mail, Phone, MapPin, Facebook, Instagram, Youtube, MessageCircle } from 'lucide-react';
import { storefrontApi } from '@/lib/api';
import LiveChatLink from '@/components/chat/LiveChatLink';

const BUILDING_SRC = '/oceanbazar-building.jpg?v=1';

export default function ContactPage() {
  const locale = useLocale();
  const t = useTranslations('contact');

  const { data: settings } = useQuery({
    queryKey: ['storefront-settings'],
    queryFn: () => storefrontApi.settings().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const email = settings?.supportEmail?.trim() || '';
  const phone = settings?.supportPhone?.trim() || '';

  const socials = [
    { icon: Facebook, href: settings?.facebookUrl, label: 'Facebook' },
    { icon: Instagram, href: settings?.instagramUrl, label: 'Instagram' },
    { icon: Youtube, href: settings?.youtubeUrl, label: 'YouTube' },
  ].filter((s) => s.href && s.href !== '#');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">{t('intro')}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <Image
            src={BUILDING_SRC}
            alt={t('buildingAlt')}
            width={1200}
            height={800}
            className="h-auto w-full object-cover"
            unoptimized
            priority
          />
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="text-lg font-bold text-foreground">{t('aboutTitle')}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('aboutBody')}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('aboutBody2')}</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="mb-4 text-lg font-bold text-foreground">{t('reachTitle')}</h2>
            <ul className="space-y-4 text-sm">
              {email ? (
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{t('emailLabel')}</p>
                    <a href={`mailto:${email}`} className="text-primary hover:underline">
                      {email}
                    </a>
                  </div>
                </li>
              ) : null}
              {phone ? (
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{t('phoneLabel')}</p>
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="text-primary hover:underline">
                      {phone}
                    </a>
                  </div>
                </li>
              ) : null}
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{t('locationLabel')}</p>
                  <p className="text-muted-foreground">{t('locationValue')}</p>
                </div>
              </li>
            </ul>

            {socials.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    <s.icon className="h-4 w-4 text-primary" />
                    {s.label}
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap gap-3">
            <LiveChatLink
              href={`/${locale}/chat`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft transition hover:brightness-105"
            >
              <MessageCircle className="h-4 w-4" />
              {t('chatCta')}
            </LiveChatLink>
            <Link
              href={`/${locale}/support`}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/30"
            >
              {t('supportCta')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
