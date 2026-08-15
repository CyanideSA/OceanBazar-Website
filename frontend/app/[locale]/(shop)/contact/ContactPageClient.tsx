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
import {
  DEFAULT_COMPANY_VISION,
  DEFAULT_LEADERSHIP_INTRO,
  DEFAULT_LEADERSHIP_TEAM,
  normalizeLeadershipTeam,
} from '@/lib/companyLeadershipDefaults';

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

  const address = String(settings?.registeredAddress || settings?.contactAddress || '').trim();
  const email = String(settings?.supportEmail || '').trim();
  const businessEmail = String(settings?.businessInquiryEmail || '').trim();
  const phone = String(settings?.supportPhone || '').trim();
  const legalName = String(settings?.legalName || 'Ocean Bazar').trim();
  const tradeLicenseNo = String(settings?.tradeLicenseNo || '').trim();
  const tinNumber = String(settings?.tinNumber || '').trim();

  const companyVision = String(settings?.companyVision || DEFAULT_COMPANY_VISION).trim();
  const leadershipIntro = String(settings?.leadershipIntro || DEFAULT_LEADERSHIP_INTRO).trim();
  const leadershipTeam = useMemo(() => {
    const normalized = normalizeLeadershipTeam(settings?.leadershipTeam);
    return normalized.length > 0 ? normalized : DEFAULT_LEADERSHIP_TEAM;
  }, [settings?.leadershipTeam]);

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
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'contact-vision',hypothesisId:'H1',location:'ContactPageClient.tsx:render',message:'contact vision/leadership rendered',data:{visionLen:companyVision.length,leadershipCount:leadershipTeam.length,hasIntro:!!leadershipIntro,fromSettingsVision:!!settings?.companyVision,fromSettingsTeam:Array.isArray(settings?.leadershipTeam)&&settings.leadershipTeam.length>0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [companyVision, leadershipTeam, leadershipIntro, settings?.companyVision, settings?.leadershipTeam]);

  return (
    <div className="container-tight py-8 sm:py-10">
      {/* Vision — top of page */}
      <section
        className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.07] via-card to-muted/40 p-6 shadow-soft sm:mb-10 sm:p-8 md:p-10"
        data-ob-company-vision="1"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/[0.08] blur-3xl"
          aria-hidden
        />
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('visionEyebrow')}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
          {t('visionTitle')}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
          {companyVision}
        </p>
        <p className="mt-4 text-sm font-semibold text-foreground/90">{legalName}</p>
      </section>

      {/* Leadership */}
      <section className="mb-8 sm:mb-10" data-ob-leadership="1">
        <div className="mb-5 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('leadershipEyebrow')}</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
            {t('leadershipTitle')}
          </h2>
          {leadershipIntro ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
              {leadershipIntro}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {leadershipTeam.map((member) => (
            <article
              key={`${member.name}-${member.title}`}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/25 sm:p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {member.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() || '')
                  .join('')}
              </div>
              <h3 className="mt-3 text-base font-bold text-foreground">{member.name}</h3>
              {member.title ? (
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary/90">
                  {member.title}
                </p>
              ) : null}
              {member.bio ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{member.bio}</p>
              ) : null}
              <ul className="mt-4 space-y-1.5 text-sm">
                {member.email ? (
                  <li className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <a
                      href={`mailto:${member.email}`}
                      className="truncate font-medium text-primary hover:underline"
                    >
                      {member.email}
                    </a>
                  </li>
                ) : null}
                {member.phone ? (
                  <li className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-primary" />
                    <a
                      href={`tel:${member.phone.replace(/\s/g, '')}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {member.phone}
                    </a>
                  </li>
                ) : null}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="mb-6 sm:mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{t('eyebrow')}</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">{t('title')}</h2>
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
                      {(tradeLicenseNo || tinNumber) ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {tradeLicenseNo ? <>Trade License: {tradeLicenseNo}</> : null}
                          {tradeLicenseNo && tinNumber ? ' · ' : null}
                          {tinNumber ? <>TIN: {tinNumber}</> : null}
                        </p>
                      ) : null}
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
          <p className="mt-1 text-sm font-semibold text-foreground/90">{legalName}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('aboutBody')}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('aboutBody2')}</p>
          {(tradeLicenseNo || tinNumber) ? (
            <div className="mt-4 space-y-1 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {tradeLicenseNo ? <p>Trade License No: {tradeLicenseNo}</p> : null}
              {tinNumber ? <p>TIN: {tinNumber}</p> : null}
              {address ? <p className="whitespace-pre-line">Registered address: {address}</p> : null}
            </div>
          ) : null}
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
