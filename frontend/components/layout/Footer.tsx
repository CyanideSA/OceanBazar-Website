'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { newsletterApi, storefrontApi } from '@/lib/api';
import { useLocale, useTranslations } from 'next-intl';
import LanguageSelect from '@/components/shared/LanguageSelect';
import PaymentLogos from '@/components/layout/PaymentLogos';
import Logo from '@/components/shared/Logo';
import OceanVideoBackground from '@/components/shared/OceanVideoBackground';
import LiveChatLink from '@/components/chat/LiveChatLink';
import { ThreadsIcon } from '@/components/shared/ThreadsIcon';
import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';
import {
  STOREFRONT_SETTINGS_QUERY_KEY,
  coalesceStorefrontSettings,
} from '@/lib/storefrontSettings';
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Mail,
  Phone,
} from 'lucide-react';

/**
 * Footer is intentionally free of framer-motion opacity:0 / whileInView gates.
 * Older Safari often fails to run Next 15 client bundles; motion-hidden content
 * would stay invisible forever. Links must remain visible in plain SSR HTML.
 */
export default function Footer({ initialSettings }: { initialSettings?: StorefrontPublicSettings }) {
  const locale = useLocale();
  const t = useTranslations('footer');
  const tPolicy = useTranslations('policies');
  const tNav = useTranslations('nav');
  const year = new Date().getFullYear();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const { data: remoteSettings } = useQuery({
    queryKey: STOREFRONT_SETTINGS_QUERY_KEY,
    queryFn: () => storefrontApi.settings().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    initialData: initialSettings,
  });

  const siteSettings = useMemo(
    () => coalesceStorefrontSettings(remoteSettings, initialSettings),
    [remoteSettings, initialSettings]
  );

  const supportEmail = String(siteSettings?.supportEmail || '').trim();
  const supportPhone = String(siteSettings?.supportPhone || '').trim();

  const socialLinks = useMemo(() => {
    const items: Array<{ icon: typeof Facebook | typeof ThreadsIcon; href: string; label: string }> = [
      { icon: Facebook, href: siteSettings?.facebookUrl || '', label: 'Facebook' },
      { icon: Instagram, href: siteSettings?.instagramUrl || '', label: 'Instagram' },
      { icon: Youtube, href: siteSettings?.youtubeUrl || '', label: 'YouTube' },
      { icon: ThreadsIcon, href: siteSettings?.threadsUrl || '', label: 'Threads' },
      { icon: Twitter, href: siteSettings?.twitterUrl || '', label: 'Twitter' },
    ];
    if (supportEmail) items.push({ icon: Mail, href: `mailto:${supportEmail}`, label: 'Email' });
    const visible = items.filter((s) => s.href && s.href !== '#');
    return visible;
  }, [siteSettings, supportEmail, supportPhone, initialSettings, remoteSettings]);

  return (
    <footer className="relative overflow-hidden text-white" data-ob-footer="visible">
      <OceanVideoBackground overlayClassName="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-blue-950/85 to-slate-950/95" />

      <div className="footer-shimmer absolute inset-0 pointer-events-none" aria-hidden />

      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

      <div className="relative z-10">
        <div className="w-full px-4 sm:px-6 lg:px-[0.5in]">
          <div className="grid grid-cols-1 gap-x-8 gap-y-10 pt-14 pb-10 sm:grid-cols-2 lg:grid-cols-4 lg:pt-16 lg:pb-12">
            <div className="min-w-0 sm:col-span-2 lg:col-span-1">
              <div className="mb-3 -ml-1 w-full max-w-[13rem] sm:max-w-[15rem] lg:max-w-[17.5rem]">
                <Logo
                  width={300}
                  height={85}
                  interaction="footer"
                />
              </div>
              <p className="max-w-md text-sm leading-relaxed text-blue-100/80 text-pretty lg:max-w-xs">
                {t('tagline')}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5" data-ob-footer-socials={String(socialLinks.length)}>
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target={social.href.startsWith('mailto:') ? undefined : '_blank'}
                    rel={social.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-md transition-colors hover:bg-cyan-300"
                    aria-label={social.label}
                    title={social.label}
                  >
                    <social.icon className="h-5 w-5" strokeWidth={2.25} />
                  </a>
                ))}
                <Link
                  href={`/${locale}/contact`}
                  className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-bold text-slate-900 shadow-md transition-colors hover:bg-cyan-50"
                >
                  {t('contactUs')}
                </Link>
              </div>
              {(supportEmail || supportPhone) && (
                <div className="mt-3 space-y-1.5 text-sm text-blue-50">
                  {supportEmail ? (
                    <a href={`mailto:${supportEmail}`} className="flex items-center gap-1.5 hover:text-white">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> {supportEmail}
                    </a>
                  ) : null}
                  {supportPhone ? (
                    <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 hover:text-white">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {supportPhone}
                    </a>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-cyan-300">{t('shopSection')}</h4>
              <ul className="space-y-1.5 text-sm text-blue-100/80">
                <li><Link href={`/${locale}/products`} className="block py-1 transition-colors hover:text-white">{t('allProducts')}</Link></li>
                <li><Link href={`/${locale}/products/featured`} className="block py-1 transition-colors hover:text-white">{t('featured')}</Link></li>
                <li><Link href={`/${locale}/products/top-trending`} className="block py-1 transition-colors hover:text-white">{t('topTrending')}</Link></li>
                <li><Link href={`/${locale}/products/most-sold`} className="block py-1 transition-colors hover:text-white">{t('mostSold')}</Link></li>
                <li><Link href={`/${locale}/products/best-rated`} className="block py-1 transition-colors hover:text-white">{t('bestRated')}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-cyan-300">{tNav('account')}</h4>
              <ul className="space-y-1.5 text-sm text-blue-100/80">
                <li><Link href={`/${locale}/account`} className="block py-1 transition-colors hover:text-white">{t('myAccount')}</Link></li>
                <li><Link href={`/${locale}/account/orders`} className="block py-1 transition-colors hover:text-white">{t('myOrders')}</Link></li>
                <li><Link href={`/${locale}/order-tracking`} className="block py-1 transition-colors hover:text-white">Track Order</Link></li>
                <li><Link href={`/${locale}/account/points`} className="block py-1 transition-colors hover:text-white">{t('obPoints')}</Link></li>
                <li><Link href={`/${locale}/support`} className="block py-1 transition-colors hover:text-white">{t('supportCenter')}</Link></li>
                <li><LiveChatLink href={`/${locale}/chat`} className="block w-full py-1 text-left transition-colors hover:text-white">{tNav('chat')}</LiveChatLink></li>
                <li><Link href={`/${locale}/returns`} className="block py-1 transition-colors hover:text-white">{t('returnsRefunds')}</Link></li>
                <li><Link href={`/${locale}/tickets`} className="block py-1 transition-colors hover:text-white">{t('supportTickets')}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-cyan-300">{t('business')}</h4>
              <ul className="space-y-1.5 text-sm text-blue-100/80">
                <li><Link href={`/${locale}/marketing`} className="block py-1 transition-colors hover:text-white">{t('whyOceanBazar')}</Link></li>
                <li><Link href={`/${locale}/contact`} className="block py-1 transition-colors hover:text-white">{t('contactUs')}</Link></li>
                <li><Link href={`/${locale}/business-inquiries`} className="block py-1 transition-colors hover:text-white">{t('businessInquiries')}</Link></li>
                <li><Link href={`/${locale}/policies/privacy`} className="block py-1 transition-colors hover:text-white">{tPolicy('privacyPolicy')}</Link></li>
                <li><Link href={`/${locale}/policies/returns`} className="block py-1 transition-colors hover:text-white">{tPolicy('returnPolicy')}</Link></li>
                <li><Link href={`/${locale}/policies/refunds`} className="block py-1 transition-colors hover:text-white">{tPolicy('refundPolicy')}</Link></li>
                <li><Link href={`/${locale}/policies/terms`} className="block py-1 transition-colors hover:text-white">{tPolicy('termsConditions')}</Link></li>
                <li><Link href={`/${locale}/policies/shipping`} className="block py-1 transition-colors hover:text-white">{tPolicy('shippingPolicy')}</Link></li>
                <li>
                  <a
                    href={`${(process.env.NEXT_PUBLIC_LITE_SITE_URL || 'https://oceanbazar.com.bd/lite').replace(/\/$/, '')}/prefer?view=lite&next=${encodeURIComponent(`/${locale}`)}`}
                    className="block py-1 transition-colors hover:text-white"
                  >
                    Lite site (লাইট)
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Newsletter</p>
                <p className="mt-1 text-xs text-blue-100/80">Get flash sales, restock alerts, and curated picks first.</p>
              </div>
              <form
                className="flex w-full flex-col gap-2 xs:flex-row sm:max-w-md"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newsletterEmail) return;
                  setNewsletterState('loading');
                  try {
                    await newsletterApi.subscribe(newsletterEmail);
                    setNewsletterState('done');
                    setNewsletterEmail('');
                  } catch {
                    setNewsletterState('error');
                  }
                }}
              >
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/20 bg-black/20 px-3">
                  <Mail className="h-4 w-4 text-blue-200/80" />
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="h-11 w-full bg-transparent text-sm text-white placeholder:text-blue-100/60 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={newsletterState === 'loading'}
                  className="h-11 rounded-xl bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                >
                  {newsletterState === 'loading' ? 'Joining…' : 'Subscribe'}
                </button>
              </form>
            </div>
            {newsletterState === 'done' && <p className="mt-2 text-xs text-emerald-300">Subscribed successfully.</p>}
            {newsletterState === 'error' && <p className="mt-2 text-xs text-rose-300">Could not subscribe right now.</p>}
          </div>

          <div className="-mx-4 mb-8 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-[0.5in] lg:w-[calc(100%+1in)]">
            <PaymentLogos />
          </div>

          {(siteSettings?.registeredAddress || siteSettings?.tradeLicenseNo || siteSettings?.tinNumber) && (
            <div className="mb-6 space-y-1 text-center text-xs text-blue-100/70 sm:text-left">
              {siteSettings?.legalName ? <p className="font-semibold text-blue-50/90">{siteSettings.legalName}</p> : null}
              {siteSettings?.registeredAddress ? (
                <p className="whitespace-pre-line">{siteSettings.registeredAddress}</p>
              ) : null}
              <p>
                {siteSettings?.tradeLicenseNo ? <>Trade License: {siteSettings.tradeLicenseNo}</> : null}
                {siteSettings?.tradeLicenseNo && siteSettings?.tinNumber ? ' · ' : null}
                {siteSettings?.tinNumber ? <>TIN: {siteSettings.tinNumber}</> : null}
              </p>
            </div>
          )}

          <div className="border-t border-white/10" />

          <div
            className="flex flex-col items-center gap-3 py-5 text-center sm:flex-row sm:justify-between sm:text-left"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <p className="text-xs text-blue-200/70">
              &copy; {year} Oceanbazar &middot; Made in Bangladesh
            </p>
            <LanguageSelect variant="footer" className="justify-end" />
          </div>
        </div>
      </div>

      <style jsx>{`
        .footer-shimmer {
          background: linear-gradient(
            105deg,
            transparent 40%,
            rgba(255, 255, 255, 0.03) 45%,
            rgba(255, 255, 255, 0.05) 50%,
            rgba(255, 255, 255, 0.03) 55%,
            transparent 60%
          );
          background-size: 200% 100%;
          animation: footer-shimmer-move 6s ease-in-out infinite;
        }

        @keyframes footer-shimmer-move {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </footer>
  );
}
