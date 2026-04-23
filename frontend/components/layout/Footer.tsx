'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storefrontApi } from '@/lib/api';
import { useLocale, useTranslations } from 'next-intl';
import LanguageSelect from '@/components/shared/LanguageSelect';
import PaymentLogos from '@/components/layout/PaymentLogos';
import Logo from '@/components/shared/Logo';
import Image from 'next/image';
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
} from 'lucide-react';

export default function Footer() {
  const locale = useLocale();
  const t = useTranslations('footer');
  const tPolicy = useTranslations('policies');
  const tNav = useTranslations('nav');
  const year = new Date().getFullYear();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = 0.75;
    }
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { y: 24, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
    },
  };

  const { data: siteSettings } = useQuery({
    queryKey: ['storefront-settings'],
    queryFn: () => storefrontApi.settings().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const socialLinks = useMemo(() => [
    { icon: Facebook, href: siteSettings?.facebookUrl || '#', label: 'Facebook' },
    { icon: Twitter, href: siteSettings?.twitterUrl || '#', label: 'Twitter' },
    { icon: Instagram, href: siteSettings?.instagramUrl || '#', label: 'Instagram' },
    { icon: Youtube, href: siteSettings?.youtubeUrl || '#', label: 'YouTube' },
  ].filter((s) => s.href && s.href !== '#'), [siteSettings]);

  return (
    <footer className="relative overflow-hidden text-white">
      {/* ── Realistic Ocean Video Background ── */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        className="absolute inset-0 h-full w-full object-cover"
        poster="https://images.pexels.com/videos/1409899/free-video-1409899.jpg?auto=compress&cs=tinysrgb&w=1920"
      >
        <source
          src="https://videos.pexels.com/video-files/1409899/1409899-uhd_2560_1440_25fps.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark overlay — ensures text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-blue-950/85 to-slate-950/95" />

      {/* Animated shimmer across the footer */}
      <div className="footer-shimmer absolute inset-0 pointer-events-none" />

      {/* Top accent line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

      {/* ── Content ── */}
      <div className="relative z-10">
        <motion.div
          className="container-tight"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 pt-20 pb-10 xs:grid-cols-2 sm:gap-x-8 md:grid-cols-4 md:pt-24 md:pb-16">
            {/* Brand */}
            <motion.div variants={itemVariants} className="col-span-1 xs:col-span-2 md:col-span-1 md:row-span-1">
              <div className="mb-4">
                <Logo width={300} height={90} variant="dark" />
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-blue-100/80">
                {t('tagline')}
              </p>
              <div className="mt-5">
                <PaymentLogos />
              </div>
              <div className="mt-5 flex gap-3">
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-blue-200 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white sm:h-9 sm:w-9"
                    aria-label={social.label}
                    whileHover={{ scale: 1.15, y: -3 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <social.icon className="h-4 w-4" />
                  </motion.a>
                ))}
              </div>
            </motion.div>

            {/* Shop */}
            <motion.div variants={itemVariants}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-cyan-300">{t('shopSection')}</h4>
              <ul className="space-y-1.5 text-sm text-blue-100/80">
                <li><Link href={`/${locale}/products`} className="block py-1 transition-colors hover:text-white">{t('allProducts')}</Link></li>
                <li><Link href={`/${locale}/products/featured`} className="block py-1 transition-colors hover:text-white">{t('featured')}</Link></li>
                <li><Link href={`/${locale}/products/top-trending`} className="block py-1 transition-colors hover:text-white">{t('topTrending')}</Link></li>
                <li><Link href={`/${locale}/products/latest`} className="block py-1 transition-colors hover:text-white">{t('latest')}</Link></li>
                <li><Link href={`/${locale}/products/best-seller`} className="block py-1 transition-colors hover:text-white">{t('bestSeller')}</Link></li>
              </ul>
            </motion.div>

            {/* Account */}
            <motion.div variants={itemVariants}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-cyan-300">{tNav('account')}</h4>
              <ul className="space-y-1.5 text-sm text-blue-100/80">
                <li><Link href={`/${locale}/account`} className="block py-1 transition-colors hover:text-white">{t('myAccount')}</Link></li>
                <li><Link href={`/${locale}/orders`} className="block py-1 transition-colors hover:text-white">{t('myOrders')}</Link></li>
                <li><Link href={`/${locale}/account/points`} className="block py-1 transition-colors hover:text-white">{t('obPoints')}</Link></li>
                <li><Link href={`/${locale}/support`} className="block py-1 transition-colors hover:text-white">{t('supportCenter')}</Link></li>
                <li><Link href={`/${locale}/chat`} className="block py-1 transition-colors hover:text-white">{tNav('chat')}</Link></li>
                <li><Link href={`/${locale}/returns`} className="block py-1 transition-colors hover:text-white">{t('returnsRefunds')}</Link></li>
                <li><Link href={`/${locale}/tickets`} className="block py-1 transition-colors hover:text-white">{t('supportTickets')}</Link></li>
              </ul>
            </motion.div>

            {/* Business & Legal */}
            <motion.div variants={itemVariants}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-cyan-300">{t('business')}</h4>
              <ul className="space-y-1.5 text-sm text-blue-100/80">
                <li><Link href={`/${locale}/marketing`} className="block py-1 transition-colors hover:text-white">{t('whyOceanBazar')}</Link></li>
                <li><Link href={`/${locale}/business-inquiries`} className="block py-1 transition-colors hover:text-white">{t('businessInquiries')}</Link></li>
                <li><Link href={`/${locale}/policies/privacy`} className="block py-1 transition-colors hover:text-white">{tPolicy('privacyPolicy')}</Link></li>
                <li><Link href={`/${locale}/policies/returns`} className="block py-1 transition-colors hover:text-white">{tPolicy('returnPolicy')}</Link></li>
                <li><Link href={`/${locale}/policies/terms`} className="block py-1 transition-colors hover:text-white">{tPolicy('termsConditions')}</Link></li>
              </ul>
            </motion.div>
          </div>

          {/* Divider */}
          <motion.div
            className="border-t border-white/10"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />

          {/* Bottom bar */}
          <motion.div
            className="flex flex-col items-center gap-3 py-5 text-center sm:flex-row sm:justify-between sm:text-left"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            variants={itemVariants}
          >
            <p className="text-xs text-blue-200/70">
              &copy; {year} Oceanbazar &middot; Made in Bangladesh
            </p>
            <LanguageSelect variant="footer" className="justify-end" />
          </motion.div>
        </motion.div>
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
