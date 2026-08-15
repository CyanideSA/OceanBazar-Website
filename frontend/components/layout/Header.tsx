'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Bell, Menu, X, User, ChevronRight, LayoutGrid, TrendingUp, Package, Star, Ticket, LogOut, ShoppingBag } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { useUIStore } from '@/stores/uiStore';
import LanguageSelect from '@/components/shared/LanguageSelect';
import ThemeToggle from '@/components/theme/ThemeToggle';
import SearchAutocomplete from '@/components/search/SearchAutocomplete';
import CategoryMegaMenu from '@/components/layout/CategoryMegaMenu';
import Logo from '@/components/shared/Logo';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useShopRouter } from '@/lib/shopNavigation';
import { cn } from '@/lib/utils';
import { getMediaUrl } from '@/lib/mediaUrl';
import FlashSaleBanner from '@/components/flash-sale/FlashSaleBanner';
import LiveChatLink from '@/components/chat/LiveChatLink';
import type { FlashSaleMeta } from '@/lib/flashDeals';

function ProfileAvatar({
  src,
  name,
  size = 'sm',
}: {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md';
}) {
  const url = src ? getMediaUrl(src) : '';
  const dim = size === 'md' ? 'h-8 w-8' : 'h-6 w-6';
  const icon = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size === 'md' ? 32 : 24}
        height={size === 'md' ? 32 : 24}
        className={cn(dim, 'rounded-full object-cover')}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = (name || '').trim().charAt(0).toUpperCase();
  if (initial) {
    return (
      <span
        className={cn(
          dim,
          'inline-flex items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary',
        )}
        aria-hidden
      >
        {initial}
      </span>
    );
  }
  return (
    <span className={cn(dim, 'inline-flex items-center justify-center rounded-full bg-primary/10 text-primary')}>
      <User className={icon} />
    </span>
  );
}

export default function Header({ initialFlashSale }: { initialFlashSale?: FlashSaleMeta | null }) {
  const t = useTranslations('nav');
  const tp = useTranslations('product');
  const locale = useLocale();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const unreadCount = useNotificationsStore((s) => s.items.filter((n) => !n.read).length);
  const { mobileMenuOpen, setMobileMenuOpen, setLoginDialogOpen } = useUIStore();
  const router = useShopRouter();
  const [megaOpen, setMegaOpen] = useState(false);
  const [megaMobile, setMegaMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const avatarUrl = user?.profileImage || null;

  useEffect(() => {
    if (!isAuthenticated) return;
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '1eb282' },
      body: JSON.stringify({
        sessionId: '1eb282',
        runId: 'avatar-ob',
        hypothesisId: 'H-AVATAR-HEADER',
        location: 'Header.tsx',
        message: 'live header avatar state',
        data: { hasAvatar: Boolean(avatarUrl), nameLen: (user?.name || '').length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [isAuthenticated, avatarUrl, user?.name]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  function closeAll() {
    setMobileMenuOpen(false);
    setMegaMobile(false);
  }

  return (
    <>
      <div className="sticky top-0 z-50 w-full">
        <FlashSaleBanner initialSale={initialFlashSale} />
        <header className={cn(
          'w-full border-b border-border/60 glass transition-shadow duration-300',
          scrolled ? 'shadow-md' : 'shadow-soft',
        )}>
        {/* ── Mobile Header — compact Amazon/Alibaba style ── */}
        <div className="md:hidden">
          {/* Row 1: Logo + Icons */}
          <div className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5">
            <Link href={`/${locale}`} className="header-logo-link shrink-0 overflow-visible">
              <Logo width={124} height={58} priority interaction="brand" />
            </Link>

            <div className="flex-1" />

            <ThemeToggle />

            {isAuthenticated && (
              <Link
                href={`/${locale}/account/notifications`}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-destructive-foreground">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}

            {isAuthenticated ? (
              <Link
                href={`/${locale}/account`}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg text-foreground"
                aria-label="Account"
              >
                <ProfileAvatar src={avatarUrl} name={user?.name} size="md" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setLoginDialogOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground"
                aria-label="Login"
              >
                <User className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* Row 2: Search bar — full width, minimal padding */}
          <div className="px-2.5 pb-2">
            <SearchAutocomplete />
          </div>
        </div>

        {/* ── Desktop Header ── */}
        <div className="hidden w-full px-4 sm:px-6 lg:px-[0.5in] md:block">
          {/* Row 1: Logo | Categories | Search | Right cluster */}
          <div className="flex w-full items-center gap-3 pt-3 pb-1">
            <Link href={`/${locale}`} className="header-logo-link flex shrink-0 items-center overflow-visible">
              <Logo width={152} height={72} priority interaction="brand" />
            </Link>

            <div className="shrink-0">
              <CategoryMegaMenu
                desktopOpen={megaOpen}
                onDesktopOpenChange={setMegaOpen}
                mobileOpen={megaMobile}
                onMobileOpenChange={setMegaMobile}
              />
            </div>

            <div className="min-w-0 flex-1">
              <SearchAutocomplete />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden lg:block">
                <LanguageSelect />
              </div>
              <ThemeToggle />

              {isAuthenticated && (
                <Link
                  href={`/${locale}/account/notifications`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 text-foreground transition-colors hover:border-primary/30 hover:bg-accent"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-destructive-foreground">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
              )}

              {isAuthenticated ? (
                <Link
                  href={`/${locale}/account`}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-foreground',
                    'transition-all hover:border-primary/30 hover:bg-accent',
                  )}
                >
                  <ProfileAvatar src={avatarUrl} name={user?.name} size="sm" />
                  <span className="hidden max-w-[7rem] truncate text-sm font-medium lg:inline">
                    {user?.name?.split(' ')[0]}
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginDialogOpen(true)}
                  className={cn(
                    'rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground lg:px-4',
                    'shadow-soft transition-all hover:shadow-glow-primary hover:brightness-110 active:scale-[0.98]',
                  )}
                >
                  {t('login')}
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Nav links */}
          <nav className="flex items-center gap-0.5 pb-2">
            {[
              { href: `/${locale}`,           label: t('home')         },
              { href: `/${locale}/products`,  label: t('products')     },
              { href: `/${locale}/products/best-rated`, label: tp('bestRated') },
              { href: `/${locale}/wholesale`, label: t('wholesaleHub') },
              { href: `/${locale}/chat`,      label: t('chat'), liveChat: true },
              ...(isAuthenticated ? [{ href: `/${locale}/account/orders`, label: t('orders') }] : []),
            ].map((link) => (
              link.liveChat ? (
                <LiveChatLink
                  key={link.href}
                  href={link.href}
                  className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </LiveChatLink>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </Link>
              )
            ))}
          </nav>
        </div>
        </header>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          aria-hidden
          onClick={closeAll}
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[61] flex w-[min(85vw,340px)] flex-col bg-background shadow-2xl md:hidden',
          'transition-transform duration-300 ease-in-out',
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-label="Mobile navigation"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <Link href={`/${locale}`} onClick={closeAll} className="flex items-center">
            <Logo width={118} height={56} interaction="brand" />
          </Link>
          <button
            type="button"
            onClick={closeAll}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto">
          {/* Categories */}
          <div className="border-b border-border/40 p-3">
            <button
              type="button"
              onClick={() => setMegaMobile(true)}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl bg-primary/[0.08] px-4 py-3 text-left font-semibold text-foreground transition-colors hover:bg-primary/[0.14] active:bg-primary/20"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LayoutGrid className="h-4 w-4" />
              </span>
              <span className="flex-1">{t('categories')}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Quick nav links */}
          <div className="p-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Navigate
            </p>
            <nav className="space-y-0.5">
              {([
                { href: `/${locale}`,                         label: t('home'),         Icon: null,       emoji: '🏠' },
                { href: `/${locale}/products/top-trending`,   label: tp('topTrending'),  Icon: TrendingUp, emoji: null },
                { href: `/${locale}/products/best-rated`,     label: tp('bestRated'),    Icon: Star,       emoji: null },
                { href: `/${locale}/products/most-sold`,      label: tp('mostSold'),     Icon: ShoppingBag, emoji: null },
                { href: `/${locale}/products`,                label: tp('pageTitle'),    Icon: Package,    emoji: null },
                { href: `/${locale}/products/top-brands`,     label: 'Top Brands',      Icon: Star,       emoji: null },
                { href: `/${locale}/wholesale`,               label: t('wholesaleHub'), Icon: null,       emoji: '🏪' },
              ] as const).map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    onClick={closeAll}
                    className={cn(
                      'flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors active:scale-[0.98]',
                      isActive
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-foreground hover:bg-accent',
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base leading-none">
                      {link.Icon ? <link.Icon className="h-4 w-4" /> : link.emoji}
                    </span>
                    <span className="flex-1">{link.label}</span>
                    {isActive
                      ? <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    }
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Account section */}
          <div className="border-t border-border/40 p-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </p>
            {isAuthenticated ? (
              <div className="space-y-0.5">
                <Link
                  href={`/${locale}/account`}
                  onClick={closeAll}
                  className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent active:scale-[0.98]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    <ProfileAvatar src={avatarUrl} name={user?.name} size="md" />
                  </span>
                  <span className="flex-1">{user?.name?.split(' ')[0] ?? t('account')}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </Link>
                <Link
                  href={`/${locale}/account/orders`}
                  onClick={closeAll}
                  className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent active:scale-[0.98]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base">📋</span>
                  <span className="flex-1">{t('orders')}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </Link>
                <Link
                  href={`/${locale}/tickets`}
                  onClick={closeAll}
                  className="flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent active:scale-[0.98]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Ticket className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{t('tickets')}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { firebaseSignOut } = await import('@/lib/firebase');
                      await firebaseSignOut().catch(() => {});
                    } catch {
                      /* firebase optional on old clients */
                    }
                    logout();
                    closeAll();
                    router.push(`/${locale}`);
                  }}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.98]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{t('logout')}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { closeAll(); setLoginDialogOpen(true); }}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <User className="h-4 w-4" />
                {t('login')} / {t('register')}
              </button>
            )}
          </div>

          {/* Language */}
          <div className="border-t border-border/40 p-3">
            <LanguageSelect className="w-full justify-between" />
          </div>
        </div>
      </div>

      {/* Category full-screen sheet */}
      {megaMobile && (
        <div className="fixed inset-0 z-[62] md:hidden">
          <CategoryMegaMenu
            desktopOpen={false}
            onDesktopOpenChange={() => {}}
            mobileOpen={megaMobile}
            onMobileOpenChange={(v) => {
              setMegaMobile(v);
            }}
          />
        </div>
      )}
    </>
  );
}
