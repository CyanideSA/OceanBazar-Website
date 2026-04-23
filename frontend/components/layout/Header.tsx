'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Bell, Menu, X, User, ChevronRight, LayoutGrid, TrendingUp, Package, Star, Ticket, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { useUIStore } from '@/stores/uiStore';
import { firebaseSignOut } from '@/lib/firebase';
import LanguageSelect from '@/components/shared/LanguageSelect';
import ThemeToggle from '@/components/theme/ThemeToggle';
import SearchAutocomplete from '@/components/search/SearchAutocomplete';
import CategoryMegaMenu from '@/components/layout/CategoryMegaMenu';
import Logo from '@/components/shared/Logo';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const unreadCount = useNotificationsStore((s) => s.items.filter((n) => !n.read).length);
  const { mobileMenuOpen, setMobileMenuOpen, setLoginDialogOpen } = useUIStore();
  const router = useRouter();
  const [megaOpen, setMegaOpen] = useState(false);
  const [megaMobile, setMegaMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  /* Hide header on scroll-down, show on scroll-up */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
      if (y > 80 && y > lastScrollY.current) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Lock body scroll when drawer is open */
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
      <header className={cn(
        'sticky top-0 z-50 w-full border-b border-border/60 glass transition-all duration-300',
        scrolled ? 'shadow-md' : 'shadow-soft',
        hidden && !mobileMenuOpen ? '-translate-y-full' : 'translate-y-0',
      )}>
        <div className="container-tight">

          {/* ── Top bar — single row ── */}
          <div className="flex w-full items-center gap-2 py-2 md:gap-3 md:py-3">

            {/* Logo — far left */}
            <Link href={`/${locale}`} className="flex shrink-0 items-center">
              <Logo width={180} height={54} className="md:hidden" />
              <Logo width={240} height={72} className="hidden md:block" />
            </Link>

            {/* Categories button — next to logo, desktop only */}
            <div className="hidden shrink-0 md:block">
              <CategoryMegaMenu
                desktopOpen={megaOpen}
                onDesktopOpenChange={setMegaOpen}
                mobileOpen={megaMobile}
                onMobileOpenChange={setMegaMobile}
              />
            </div>

            {/* Search bar — fills remaining space */}
            <div className="min-w-0 flex-1">
              <SearchAutocomplete />
            </div>

            {/* Right cluster — Language, Theme, Notifications, Login */}
            <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
              {/* Language — desktop */}
              <div className="hidden sm:block">
                <LanguageSelect />
              </div>

              {/* Theme toggle */}
              <ThemeToggle />

              {/* Notification bell — authenticated only */}
              {isAuthenticated && (
                <Link
                  href={`/${locale}/account/notifications`}
                  className="relative hidden h-10 w-10 items-center justify-center rounded-lg border border-border/60 text-foreground transition-colors hover:border-primary/30 hover:bg-accent sm:flex"
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

              {/* Account / Login */}
              {isAuthenticated ? (
                <Link
                  href={`/${locale}/account`}
                  className={cn(
                    'hidden items-center gap-1.5 rounded-lg border border-border/60 px-2 py-2 text-foreground sm:flex',
                    'transition-all hover:border-primary/30 hover:bg-accent md:px-3',
                  )}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <span className="hidden max-w-[7rem] truncate text-sm font-medium lg:inline">
                    {user?.name?.split(' ')[0]}
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginDialogOpen(true)}
                  className={cn(
                    'hidden rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:inline-flex',
                    'shadow-soft transition-all hover:shadow-glow-primary hover:brightness-110 active:scale-[0.98]',
                  )}
                >
                  {t('login')}
                </button>
              )}

              {/* Hamburger — mobile only */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 text-foreground transition-colors hover:bg-accent md:hidden"
                aria-label="Open menu"
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Desktop secondary nav ── */}
          <nav className="hidden border-t border-border/40 md:block">
            <div className="flex items-center gap-1 py-1.5">
              {[
                { href: `/${locale}`,           label: t('home')         },
                { href: `/${locale}/products`,  label: t('products')     },
                { href: `/${locale}/wholesale`, label: t('wholesaleHub') },
                { href: `/${locale}/chat`,      label: t('chat')         },
                ...(isAuthenticated
                  ? [
                      { href: `/${locale}/orders`, label: t('orders')  },
                    ]
                  : []),
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

        </div>
      </header>

      {/* ── Mobile drawer overlay ── rendered outside header so it fills full viewport ── */}

      {/* Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
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
        {/* Drawer header — logo + single X close */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <Link href={`/${locale}`} onClick={closeAll} className="flex items-center">
            <Logo width={160} height={48} />
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

        {/* Drawer body — scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* Categories (opens full-screen sheet above) */}
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
                { href: `/${locale}/products/top-trending`,   label: 'Top Trending',    Icon: TrendingUp, emoji: null },
                { href: `/${locale}/products`,                label: 'All Products',    Icon: Package,    emoji: null },
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-base">👤</span>
                  <span className="flex-1">{user?.name?.split(' ')[0] ?? t('account')}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </Link>
                <Link
                  href={`/${locale}/orders`}
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
                  onClick={async () => { await firebaseSignOut().catch(() => {}); logout(); closeAll(); router.push(`/${locale}`); }}
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

      {/* Category full-screen sheet — rendered here so it sits above drawer */}
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
