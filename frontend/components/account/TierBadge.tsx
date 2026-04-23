import type { OBTier } from '@/types';
import { TIER_COLORS } from '@/lib/ob-points';
import { useTranslations } from 'next-intl';

interface Props {
  tier: OBTier;
  small?: boolean;
}

const TIER_ICONS: Record<OBTier, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold: '🥇',
};

export default function TierBadge({ tier, small = false }: Props) {
  const t = useTranslations('obPoints');
  const colors = TIER_COLORS[tier];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${colors.bg} ${colors.text} ${colors.border} border ${
        small ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      }`}
    >
      <span>{TIER_ICONS[tier]}</span>
      <span>{t(tier.toLowerCase() as 'bronze' | 'silver' | 'gold')}</span>
    </span>
  );
}
