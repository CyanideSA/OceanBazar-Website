'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Bookmark,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Settings,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { authApi } from '@/lib/api';
import { firebaseSignOut } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

type NavKey =
  | 'dashboard'
  | 'wishlist'
  | 'orders'
  | 'notifications'
  | 'paymentMethods'
  | 'addresses'
  | 'reviews'
  | 'settings';

type NavItem = {
  href: string;
  key: NavKey;
  Icon: LucideIcon;
  exact?: boolean;
  external?: boolean;
};

const items: NavItem[] = [
  { href: '', key: 'dashboard', Icon: LayoutDashboard, exact: true },
  { href: '/wishlist', key: 'wishlist', Icon: Bookmark },
  { href: '/orders', key: 'orders', Icon: Package, external: true },
  { href: '/notifications', key: 'notifications', Icon: Bell },
  { href: '/payments', key: 'paymentMethods', Icon: CreditCard },
  { href: '/addresses', key: 'addresses', Icon: MapPin },
  { href: '/reviews', key: 'reviews', Icon: Star },
  { href: '/settings', key: 'settings', Icon: Settings },
];

export default function AccountSidebar() {
  const t = useTranslations('account');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const unreadCount = useNotificationsStore((s) => s.items.filter((n) => !n.read).length);
  const base = `/${locale}/account`;

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    await firebaseSignOut().catch(() => {});
    logout();
    router.push(`/${locale}`);
  };

  return (
    <aside className="w-full shrink-0 lg:w-56">
      {/* Mobile: horizontal scrollable tabs with pill style */}
      <nav className="scrollbar-hide -mx-4 flex flex-row gap-2 overflow-x-auto border-b border-border bg-background px-4 pb-3 pt-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-2 lg:pb-0 lg:pt-0">
        {items.map(({ href, key, Icon, exact, external }) => {
          const path = external ? `/${locale}${href}` : `${base}${href}`;
          const active = external
            ? pathname === path || pathname.startsWith(`${path}/`)
            : exact
              ? pathname === path || pathname === `${path}/`
              : pathname === path || pathname.startsWith(`${path}/`);

          return (
            <Link
              key={key}
              href={path}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors lg:min-h-[44px] lg:rounded-xl',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{t(key)}</span>
              {key === 'notifications' && unreadCount > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleLogout}
          className="flex shrink-0 items-center gap-2 rounded-full bg-muted px-4 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10 lg:min-h-[44px] lg:rounded-xl"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{t('logout')}</span>
        </button>
      </nav>
    </aside>
  );
}
