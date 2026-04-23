'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
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
  const router = useRouter();
  const { isAuthenticated, updateUser } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/${locale}/auth/login`);
      return;
    }
    authApi
      .me()
      .then((r) => {
        const u = (r.data as { user: Record<string, unknown> }).user;
        if (u) updateUser(mapMeUser(u));
      })
      .catch(() => {});
  }, [isAuthenticated, locale, router, updateUser]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-hidden />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        <AccountSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
