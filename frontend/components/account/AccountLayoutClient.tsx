'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import type { User } from '@/types';
import AccountSidebar from './AccountSidebar';

function mapMeUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    email: raw.email != null ? String(raw.email) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    userType: raw.userType === 'wholesale' ? 'wholesale' : 'retail',
    accountStatus: (raw.accountStatus as User['accountStatus']) ?? 'active',
    preferredLang: raw.preferredLang === 'bn' ? 'bn' : 'en',
    emailVerified: Boolean(raw.emailVerified),
    profileImage: raw.profileImage != null ? String(raw.profileImage) : null,
    lifetimeSpend: Number(raw.lifetimeSpend ?? 0),
  };
}

export default function AccountLayoutClient({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const tc = useTranslations('common');
  const tAuth = useTranslations('auth');
  const { isAuthenticated, updateUser, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    authApi
      .me()
      .then((r) => {
        const u = (r.data as { user: Record<string, unknown> }).user;
        if (u) updateUser(mapMeUser(u));
      })
      .catch((err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) logout();
      });
  }, [isAuthenticated, updateUser, logout]);

  if (!isAuthenticated) {
    // Show a stable, accessible sign-in prompt rather than an aria-hidden
    // skeleton + immediate redirect (which raced across browsers and left the
    // page with no meaningful content).
    return (
      <div className="container-tight py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-lg font-semibold text-foreground">{tc('error')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{tc('loading')}</p>
          <Link
            href={`/${locale}/auth/login`}
            className="mt-6 inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110"
          >
            {tAuth('login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-tight pb-8 pt-4 sm:pt-6 lg:pb-8 lg:pt-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        <AccountSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
