'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  BarChart3,
  Bell,
  FolderTree,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Percent,
  Truck,
} from 'lucide-react';
import { useAdminAuthStore } from '@/stores/adminAuthStore';
import { cn } from '@/lib/utils';

const nav = [
  { href: '', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/catalog', label: 'Catalog Studio', Icon: FolderTree },
  { href: '/orders', label: 'Orders', Icon: Package },
  { href: '/delivery', label: 'Delivery', Icon: Truck },
  { href: '/tickets', label: 'Live Chat', Icon: MessageSquare },
  { href: '/coupons', label: 'Coupons', Icon: Percent },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/notifications', label: 'Notifications', Icon: Bell },
] as const;

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const { token, admin, logout } = useAdminAuthStore();
  const base = `/${locale}/admin`;
  const isLogin = pathname.includes('/admin/login');

  useEffect(() => {
    if (!isLogin && !token) router.replace(`${base}/login`);
  }, [isLogin, token, base, router]);

  useEffect(() => {
    if (isLogin && token) router.replace(base);
  }, [isLogin, token, base, router]);

  if (isLogin) return <>{children}</>;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          <p className="truncate text-sm font-medium">{admin?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{admin?.role}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map(({ href, label, Icon }) => {
            const path = href ? `${base}${href}` : base;
            const active = pathname === path || (href !== '' && pathname.startsWith(`${path}/`));
            return (
              <Link
                key={href || 'dash'}
                href={path}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => {
              logout();
              router.push(`${base}/login`);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>
      <main className="min-h-screen flex-1 overflow-auto">{children}</main>
    </div>
  );
}
