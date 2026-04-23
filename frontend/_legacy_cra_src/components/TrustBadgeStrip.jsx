import React, { useMemo } from 'react';
import {
  Award,
  CreditCard,
  Globe,
  Headphones,
  Lock,
  Package,
  Shield,
  Truck,
  Zap,
} from 'lucide-react';

const ICON_MAP = {
  shield: Shield,
  truck: Truck,
  lock: Lock,
  credit: CreditCard,
  payment: CreditCard,
  award: Award,
  zap: Zap,
  package: Package,
  globe: Globe,
  support: Headphones,
  headphones: Headphones,
  default: Shield,
};

function pickIcon(key) {
  if (key == null) return ICON_MAP.default;
  const k = String(key).toLowerCase().trim();
  return ICON_MAP[k] || ICON_MAP.default;
}

/**
 * Trust badges from site_settings (iconKey optional on each row).
 */
export default function TrustBadgeStrip({ badges = [] }) {
  const list = useMemo(() => (badges || []).filter((b) => b && b.label), [badges]);
  if (!list.length) return null;

  return (
    <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 p-5 sm:p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Shield className="h-5 w-5 text-[#5BA3D0] shrink-0" aria-hidden />
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-50">Shop with confidence</h2>
      </div>
      <p className="mb-5 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
        Trade-focused protections inspired by major marketplaces: secure checkout, logistics partners, and buyer support.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((b, i) => {
          const Icon = pickIcon(b.iconKey);
          return (
            <div
              key={i}
              className="flex gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5BA3D0]/12 text-[#5BA3D0] dark:bg-[#5BA3D0]/20">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{b.label}</p>
                {b.sublabel ? (
                  <p className="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400">{b.sublabel}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
