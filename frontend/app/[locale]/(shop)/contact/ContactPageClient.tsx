'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Mail, Phone, MapPin, Facebook, Instagram, Youtube, Twitter, MessageCircle, Briefcase } from 'lucide-react';
import { storefrontApi } from '@/lib/api';
import LiveChatLink from '@/components/chat/LiveChatLink';
import { ThreadsIcon } from '@/components/shared/ThreadsIcon';
import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';
import {
  STOREFRONT_SETTINGS_QUERY_KEY,
  coalesceStorefrontSettings,
} from '@/lib/storefrontSettings';

const BUILDING_SRC = '/oceanbazar-building.jpg?v=1';

export default function ContactPageClient({
  initialSettings,
}: {
  initialSettings?: StorefrontPublicSettings;
}) {
  const locale = useLocale();
  const t = useTranslations('contact');

  const { data: remoteSettings } = useQuery({
    queryKey: STOREFRONT_SETTINGS_QUERY_KEY,
    queryFn: () => storefrontApi.settings().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    initialData: initialSettings,
  });

  const settings = useMemo(
    () => coalesceStorefrontSettings(remoteSettings, initialSettings),
    [remoteSettings, initialSettings]
  );

  const address = String(settings?.contactAddress || '').trim();
  const email = String(settings?.supportEmail || '').trim();
  const businessEmail = String(settings?.businessInquiryEmail || '').trim();
  const phone = String(settings?.supportPhone || '').trim();

  const socials = [
    { icon: Facebook, href: settings?.facebookUrl, label: 'Facebook' },
    { icon: Instagram, href: settings?.instagramUrl, label: 'Instagram' },
    { icon: Youtube, href: settings?.youtubeUrl, label: 'YouTube' },
    { icon: ThreadsIcon, href: settings?.threadsUrl, label: 'Threads' },
    { icon: Twitter, href: settings?.twitterUrl, label: 'Twitter' },
  ].filter((s) => s.href && s.href !== '#');

  const hasChannels = Boolean(address || email || businessEmail || phone);
  const hasContactBlock = Boolean(hasChannels || socials.length);

  useEffect(() => {
  }, [address, email, businessEmail, phone, socials.length, remoteSettings, initialSettings]);

  return (
    <div className="container-tight py-8 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('eyebrow')}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">{t('title')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">{t('intro')}</p>
      </div>

      <section
        className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft sm:mb-8 sm:p-6"
        data-ob-contact-details="1"
      >
        <h2 className="mb-3 text-lg font-bold text-foreground">{t('reachTitle')}</h2>

        {hasContactBlock ? (
          <>
            {socials.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-2" data-ob-contact-socials={String(socials.length)}>
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground shadow-sm transition hover:brightness-110"
                    aria-label={s.label}
                    title={s.label}
                  >
                    <s.icon className="h-4 w-4 shrink-0 text-primary-foreground" strokeWidth={2.25} />
                    <span>{s.label}</span>
                  </a>
                ))}
              </div>
            ) : null}

            {hasChannels ? (
              <ul className="grid gap-3 text-sm sm:grid-cols-2">
                {email ? (
                  <li className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{t('contactEmailLabel')}</p>
                      <a href={`mailto:${email}`} className="break-all font-medium text-primary hover:underline">
                        {email}
                      </a>
                    </div>
                  </li>
                ) : null}
                {phone ? (
                  <li className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{t('phoneLabel')}</p>
                      <a href={`tel:${phone.replace(/\s/g, '')}`} className="font-medium text-primary hover:underline">
                        {phone}
                      </a>
                    </div>
                  </li>
                ) : null}
                {businessEmail ? (
                  <li className="flex items-start gap-3 sm:col-span-2">
                    <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{t('businessEmailLabel')}</p>
                      <a href={`mailto:${businessEmail}`} className="break-all font-medium text-primary hover:underline">
                        {businessEmail}
                      </a>
                    </div>
                  </li>
                ) : null}
                {address ? (
                  <li className="flex items-start gap-3 sm:col-span-2">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{t('addressLabel')}</p>
                      <p className="whitespace-pre-line text-foreground/90">{address}</p>
                    </div>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('intro')}</p>
        )}
      </section>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <LiveChatLink
          href={`/${locale}/chat`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft transition hover:brightness-105"
        >
          <MessageCircle className="h-4 w-4" />
          {t('chatCta')}
        </LiveChatLink>
        <Link
          href={`/${locale}/business-inquiries`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/30"
        >
          <Briefcase className="h-4 w-4" />
          {t('businessCta')}
        </Link>
        <Link
          href={`/${locale}/support`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/30"
        >
          {t('supportCta')}
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8 md:items-start">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
          <h2 className="text-lg font-bold text-foreground">{t('aboutTitle')}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('aboutBody')}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('aboutBody2')}</p>
        </section>

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
      </div>
    </div>
  );
}
