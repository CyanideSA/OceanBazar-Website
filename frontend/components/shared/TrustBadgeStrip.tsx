'use client';

import { useTranslations } from 'next-intl';
import { Truck, Shield, RotateCcw, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';

const BADGES = [
  { key: 'freeShipping', Icon: Truck,       gradient: 'from-blue-500/10 to-blue-600/5',   iconColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'securePay',    Icon: Shield,      gradient: 'from-green-500/10 to-green-600/5',  iconColor: 'text-green-600 dark:text-green-400' },
  { key: 'easyReturn',   Icon: RotateCcw,   gradient: 'from-purple-500/10 to-purple-600/5', iconColor: 'text-purple-600 dark:text-purple-400' },
  { key: 'support',      Icon: Headphones,  gradient: 'from-orange-500/10 to-orange-600/5', iconColor: 'text-orange-600 dark:text-orange-400' },
] as const;

export default function TrustBadgeStrip() {
  const t = useTranslations('home.trustBadges');

  return (
    <div className="border-y border-border/40 bg-card/50">
      <div className="container-tight py-4 sm:py-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-4">
          {BADGES.map(({ key, Icon, gradient, iconColor }) => (
            <div key={key} className="flex items-center gap-2.5">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-soft sm:h-10 sm:w-10', gradient)}>
                <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', iconColor)} />
              </div>
              <span className="text-xs font-medium leading-tight text-foreground sm:text-sm">{t(key)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
