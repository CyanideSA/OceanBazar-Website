'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Home, ShoppingBag, User, LayoutGrid } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

export default function MobileBottomNav() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { cart, setOpen: setCartOpen } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const count = cart?.itemCount ?? 0;

  const tabs = [
    { href: `/${locale}`, label: t('home'), icon: Home },
    { href: `/${locale}/products`, label: t('products'), icon: LayoutGrid },
    { href: '__cart__', label: t('cart') ?? 'Cart', icon: ShoppingBag, badge: count },
    { href: isAuthenticated ? `/${locale}/account` : `/${locale}/auth/login`, label: t('account'), icon: User },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[55] border-t border-border/60 bg-background/95 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const isCart = tab.href === '__cart__';
          const isActive = !isCart && pathname === tab.href;

          if (isCart) {
            return (
              <button
                key="cart"
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground transition-colors active:text-primary"
              >
                <span className="relative">
                  <tab.icon className="h-5 w-5" />
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors active:text-primary',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>{tab.label}</span>
              {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
