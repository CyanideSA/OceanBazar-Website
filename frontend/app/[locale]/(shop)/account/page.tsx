'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, Package, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { obPointsApi, profileApi } from '@/lib/api';
import TierBadge from '@/components/account/TierBadge';
import OBPointsWidget from '@/components/account/OBPointsWidget';
import type { User as UserType } from '@/types';

function mapProfileUser(raw: Record<string, unknown>): Partial<UserType> {
  return {
    name: String(raw.name ?? ''),
    preferredLang: raw.preferredLang === 'bn' ? 'bn' : 'en',
    profileImage: raw.profileImage != null ? String(raw.profileImage) : null,
  };
}

export default function AccountDashboardPage() {
  const t = useTranslations('account');
  const tDash = useTranslations('dashboard');
  const locale = useLocale();
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [photoUrl, setPhotoUrl] = useState(user?.profileImage ?? '');

  useEffect(() => {
    setPhotoUrl(user?.profileImage ?? '');
  }, [user?.profileImage]);

  const { data: ob } = useQuery({
    queryKey: ['ob-points-balance'],
    queryFn: () => obPointsApi.balance().then((r) => r.data),
    retry: false,
  });

  const saveProfile = useMutation({
    mutationFn: (payload: { profileImage?: string | null }) => profileApi.update(payload),
    onSuccess: (res) => {
      const raw = (res.data as { user: Record<string, unknown> }).user;
      if (raw) updateUser(mapProfileUser(raw));
      queryClient.invalidateQueries({ queryKey: ['ob-points-balance'] });
    },
  });

  const quick = [
    { href: `/${locale}/account/wishlist`, label: tDash('manageWishlist'), Icon: Heart },
    { href: `/${locale}/orders`, label: tDash('trackOrders'), Icon: Package },
    { href: `/${locale}/chat`, label: t('ticketsShort'), Icon: MessageSquare },
  ] as const;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <p className="text-xs font-medium text-primary sm:text-sm">{tDash('welcomeBack')}</p>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{tDash('title')}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{tDash('accountSummary')}</p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted sm:h-24 sm:w-24">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <User className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
              <h2 className="text-lg font-semibold text-foreground sm:text-xl">{user?.name}</h2>
              <p className="text-xs text-muted-foreground sm:text-sm">{user?.email ?? user?.phone}</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
                {ob ? <TierBadge tier={ob.tier} small /> : null}
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    user?.userType === 'wholesale'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {user?.userType === 'wholesale' ? t('customerTypeWholesale') : t('customerTypeRetail')}
                </span>
              </div>
              {ob ? (
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{ob.balance.toLocaleString()}</span> {t('obPointsShort')}
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-muted-foreground">{t('tierLabel')}</span>{' '}
                  <span className="font-medium">{ob.tier}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-border pt-4 sm:mt-6 sm:pt-6">
            <label className="block text-xs font-medium text-muted-foreground">{t('profilePhotoUrl')}</label>
            <div className="flex flex-col gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://"
              />
              <button
                type="button"
                disabled={saveProfile.isPending}
                onClick={() =>
                  saveProfile.mutate({
                    profileImage: photoUrl.trim() ? photoUrl.trim() : null,
                  })
                }
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 min-h-[44px] sm:w-auto"
              >
                {saveProfile.isPending ? t('saving') : t('saveProfile')}
              </button>
            </div>
          </div>
        </div>

        <OBPointsWidget />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-3 sm:text-sm">
          {tDash('quickActions')}
        </h3>
        <div className="grid grid-cols-1 gap-2 xs:grid-cols-3 sm:gap-3">
          {quick.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40 sm:p-4"
            >
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="text-sm font-medium text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
